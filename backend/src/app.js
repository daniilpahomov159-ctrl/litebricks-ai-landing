import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initGoogleCalendar } from './utils/googleCalendar.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { bookingRateLimiter } from './middleware/rateLimiter.js';
import availabilityRouter from './routes/availability.js';
import bookingsRouter from './routes/bookings.js';
import { startRetentionJobs } from './jobs/retention.js';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
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
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

start();

export default app;

