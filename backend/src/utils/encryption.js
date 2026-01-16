import crypto from 'crypto';
import { logger } from './logger.js';
import { config } from '../config/index.js';

/**
 * Сервис шифрования для чувствительных данных
 * Использует AES-256-GCM для симметричного шифрования
 */

// Валидация ключа шифрования при загрузке модуля
function validateEncryptionKey() {
  const key = config.encryption.key;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY не установлен в переменных окружения');
  }

  // Декодируем base64 ключ для проверки длины
  let keyBuffer;
  try {
    keyBuffer = Buffer.from(key, 'base64');
  } catch (error) {
    throw new Error('ENCRYPTION_KEY должен быть в формате base64');
  }

  // AES-256 требует 32 байта (256 бит)
  if (keyBuffer.length !== 32) {
    throw new Error(`ENCRYPTION_KEY должен быть 32 байта (256 бит) в base64, получено ${keyBuffer.length} байт`);
  }

  logger.info('Ключ шифрования успешно валидирован');
  return keyBuffer;
}

// Получаем ключ шифрования (валидируется при загрузке)
let encryptionKey;
try {
  encryptionKey = validateEncryptionKey();
} catch (error) {
  logger.error({ error: error.message }, 'Ошибка валидации ключа шифрования');
  throw error;
}

/**
 * Шифрует строку используя AES-256-GCM
 * @param {string} plaintext - текст для шифрования
 * @returns {string} - зашифрованная строка в формате: iv:authTag:encryptedData (все в base64)
 */
export function encryptField(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Поле для шифрования должно быть непустой строкой');
  }

  try {
    // Генерируем случайный IV (Initialization Vector) для каждого шифрования
    // 12 байт для GCM - рекомендуемый размер
    const iv = crypto.randomBytes(12);
    
    // Создаем cipher с AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    
    // Шифруем данные
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Получаем auth tag для аутентификации
    const authTag = cipher.getAuthTag();
    
    // Возвращаем в формате: iv:authTag:encryptedData (все в base64)
    const result = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    
    logger.debug('Поле успешно зашифровано');
    return result;
  } catch (error) {
    logger.error({ error }, 'Ошибка при шифровании поля');
    throw new Error('Не удалось зашифровать данные');
  }
}

/**
 * Дешифрует строку, зашифрованную с помощью encryptField
 * @param {string} encryptedData - зашифрованная строка в формате: iv:authTag:encryptedData
 * @returns {string} - расшифрованный текст
 */
export function decryptField(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Зашифрованные данные должны быть строкой');
  }

  try {
    // Разделяем строку на компоненты
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Неверный формат зашифрованных данных');
    }

    const [ivBase64, authTagBase64, encrypted] = parts;
    
    // Декодируем компоненты из base64
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    // Создаем decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    // Дешифруем данные
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    logger.debug('Поле успешно расшифровано');
    return decrypted;
  } catch (error) {
    logger.error({ error }, 'Ошибка при дешифровании поля');
    
    // Если это ошибка аутентификации (неверный ключ или поврежденные данные)
    if (error.message.includes('Unsupported state') || error.message.includes('bad decrypt')) {
      throw new Error('Не удалось расшифровать данные: возможно, данные повреждены или используется неверный ключ');
    }
    
    throw new Error('Не удалось расшифровать данные');
  }
}

/**
 * Проверяет, является ли строка зашифрованными данными
 * @param {string} data - данные для проверки
 * @returns {boolean}
 */
export function isEncrypted(data) {
  if (!data || typeof data !== 'string') {
    return false;
  }
  
  // Проверяем формат: iv:authTag:encryptedData (3 части, разделенные :)
  const parts = data.split(':');
  if (parts.length !== 3) {
    return false;
  }
  
  // Проверяем, что все части являются валидным base64
  try {
    parts.forEach(part => {
      Buffer.from(part, 'base64');
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Генерирует новый ключ шифрования (для первоначальной настройки)
 * @returns {string} - ключ в base64 формате (32 байта)
 */
export function generateEncryptionKey() {
  const key = crypto.randomBytes(32);
  return key.toString('base64');
}

