import { google } from 'googleapis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

let calendarClient = null;

/**
 * Инициализация Google Calendar API клиента
 */
export function initGoogleCalendar() {
  try {
    let auth;
    
    // Используем Service Account, если доступен
    if (config.googleCalendar.serviceAccountEmail && config.googleCalendar.privateKey) {
      auth = new google.auth.JWT(
        config.googleCalendar.serviceAccountEmail,
        null,
        config.googleCalendar.privateKey,
        ['https://www.googleapis.com/auth/calendar']
      );
      logger.info('Google Calendar: инициализирован через Service Account');
    } 
    // Иначе используем OAuth 2.0
    else if (config.googleCalendar.clientId && config.googleCalendar.clientSecret) {
      const oauth2Client = new google.auth.OAuth2(
        config.googleCalendar.clientId,
        config.googleCalendar.clientSecret
      );
      
      if (config.googleCalendar.refreshToken) {
        oauth2Client.setCredentials({
          refresh_token: config.googleCalendar.refreshToken,
        });
      }
      
      auth = oauth2Client;
      logger.info('Google Calendar: инициализирован через OAuth 2.0');
    } else {
      logger.warn('Google Calendar credentials not configured, calendar features will be disabled');
      return null;
    }
    
    calendarClient = google.calendar({ version: 'v3', auth });
    return calendarClient;
  } catch (error) {
    logger.error({ error }, 'Ошибка при инициализации Google Calendar');
    // Не прерываем запуск, если Google Calendar не настроен
    return null;
  }
}

/**
 * Получить клиент Google Calendar
 */
export function getCalendarClient() {
  if (!calendarClient) {
    calendarClient = initGoogleCalendar();
  }
  return calendarClient;
}

/**
 * Получить события из календаря за период
 */
export async function getCalendarEvents(timeMin, timeMax) {
  try {
    const calendar = getCalendarClient();
    if (!calendar) {
      logger.warn('Google Calendar не инициализирован, возвращаем пустой список событий');
      return [];
    }
    
    // Конвертация в Date, если передан объект DateTime
    const timeMinDate = timeMin instanceof Date ? timeMin : new Date(timeMin);
    const timeMaxDate = timeMax instanceof Date ? timeMax : new Date(timeMax);
    
    const response = await calendar.events.list({
      calendarId: config.googleCalendar.calendarId,
      timeMin: timeMinDate.toISOString(),
      timeMax: timeMaxDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    return response.data.items || [];
  } catch (error) {
    logger.error({ error, timeMin, timeMax }, 'Ошибка при получении событий из Google Calendar');
    throw error;
  }
}

/**
 * Создать событие в календаре
 * Возвращает null, если календарь не инициализирован (для режима разработки)
 */
export async function createCalendarEvent(summary, description, startTime, endTime) {
  try {
    const calendar = getCalendarClient();
    if (!calendar) {
      logger.warn('Google Calendar не инициализирован, пропускаем создание события');
      return null;
    }
    
    // Конвертация в Date, если передан объект DateTime
    const startTimeDate = startTime instanceof Date ? startTime : new Date(startTime);
    const endTimeDate = endTime instanceof Date ? endTime : new Date(endTime);
    
    const response = await calendar.events.insert({
      calendarId: config.googleCalendar.calendarId,
      requestBody: {
        summary,
        description,
        start: {
          dateTime: startTimeDate.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTimeDate.toISOString(),
          timeZone: 'UTC',
        },
      },
    });
    
    return response.data;
  } catch (error) {
    logger.error({ error }, 'Ошибка при создании события в Google Calendar');
    // В режиме разработки не прерываем выполнение, если календарь не настроен
    if (config.nodeEnv === 'development') {
      logger.warn('Продолжаем работу без создания события в календаре');
      return null;
    }
    throw error;
  }
}

/**
 * Удалить событие из календаря
 */
export async function deleteCalendarEvent(eventId) {
  try {
    const calendar = getCalendarClient();
    if (!calendar) {
      logger.warn('Google Calendar не инициализирован, пропускаем удаление события');
      return false;
    }
    
    await calendar.events.delete({
      calendarId: config.googleCalendar.calendarId,
      eventId,
    });
    return true;
  } catch (error) {
    // Если событие уже удалено или не найдено, это не критично
    if (error.code === 404) {
      logger.warn({ eventId }, 'Событие не найдено в Google Calendar');
      return false;
    }
    logger.error({ error, eventId }, 'Ошибка при удалении события из Google Calendar');
    throw error;
  }
}

