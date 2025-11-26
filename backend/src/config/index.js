import dotenv from 'dotenv';

dotenv.config();

// Определяем режим работы для использования в конфигурации
const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Timezone
  timezone: process.env.TIMEZONE || 'Europe/Moscow',
  
  // Google Calendar
  googleCalendar: {
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
  
  // Work hours (Europe/Moscow)
  workHours: {
    start: process.env.WORK_HOURS_START || '10:00',
    end: process.env.WORK_HOURS_END || '18:00',
    slotDurationMinutes: parseInt(process.env.SLOT_DURATION_MINUTES || '60', 10),
    minAdvanceHours: parseInt(process.env.MIN_ADVANCE_HOURS || '2', 10),
  },
  
  // Retention - удаление прошедших броней через указанное время
  retention: {
    pastBookingMinutes: parseInt(process.env.RETENTION_PAST_BOOKING_MINUTES || '60', 10),
  },
  
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  
  // Rate limiting
  rateLimit: {
    // Для development: 100 запросов в час, для production: 5 запросов в час
    max: parseInt(process.env.RATE_LIMIT_MAX || (nodeEnv === 'development' ? '100' : '5'), 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 час по умолчанию
  },
};

  // Валидация обязательных переменных
if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

// Google Calendar credentials опциональны (можно настроить позже)
// if (!config.googleCalendar.serviceAccountEmail && !config.googleCalendar.clientId) {
//   throw new Error('Either GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_CLIENT_ID is required');
// }

