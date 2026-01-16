import express from 'express';
import { DateTime } from 'luxon';
import { getCalendarEvents } from '../utils/googleCalendar.js';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getCache, setCache } from '../utils/redis.js';

const router = express.Router();

// Конфигурация кеширования (Простое кеширование с коротким TTL)
const CACHE_CONFIG = {
  // TTL для кеша (60 секунд - баланс между скоростью и актуальностью)
  TTL: 60,
  // Ключ кеша
  getKey: (date) => `availability:${date}`,
};

/**
 * Генерация доступных слотов для даты
 * Вынесено в отдельную функцию для переиспользования
 */
async function generateAvailabilitySlots(date) {
  // ===== РАБОТА С МОСКОВСКИМ ЧАСОВЫМ ПОЯСОМ (UTC+3) =====
  const dateMoscow = DateTime.fromISO(date).setZone('Europe/Moscow');
  if (!dateMoscow.isValid) {
    throw new Error('Неверный формат даты');
  }
  
  // Определяем рабочие часы в московском времени
  const [workStartHour, workStartMinute] = config.workHours.start.split(':').map(Number);
  const [workEndHour, workEndMinute] = config.workHours.end.split(':').map(Number);
  
  const workStart = dateMoscow.set({ hour: workStartHour, minute: workStartMinute, second: 0 });
  const workEnd = dateMoscow.set({ hour: workEndHour, minute: workEndMinute, second: 0 });
  
  // Диапазон рабочего дня в UTC для запроса к Google Calendar
  const workStartUtc = workStart.toUTC();
  const workEndUtc = workEnd.toUTC();
  
  // Получаем все события из Google Calendar в рамках рабочего времени
  const events = await getCalendarEvents(workStartUtc.toJSDate(), workEndUtc.toJSDate());
  
  // Минимальное время бронирования (за 2 часа вперед)
  const nowMoscow = DateTime.now().setZone('Europe/Moscow');
  const minTime = nowMoscow.plus({ hours: config.workHours.minAdvanceHours });
  
  // Создаем карту занятых часов из Google Calendar
  const busyHoursMap = new Map();
  
  events.forEach(event => {
    // Фильтруем только события с временем (не целый день)
    if (!event.start.dateTime) return;
    
    const eventStart = DateTime.fromISO(event.start.dateTime).toUTC();
    const eventEnd = DateTime.fromISO(event.end.dateTime).toUTC();
    
    // Проверяем, что событие попадает в рабочие часы
    if (eventStart >= workEndUtc || eventEnd <= workStartUtc) return;
    
    // Проверяем, что событие не в прошлом
    if (eventStart < minTime.toUTC()) return;
    
    // Округляем до начала часа для отображения
    const slotStart = eventStart.startOf('hour');
    const slotKey = slotStart.toISO();
    
    // Сохраняем информацию о занятом слоте
    if (!busyHoursMap.has(slotKey)) {
      busyHoursMap.set(slotKey, {
        startUtc: slotStart.toISO(),
        endUtc: slotStart.plus({ hours: 1 }).toISO(),
        busy: true,
        title: event.summary || 'Занято',
        source: 'google_calendar',
        originalStart: eventStart.toISO(),
        originalEnd: eventEnd.toISO(),
      });
    }
  });
  
  // ===== ОПТИМИЗАЦИЯ: Один запрос к БД вместо N запросов в цикле =====
  // Получаем все подтвержденные брони за рабочий день одной выборкой
  const dayBookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      // Брони, которые пересекаются с рабочим временем дня
      startUtc: { lt: workEndUtc.toJSDate() },
      endUtc: { gt: workStartUtc.toJSDate() },
    },
    select: {
      startUtc: true,
      endUtc: true,
    },
  });
  
  logger.debug({ 
    date, 
    bookingsCount: dayBookings.length,
    slotsToCheck: Math.ceil((workEndUtc.diff(workStartUtc, 'minutes').minutes) / config.workHours.slotDurationMinutes)
  }, 'Загружены брони из БД для проверки конфликтов');
  
  // Функция для проверки конфликта с бронированиями в памяти
  const hasDbConflict = (slotStart, slotEnd) => {
    return dayBookings.some(booking => {
      const bookingStart = DateTime.fromJSDate(booking.startUtc).toUTC();
      const bookingEnd = DateTime.fromJSDate(booking.endUtc).toUTC();
      // Проверяем пересечение интервалов
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
  };
  
  // Генерируем все рабочие часы (10:00-18:00 МСК, шаг 60 минут)
  // И возвращаем ТОЛЬКО свободные слоты
  const availableSlots = [];
  let current = workStart;
  
  while (current < workEnd) {
    const slotStart = current.toUTC();
    const slotEnd = current.plus({ minutes: config.workHours.slotDurationMinutes }).toUTC();
    const slotKey = slotStart.toISO();
    
    // Проверяем, что слот не в прошлом
    if (slotStart >= minTime.toUTC()) {
      // Проверяем, занят ли этот час в Google Calendar
      const busySlot = busyHoursMap.get(slotKey);
      
      // Пропускаем занятые слоты
      if (!busySlot) {
        // Проверяем конфликты в БД в памяти (без дополнительных запросов)
        if (!hasDbConflict(slotStart.toJSDate(), slotEnd.toJSDate())) {
          availableSlots.push({
            startUtc: slotStart.toISO(),
            endUtc: slotEnd.toISO(),
          });
        }
      }
    }
    
    current = current.plus({ minutes: config.workHours.slotDurationMinutes });
  }
  
  // Сортируем по времени
  availableSlots.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  
  return availableSlots;
}

/**
 * GET /api/availability
 * Получить доступные временные слоты с простым кешированием
 */
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          fields: { date: 'Не указана дата' } 
        } 
      });
    }
    
    // Валидация формата даты
    const dateMoscow = DateTime.fromISO(date).setZone('Europe/Moscow');
    if (!dateMoscow.isValid) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          fields: { date: 'Неверный формат даты' } 
        } 
      });
    }
    
    // ===== ПРОСТОЕ КЕШИРОВАНИЕ С КОРОТКИМ TTL =====
    const cacheKey = CACHE_CONFIG.getKey(date);
    
    // 1. Проверяем кеш
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      logger.info({ date, source: 'cache', ttl: CACHE_CONFIG.TTL }, 'Слоты получены из кеша');
      // Устанавливаем заголовки для предотвращения кеширования браузером
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      return res.json(cachedData);
    }
    
    // 2. Кеш пуст - генерируем данные
    logger.info({ date, source: 'google_calendar' }, 'Запрос слотов из Google Calendar (кеш пуст)');
    
    const availableSlots = await generateAvailabilitySlots(date);
    
    // Сохраняем в кеш
    await setCache(cacheKey, availableSlots, CACHE_CONFIG.TTL);
    
    logger.info({ date, slotsCount: availableSlots.length, ttl: CACHE_CONFIG.TTL }, 'Слоты получены и закешированы');
    
    // Устанавливаем заголовки для предотвращения кеширования браузером
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    
    res.json(availableSlots);
  } catch (error) {
    logger.error({ error }, 'Ошибка при получении доступности');
    res.status(503).json({ 
      error: { 
        code: 'SERVICE_UNAVAILABLE', 
        message: 'Ошибка при обращении к календарю' 
      } 
    });
  }
});

