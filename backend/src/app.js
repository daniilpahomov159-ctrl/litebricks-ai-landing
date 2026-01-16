import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initGoogleCalendar } from './utils/googleCalendar.js';
import { initRedis, closeRedis, isRedisConnected } from './utils/redis.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { bookingRateLimiter } from './middleware/rateLimiter.js';
import availabilityRouter from './routes/availability.js';
import bookingsRouter from './routes/bookings.js';
import { startRetentionJobs } from './jobs/retention.js';

const app = express();

// Security headers with Helmet
// Настройка для production и development
if (config.nodeEnv === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Для Remix/Vite в development
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://litebrick.ru"],
        frameAncestors: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'sameorigin' },
    noSniff: true,
    xssFilter: true,
  }));
} else {
  // Более мягкие настройки для development
  app.use(helmet({
    contentSecurityPolicy: false, // Отключаем CSP в development для удобства
    hsts: false, // Отключаем HSTS в development
  }));
}

// CORS настройки
const frontendUrl = process.env.FRONTEND_URL || (config.nodeEnv === 'production' ? 'https://litebrick.ru' : '*');
app.use(cors({
  origin: frontendUrl === '*' ? '*' : [frontendUrl, 'https://litebrick.ru', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Booking System API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      availability: '/api/availability',
      bookings: '/api/bookings',
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: isRedisConnected() ? 'connected' : 'disconnected',
  });
});

// API routes
app.use('/api/availability', availabilityRouter);
app.use('/api/bookings', bookingRateLimiter, bookingsRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Инициализация сервисов
async function start() {
  try {
    // Инициализация Redis
    const redisReady = await initRedis();
    if (redisReady) {
      logger.info('Redis инициализирован и готов к работе');
    } else {
      logger.warn('Redis недоступен, работаем без кеша');
    }
    
    // Инициализация Google Calendar
    initGoogleCalendar();
    
    // Запуск cron-джобов для retention
    startRetentionJobs();
    
    // Запуск сервера
    app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Server started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await closeRedis();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await closeRedis();
  process.exit(0);
});

start();

export default app;

