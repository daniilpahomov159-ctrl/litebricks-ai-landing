import express from 'express';
import { DateTime } from 'luxon';
import { validateBooking } from '../middleware/validation.js';
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent } from '../utils/googleCalendar.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { sendTelegramNotification } from '../utils/telegram.js';

const router = express.Router();

/**
 * POST /api/bookings
 * Создать новую бронь
 */
router.post('/', async (req, res, next) => {
  const { date, startUtc, endUtc, contactRaw, contactType, consentPersonal, marketingConsent } = req.body;
  
  // Валидация
  const validation = validateBooking({ date, startUtc, endUtc, contactRaw, contactType, consentPersonal });
  if (!validation.isValid) {
    return res.status(400).json({ 
      error: { 
        code: 'VALIDATION_ERROR', 
        fields: validation.errors 
      } 
    });
  }
  
  try {
    // ===== РАБОТА С ВРЕМЕНЕМ В МОСКОВСКОМ ЧАСОВОМ ПОЯСЕ (UTC+3) =====
    // 1. Фронтенд отправляет время в UTC (например: 10:00 МСК → 07:00 UTC)
    // 2. Бэкенд сохраняет в БД в UTC (стандарт PostgreSQL)
    // 3. При чтении из БД конвертируем обратно в московское время для отображения
    
    // Парсим входящее UTC время
    const startTime = DateTime.fromISO(startUtc, { zone: 'utc' });
    const endTime = DateTime.fromISO(endUtc, { zone: 'utc' });
    
    // Проверяем, что время корректно распарсилось
    if (!startTime.isValid || !endTime.isValid) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Неверный формат времени' 
        } 
      });
    }
    
    // Конвертируем в московское время для логирования и проверок
    const startMoscow = startTime.setZone('Europe/Moscow');
    const endMoscow = endTime.setZone('Europe/Moscow');
    
    logger.info({
      requestedTime: {
        moscow: `${startMoscow.toFormat('yyyy-MM-dd HH:mm')} МСК`,
        utc: startTime.toISO(),
      }
    }, 'Создание брони');
    
    // Конвертация строки даты в Date объект (только дата, без времени)
    // Дата интерпретируется в московском часовом поясе
    const dateMoscow = DateTime.fromISO(date, { zone: 'Europe/Moscow' }).startOf('day');
    const dateObj = dateMoscow.toUTC().toJSDate();
    
    // Проверка доступности в Google Calendar
    const events = await getCalendarEvents(startTime.toJSDate(), endTime.toJSDate());
    if (events.length > 0) {
      return res.status(409).json({ 
        error: { 
          code: 'CONFLICT', 
          message: 'Интервал уже занят в календаре' 
        } 
      });
    }
    
    // Проверка в БД
    const dbConflict = await prisma.booking.findFirst({
      where: {
        date: dateObj,
        status: 'CONFIRMED',
        startUtc: { lt: endTime.toJSDate() },
        endUtc: { gt: startTime.toJSDate() },
      },
    });
    
    if (dbConflict) {
      return res.status(409).json({ 
        error: { 
          code: 'CONFLICT', 
          message: 'Интервал уже занят' 
        } 
      });
    }
    
    // Создание события в Google Calendar (опционально)
    const eventTitle = 'Консультация';
    const eventDescription = `Контакт: ${contactType === 'EMAIL' ? 'Email' : 'Telegram'} ${contactRaw}`;
    
    let googleEventId = null;
    try {
      const googleEvent = await createCalendarEvent(
        eventTitle,
        eventDescription,
        startTime.toJSDate(),
        endTime.toJSDate()
      );
      if (googleEvent) {
        googleEventId = googleEvent.id;
        logger.info({ googleEventId }, 'Событие создано в Google Calendar');
      } else {
        logger.info('Google Calendar не настроен, бронь создается без события в календаре');
      }
    } catch (error) {
      // В режиме разработки продолжаем работу без Google Calendar
      logger.warn({ error }, 'Не удалось создать событие в Google Calendar, продолжаем без него');
    }
    
    // ===== СОХРАНЕНИЕ В БАЗУ ДАННЫХ =====
    // Сохраняем время в UTC (стандарт PostgreSQL и лучшая практика)
    // Пример: пользователь выбрал 10:00 МСК → сохраняется 07:00 UTC
    // При чтении из БД фронтенд/бэкенд конвертирует обратно в МСК
    
    const booking = await prisma.booking.create({
      data: {
        date: dateObj, // Дата в UTC (начало дня по московскому времени)
        startUtc: startTime.toJSDate(), // Время начала в UTC (10:00 МСК → 07:00 UTC)
        endUtc: endTime.toJSDate(), // Время окончания в UTC (11:00 МСК → 08:00 UTC)
        contactRaw,
        contactType,
        consentPersonal,
        status: 'CONFIRMED',
        googleEventId, // Может быть null, если Google Calendar не настроен
      },
    });
    
    // Логируем созданную бронь с московским временем для удобства
    logger.info({
      bookingId: booking.id,
      time: `${startMoscow.toFormat('yyyy-MM-dd HH:mm')} - ${endMoscow.toFormat('HH:mm')} МСК`,
      contact: contactRaw,
    }, 'Бронь успешно создана');
    
    // Создание записи в AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'BOOKING_CREATED',
        bookingId: booking.id,
        metadata: {
          endUtc: booking.endUtc.toISOString(),
          date: booking.date.toISOString().split('T')[0],
          status: 'CONFIRMED',
        },
      },
    });
    
    // Уведомление в Telegram
    try {
      await sendTelegramNotification(booking, contactRaw, contactType);
    } catch (error) {
      logger.warn({ error }, 'Ошибка при отправке уведомления в Telegram');
    }
    
    res.status(201).json(booking);
  } catch (error) {
    if (error.code === 409) {
      return res.status(409).json({ 
        error: { 
          code: 'CONFLICT', 
          message: 'Интервал уже занят' 
        } 
      });
    }
    
    logger.error({ error }, 'Ошибка при создании брони');
    next(error);
  }
});