/**
 * GET /api/availability/dates
 * Получить список дат с доступностью
 */
router.get('/dates', async (req, res) => {
  try {
    const from = req.query.from || DateTime.now().setZone('Europe/Moscow').toISODate();
    const to = req.query.to || DateTime.now().setZone('Europe/Moscow').plus({ days: 30 }).toISODate();
    
    const dates = [];
    let current = DateTime.fromISO(from).setZone('Europe/Moscow');
    const endDate = DateTime.fromISO(to).setZone('Europe/Moscow');
    const today = DateTime.now().setZone('Europe/Moscow').startOf('day');
    
    while (current <= endDate) {
      const dateStr = current.toISODate();
      
      // Прошедшие даты неактивны
      if (current < today) {
        dates.push({ date: dateStr, hasAvailableSlots: false });
        current = current.plus({ days: 1 });
        continue;
      }
      
      // Проверка наличия свободных интервалов (упрощённая версия)
      const startOfDay = current.startOf('day').toUTC();
      const endOfDay = current.endOf('day').toUTC();
      
      try {
        const events = await getCalendarEvents(startOfDay.toJSDate(), endOfDay.toJSDate());
        const busyCount = events.length;
        
        // Максимум слотов в день (например, 10:00-18:00 с шагом 30 мин = 16 слотов)
        const maxSlots = ((18 - 10) * 60) / config.workHours.slotDurationMinutes;
        const hasAvailableSlots = busyCount < maxSlots;
        
        dates.push({ date: dateStr, hasAvailableSlots });
      } catch (error) {
        // При ошибке считаем дату недоступной
        logger.warn({ error, date: dateStr }, 'Ошибка при проверке доступности даты');
        dates.push({ date: dateStr, hasAvailableSlots: false });
      }
      
      current = current.plus({ days: 1 });
    }
    
    res.json({ dates });
  } catch (error) {
    logger.error({ error }, 'Ошибка при получении дат с доступностью');
    res.status(503).json({ 
      error: { 
        code: 'SERVICE_UNAVAILABLE', 
        message: 'Ошибка при обращении к календарю' 
      } 
    });
  }
});

export default router;

