import cron from 'node-cron';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { deleteCalendarEvent } from '../utils/googleCalendar.js';

/**
 * Удаление прошедших броней через указанное время после завершения
 * Удаляет записи со всеми данными сразу, без анонимизации
 */
async function deletePastBookings() {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() - config.retention.pastBookingMinutes * 60 * 1000);
    
    // Найти все прошедшие брони, которые нужно удалить
    const bookings = await prisma.booking.findMany({
      where: {
        endUtc: { lt: threshold },
        status: 'CONFIRMED',
      },
    });
    
    for (const booking of bookings) {
      try {
        // Сохранить данные для AuditLog и кэша перед удалением
        const bookingId = booking.id;
        const bookingDate = booking.date.toISOString().split('T')[0];
        const metadata = {
          endUtc: booking.endUtc.toISOString(),
          date: bookingDate,
          deletedAt: now.toISOString(),
        };
        
        // Удалить событие из Google Calendar перед удалением брони из БД
        if (booking.googleEventId) {
          try {
            await deleteCalendarEvent(booking.googleEventId);
            logger.debug({ 
              bookingId, 
              googleEventId: booking.googleEventId 
            }, 'Событие удалено из Google Calendar при автоматическом удалении брони');
          } catch (error) {
            // Если событие уже удалено или не найдено (404) - это нормально
            if (error.code === 404) {
              logger.debug({ 
                bookingId, 
                googleEventId: booking.googleEventId 
              }, 'Событие уже было удалено из Google Calendar');
            } else {
              logger.warn({ 
                error, 
                bookingId,
                googleEventId: booking.googleEventId 
              }, 'Ошибка при удалении события из Google Calendar (продолжаем удаление брони)');
            }
            // Не прерываем выполнение, если не удалось удалить событие
          }
        }
        
        // Удалить запись брони
        await prisma.booking.delete({
          where: { id: bookingId },
        });
        
        // Создать запись в AuditLog после удаления (bookingId = null, чтобы избежать CASCADE)
        await prisma.auditLog.create({
          data: {
            action: 'BOOKING_PURGED',
            bookingId: null, // null, так как запись уже удалена
            metadata: metadata, // без ПДн
          },
        });
      } catch (error) {
        logger.error({ error, bookingId: booking.id }, 'Ошибка при удалении брони');
      }
    }
    
    if (bookings.length > 0) {
      logger.info({ count: bookings.length }, 'Удалено прошедших броней');
    }
  } catch (error) {
    logger.error({ error }, 'Ошибка при удалении прошедших броней');
  }
}

/**
 * Запуск cron-джоба для удаления прошедших броней
 */
export function startRetentionJobs() {
  // Удаление прошедших броней ежедневно в 02:00 UTC
  cron.schedule('0 2 * * *', deletePastBookings);
  logger.info(`Retention job: удаление прошедших броней запущено (ежедневно в 02:00 UTC, через ${config.retention.pastBookingMinutes} минут после завершения)`);
  
  // Запуск сразу при старте в development режиме (для тестирования)
  if (process.env.NODE_ENV === 'development') {
    logger.info('Запуск удаления прошедших броней при старте (development mode)');
    deletePastBookings();
  }
}

