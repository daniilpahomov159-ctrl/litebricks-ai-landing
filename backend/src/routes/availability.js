import express from 'express';
import { DateTime } from 'luxon';
import { getCalendarEvents } from '../utils/googleCalendar.js';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/availability
 * Получить все временные слоты (свободные и занятые) из Google Calendar по рабочему времени
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
    
    // ===== РАБОТА С МОСКОВСКИМ ЧАСОВЫМ ПОЯСОМ (UTC+3) =====
    const dateMoscow = DateTime.fromISO(date).setZone('Europe/Moscow');
    if (!dateMoscow.isValid) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          fields: { date: 'Неверный формат даты' } 
        } 
      });
    }
    
    // ===== СТАРОЕ РЕШЕНИЕ (закомментировано) =====
    // Генерировало только свободные слоты на основе проверки занятости
    /*
    // Диапазон дня в московском времени, конвертированный в UTC для запросов
    const startOfDay = dateMoscow.startOf('day').toUTC();
    const endOfDay = dateMoscow.endOf('day').toUTC();
    
    // Получение событий из Google Calendar
    const events = await getCalendarEvents(startOfDay.toJSDate(), endOfDay.toJSDate());
    const busyIntervals = events.map(event => ({
      start: DateTime.fromISO(event.start.dateTime || event.start.date).toUTC(),
      end: DateTime.fromISO(event.end.dateTime || event.end.date).toUTC(),
    }));
    
    // Генерация возможных интервалов (10:00-18:00 МСК, шаг 60 минут)
    const [workStartHour, workStartMinute] = config.workHours.start.split(':').map(Number);
    const [workEndHour, workEndMinute] = config.workHours.end.split(':').map(Number);
    
    const workStart = dateMoscow.set({ hour: workStartHour, minute: workStartMinute, second: 0 });
    const workEnd = dateMoscow.set({ hour: workEndHour, minute: workEndMinute, second: 0 });
    const nowMoscow = DateTime.now().setZone('Europe/Moscow');
    const minTime = nowMoscow.plus({ hours: config.workHours.minAdvanceHours });
    
    const slots = [];
    let current = workStart;
    
    while (current < workEnd) {
      const slotStart = current.toUTC();
      const slotEnd = current.plus({ minutes: config.workHours.slotDurationMinutes }).toUTC();
      
      if (slotStart >= minTime.toUTC()) {
        const isBusy = busyIntervals.some(busy => 
          slotStart < busy.end && slotEnd > busy.start
        );
        
        const dateStr = dateMoscow.toISODate();
        const dateObj = new Date(dateStr + 'T00:00:00.000Z');
        
        const dbConflict = await prisma.booking.findFirst({
          where: {
            date: dateObj,
            status: 'CONFIRMED',
            startUtc: { lt: slotEnd.toJSDate() },
            endUtc: { gt: slotStart.toJSDate() },
          },
        });
        
        if (!isBusy && !dbConflict) {
          slots.push({
            startUtc: slotStart.toISO(),
            endUtc: slotEnd.toISO(),
          });
        }
      }
      
      current = current.plus({ minutes: config.workHours.slotDurationMinutes });
    }
    
    res.json(slots);
    */
    
    // ===== НОВОЕ РЕШЕНИЕ: ПОКАЗ ВРЕМЕНИ ИЗ GOOGLE CALENDAR =====
    // Генерируем все рабочие часы и помечаем занятые из Google Calendar
    
    // Определяем рабочие часы в московском времени
    const [workStartHour, workStartMinute] = config.workHours.start.split(':').map(Number);
    const [workEndHour, workEndMinute] = config.workHours.end.split(':').map(Number);
    
    const workStart = dateMoscow.set({ hour: workStartHour, minute: workStartMinute, second: 0 }); // 10:00 МСК
    const workEnd = dateMoscow.set({ hour: workEndHour, minute: workEndMinute, second: 0 }); // 18:00 МСК
    
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
    
    // Генерируем все рабочие часы (10:00-18:00 МСК, шаг 60 минут)
    // И возвращаем ТОЛЬКО свободные слоты
    const availableSlots = [];
    let current = workStart;
    
    // Дата для проверки конфликтов в БД
    const dateStr = dateMoscow.toISODate();
    const dateObj = new Date(dateStr + 'T00:00:00.000Z');
    
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
          // Проверяем конфликты в БД
          const dbConflict = await prisma.booking.findFirst({
            where: {
              date: dateObj,
              status: 'CONFIRMED',
              startUtc: { lt: slotEnd.toJSDate() },
              endUtc: { gt: slotStart.toJSDate() },
            },
          });
          
          // Добавляем только свободные слоты (без конфликтов в Google Calendar и БД)
          if (!dbConflict) {
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
    
    // Возвращаем только свободные слоты
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