/**
 * GET /api/bookings/by-contact
 * Получить активную бронь по контакту (email или telegram)
 */
router.get('/by-contact', async (req, res, next) => {
  try {
    const { contact } = req.query;
    
    if (!contact) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Не указан контакт' 
        } 
      });
    }
    
    // Поиск активной (не отменённой) брони по контакту
    const booking = await prisma.booking.findFirst({
      where: {
        contactRaw: contact,
        status: 'CONFIRMED',
        endUtc: { gt: new Date() }, // только будущие брони
      },
      orderBy: {
        startUtc: 'asc', // самая ближайшая
      },
    });
    
    if (!booking) {
      return res.status(404).json({ 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Активная бронь не найдена' 
        } 
      });
    }
    
    res.json(booking);
  } catch (error) {
    logger.error({ error }, 'Ошибка при получении брони по контакту');
    next(error);
  }
});

/**
 * GET /api/bookings/:id
 * Получить бронь по ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const booking = await prisma.booking.findUnique({
      where: { id },
    });
    
    if (!booking) {
      return res.status(404).json({ 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Бронь не найдена' 
        } 
      });
    }
    
    res.json(booking);
  } catch (error) {
    logger.error({ error }, 'Ошибка при получении брони');
    next(error);
  }
});

/**
 * PATCH /api/bookings/:id/status
 * Изменить статус брони (отмена)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (status !== 'CANCELLED') {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Можно только отменить бронь' 
        } 
      });
    }
    
    const booking = await prisma.booking.findUnique({ 
      where: { id } 
    });
    
    if (!booking) {
      return res.status(404).json({ 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Бронь не найдена' 
        } 
      });
    }
    
    // Обновление статуса в БД
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    
    // Удаление события из Google Calendar (только если событие ещё не прошло)
    const now = new Date();
    if (booking.googleEventId && booking.endUtc > now) {
      try {
        await deleteCalendarEvent(booking.googleEventId);
      } catch (error) {
        logger.warn({ error, googleEventId: booking.googleEventId }, 'Ошибка при удалении события из Google Calendar');
      }
    } else if (booking.googleEventId && booking.endUtc <= now) {
      logger.info({ bookingId: booking.id, endUtc: booking.endUtc }, 'Событие уже прошло, не удаляем из Google Calendar');
    }
    
    // Создание записи в AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'BOOKING_CANCELLED',
        bookingId: booking.id,
        metadata: {
          endUtc: booking.endUtc.toISOString(),
          date: booking.date.toISOString().split('T')[0],
          status: 'CANCELLED',
        },
      },
    });
    
    res.json(updatedBooking);
  } catch (error) {
    logger.error({ error }, 'Ошибка при отмене брони');
    next(error);
  }
});

export default router;

