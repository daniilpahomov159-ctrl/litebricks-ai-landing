import express from 'express';
import { DateTime } from 'luxon';
import { validateBooking } from '../middleware/validation.js';
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent } from '../utils/googleCalendar.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { sendTelegramNotification } from '../utils/telegram.js';
import { deleteCache } from '../utils/redis.js';
import { encryptField, decryptField } from '../utils/encryption.js';
import { maskContact } from '../utils/mask-sensitive-data.js';

const router = express.Router();

/**
 * Инвалидация кеша доступности для даты
 * Удаляет кеш для указанной даты
 * @param {string|Date} date - дата в формате строки YYYY-MM-DD или Date объект
 */
async function invalidateAvailabilityCache(date) {
  let dateStr;
  
  if (typeof date === 'string') {
    // Если это строка, проверяем формат и нормализуем
    const parsed = DateTime.fromISO(date, { zone: 'Europe/Moscow' });
    if (!parsed.isValid) {
      logger.warn({ date }, 'Неверный формат даты при инвалидации кеша');
      return;
    }
    dateStr = parsed.toISODate(); // Формат: "2026-01-17"
  } else {
    // Если это Date объект, конвертируем в строку
    dateStr = DateTime.fromJSDate(date).setZone('Europe/Moscow').toISODate();
  }
  
  if (!dateStr) {
    logger.warn({ date }, 'Не удалось преобразовать дату для инвалидации кеша');
    return;
  }
  
  const cacheKey = `availability:${dateStr}`;
  
  logger.info({ 
    date: dateStr, 
    cacheKey 
  }, 'Инвалидация кеша доступности');
  
  const deleted = await deleteCache(cacheKey);
  
  logger.info({ 
    date: dateStr, 
    deleted: deleted > 0 
  }, 'Кеш доступности инвалидирован');
}

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
    
    // Используем строку даты в формате YYYY-MM-DD (как в запросе availability)
    const dateStr = dateMoscow.toISODate(); // Формат: "2026-01-17"
    
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
    
    // ИНВАЛИДАЦИЯ КЕША ПОСЛЕ ПРОВЕРКИ КОНФЛИКТОВ, НО ДО СОЗДАНИЯ БРОНИ
    // Это предотвращает race condition: если другой пользователь запросит доступность
    // после инвалидации, он получит актуальные данные из БД
    try {
      await invalidateAvailabilityCache(dateStr);
      logger.info({ date: dateStr }, 'Кеш инвалидирован перед созданием брони');
    } catch (error) {
      logger.warn({ error, date: dateStr }, 'Ошибка при инвалидации кеша (не критично)');
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
    
    // Шифруем чувствительные данные перед сохранением
    const contactRawEncrypted = contactRaw ? encryptField(contactRaw) : null;
    
    const booking = await prisma.booking.create({
      data: {
        date: dateObj, // Дата в UTC (начало дня по московскому времени)
        startUtc: startTime.toJSDate(), // Время начала в UTC (10:00 МСК → 07:00 UTC)
        endUtc: endTime.toJSDate(), // Время окончания в UTC (11:00 МСК → 08:00 UTC)
        contactRawEncrypted, // Сохраняем зашифрованные данные
        encryptionVersion: 1, // Версия шифрования
        contactType,
        consentPersonal,
        status: 'CONFIRMED',
        googleEventId, // Может быть null, если Google Calendar не настроен
      },
    });
    
    // Логируем созданную бронь с московским временем для удобства
    // ВАЖНО: не логируем незашифрованные данные, только замаскированные
    logger.info({
      bookingId: booking.id,
      time: `${startMoscow.toFormat('yyyy-MM-dd HH:mm')} - ${endMoscow.toFormat('HH:mm')} МСК`,
      contact: maskContact(contactRaw, contactType), // Маскируем для логов
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
    // Передаем расшифрованные данные для уведомления (они нужны для отправки)
    try {
      await sendTelegramNotification(booking, contactRaw, contactType);
    } catch (error) {
      logger.warn({ error }, 'Ошибка при отправке уведомления в Telegram');
    }
    
    // Кеш уже инвалидирован перед созданием брони
    // Повторная инвалидация не требуется при простом кешировании
    
    // Возвращаем бронь с расшифрованными данными для клиента
    // (в production можно вернуть только замаскированные данные)
    const bookingResponse = {
      ...booking,
      contactRaw: contactRaw, // Возвращаем расшифрованные данные клиенту
      contactRawEncrypted: undefined, // Не возвращаем зашифрованные данные
    };
    
    res.status(201).json(bookingResponse);
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
    // Ищем по зашифрованному полю (новые записи) или по старому полю (для обратной совместимости)
    const contactEncrypted = encryptField(contact);
    
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { contactRawEncrypted: contactEncrypted }, // Новые зашифрованные записи
          { contactRaw: contact }, // Старые незашифрованные записи (для миграции)
        ],
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
    
    // Расшифровываем данные перед отправкой клиенту
    let decryptedContact = null;
    if (booking.contactRawEncrypted) {
      try {
        decryptedContact = decryptField(booking.contactRawEncrypted);
      } catch (error) {
        logger.error({ error, bookingId: booking.id }, 'Ошибка при расшифровке контакта');
        // Если не удалось расшифровать, используем старое поле (для обратной совместимости)
        decryptedContact = booking.contactRaw;
      }
    } else {
      // Старые записи без шифрования
      decryptedContact = booking.contactRaw;
    }
    
    const bookingResponse = {
      ...booking,
      contactRaw: decryptedContact,
      contactRawEncrypted: undefined, // Не возвращаем зашифрованные данные
    };
    
    res.json(bookingResponse);
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
    
    // Расшифровываем данные перед отправкой клиенту
    let decryptedContact = null;
    if (booking.contactRawEncrypted) {
      try {
        decryptedContact = decryptField(booking.contactRawEncrypted);
      } catch (error) {
        logger.error({ error, bookingId: booking.id }, 'Ошибка при расшифровке контакта');
        // Если не удалось расшифровать, используем старое поле (для обратной совместимости)
        decryptedContact = booking.contactRaw;
      }
    } else {
      // Старые записи без шифрования
      decryptedContact = booking.contactRaw;
    }
    
    const bookingResponse = {
      ...booking,
      contactRaw: decryptedContact,
      contactRawEncrypted: undefined, // Не возвращаем зашифрованные данные
    };
    
    res.json(bookingResponse);
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
    
    // Удаление события из Google Calendar при отмене бронирования
    // Удаляем всегда, независимо от того, прошло событие или нет
    if (booking.googleEventId) {
      try {
        await deleteCalendarEvent(booking.googleEventId);
        logger.info({ 
          bookingId: booking.id, 
          googleEventId: booking.googleEventId,
          endUtc: booking.endUtc 
        }, 'Событие удалено из Google Calendar при отмене брони');
      } catch (error) {
        // Если событие уже удалено или не найдено (404) - это нормально
        if (error.code === 404) {
          logger.info({ 
            bookingId: booking.id, 
            googleEventId: booking.googleEventId 
          }, 'Событие уже было удалено из Google Calendar');
        } else {
          logger.warn({ 
            error, 
            bookingId: booking.id,
            googleEventId: booking.googleEventId 
          }, 'Ошибка при удалении события из Google Calendar (продолжаем работу)');
        }
        // Не прерываем выполнение, если не удалось удалить событие
      }
    } else {
      logger.debug({ bookingId: booking.id }, 'Бронь не имела события в Google Calendar');
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
    
    // Инвалидация кеша доступности для даты брони
    try {
      await invalidateAvailabilityCache(booking.date);
    } catch (error) {
      logger.warn({ error, date: booking.date }, 'Ошибка при инвалидации кеша (не критично)');
    }
    
    res.json(updatedBooking);
  } catch (error) {
    logger.error({ error }, 'Ошибка при отмене брони');
    next(error);
  }
});

export default router;

