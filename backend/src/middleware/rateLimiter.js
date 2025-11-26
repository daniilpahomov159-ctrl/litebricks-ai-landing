import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Rate limiter для создания броней
 * Настраивается через переменные окружения:
 * - RATE_LIMIT_MAX - максимальное количество запросов (по умолчанию: 100 для dev, 5 для prod)
 * - RATE_LIMIT_WINDOW_MS - окно времени в миллисекундах (по умолчанию: 1 час)
 */
export const bookingRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Слишком много запросов. Попробуйте позже.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ 
      ip: req.ip, 
      path: req.path,
      limit: config.rateLimit.max,
      windowMs: config.rateLimit.windowMs,
    }, 'Rate limit exceeded');
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Слишком много запросов. Попробуйте позже.',
      },
    });
  },
});

