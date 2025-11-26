import { DateTime } from 'luxon';
import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Отправить уведомление в Telegram о новой брони
 */
export async function sendTelegramNotification(booking, contactRaw, contactType) {
  if (!config.telegram.botToken || !config.telegram.chatId) {
    logger.warn('Telegram credentials not configured, skipping notification');
    return;
  }
  
  try {
    const startTimeMoscow = DateTime.fromJSDate(booking.startUtc)
      .setZone('Europe/Moscow')
      .toFormat('dd.MM.yyyy HH:mm');
    
    const endTimeMoscow = DateTime.fromJSDate(booking.endUtc)
      .setZone('Europe/Moscow')
      .toFormat('HH:mm');
    
    const contactLabel = contactType === 'EMAIL' ? 'Email' : 'Telegram';
    
    const message = `📅 Новая запись на консультацию\n\n` +
      `⏰ Время: ${startTimeMoscow} - ${endTimeMoscow} (МСК)\n` +
      `📧 ${contactLabel}: ${contactRaw}\n` +
      `🆔 ID брони: ${booking.id}`;
    
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text: message,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
    }
    
    logger.info({ bookingId: booking.id }, 'Telegram notification sent');
  } catch (error) {
    logger.error({ error, bookingId: booking.id }, 'Ошибка при отправке уведомления в Telegram');
    throw error;
  }
}

