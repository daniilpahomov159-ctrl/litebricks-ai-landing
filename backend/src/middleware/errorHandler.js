import { logger } from '../utils/logger.js';

/**
 * Middleware для обработки ошибок
 */
export function errorHandler(err, req, res, next) {
  logger.error({ 
    error: err, 
    path: req.path, 
    method: req.method,
    body: req.body 
  }, 'Request error');
  
  // Ошибки валидации
  if (err.name === 'ValidationError' || err.status === 400) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message || 'Ошибка валидации',
        fields: err.fields || {},
      },
    });
  }
  
  // Конфликты
  if (err.status === 409) {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: err.message || 'Конфликт данных',
      },
    });
  }
  
  // Не найдено
  if (err.status === 404) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: err.message || 'Ресурс не найден',
      },
    });
  }
  
  // Внутренняя ошибка сервера
  res.status(err.status || 500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Внутренняя ошибка сервера' 
        : err.message,
    },
  });
}

/**
 * Middleware для обработки 404
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

