import { createClient } from 'redis';
import { logger } from './logger.js';
import { config } from '../config/index.js';

let redisClient = null;

/**
 * Инициализация Redis клиента
 */
export async function initRedis() {
  try {
    // Формируем URL подключения с учетом пароля и TLS
    let redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    
    // Если указан пароль, добавляем его в URL
    if (config.redis.password) {
      // Парсим существующий URL и добавляем пароль
      const url = new URL(redisUrl);
      url.password = config.redis.password;
      redisUrl = url.toString();
    }
    
    // Настройки подключения
    const clientOptions = {
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: превышено количество попыток переподключения');
            return new Error('Превышен лимит переподключений к Redis');
          }
          // Экспоненциальная задержка: 100ms, 200ms, 400ms, ..., максимум 3000ms
          return Math.min(retries * 100, 3000);
        }
      }
    };
    
    // Настройка TLS для production
    if (config.redis.tls) {
      clientOptions.socket.tls = true;
      clientOptions.socket.rejectUnauthorized = false; // Для self-signed сертификатов
      logger.info('Redis: TLS подключение включено');
    }
    
    redisClient = createClient(clientOptions);

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis Client Error');
    });

    redisClient.on('connect', () => {
      logger.info('Redis: подключено');
    });

    redisClient.on('ready', () => {
      logger.info('Redis: готов к работе');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis: переподключение...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error({ error }, 'Не удалось подключиться к Redis');
    // Не падаем, если Redis недоступен - работаем без кеша
    return null;
  }
}

/**
 * Получить значение из кеша
 * @param {string} key - ключ кеша
 * @returns {Promise<any|null>} - значение или null, если не найдено
 */
export async function getCache(key) {
  if (!redisClient || !redisClient.isOpen) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (value) {
      logger.debug({ key }, 'Redis: cache HIT');
      return JSON.parse(value);
    }
    logger.debug({ key }, 'Redis: cache MISS');
    return null;
  } catch (error) {
    logger.error({ error, key }, 'Ошибка чтения из Redis');
    return null;
  }
}

/**
 * Сохранить значение в кеш
 * @param {string} key - ключ
 * @param {any} value - значение (будет сериализовано в JSON)
 * @param {number} ttlSeconds - время жизни в секундах
 * @returns {Promise<boolean>} - true если успешно, false если ошибка
 */
export async function setCache(key, value, ttlSeconds = 300) {
  if (!redisClient || !redisClient.isOpen) {
    return false;
  }

  try {
    await redisClient.setEx(
      key,
      ttlSeconds,
      JSON.stringify(value)
    );
    logger.debug({ key, ttl: ttlSeconds }, 'Redis: значение сохранено');
    return true;
  } catch (error) {
    logger.error({ error, key }, 'Ошибка записи в Redis');
    return false;
  }
}

/**
 * Удалить ключ из кеша
 * @param {string} key - ключ для удаления
 * @returns {Promise<number>} - количество удаленных ключей (1 если успешно, 0 если ключ не существовал)
 */
export async function deleteCache(key) {
  if (!redisClient || !redisClient.isOpen) {
    logger.warn({ key }, 'Redis: не подключен, не могу удалить ключ');
    return 0;
  }

  try {
    const result = await redisClient.del(key);
    logger.info({ key, deleted: result }, 'Redis: попытка удаления ключа');
    return result;
  } catch (error) {
    logger.error({ error, key }, 'Ошибка удаления из Redis');
    return 0;
  }
}

/**
 * Очистить все ключи по паттерну
 * @param {string} pattern - паттерн для поиска (например, "availability:*")
 * @returns {Promise<boolean>} - true если успешно
 */
export async function clearCacheByPattern(pattern) {
  if (!redisClient || !redisClient.isOpen) {
    return false;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info({ pattern, count: keys.length }, 'Redis: ключи очищены по паттерну');
    }
    return true;
  } catch (error) {
    logger.error({ error, pattern }, 'Ошибка очистки кеша по паттерну');
    return false;
  }
}

/**
 * Проверить, подключен ли Redis
 * @returns {boolean}
 */
export function isRedisConnected() {
  return redisClient !== null && redisClient.isOpen;
}

/**
 * Закрыть соединение с Redis
 */
export async function closeRedis() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis: соединение закрыто');
  }
}

export { redisClient };

