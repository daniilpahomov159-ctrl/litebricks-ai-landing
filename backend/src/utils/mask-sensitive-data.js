/**
 * Утилиты для маскирования чувствительных данных в логах
 */

/**
 * Маскирует email адрес
 * @param {string} email - email адрес
 * @returns {string} - замаскированный email (user@example.com → u***@e***.com)
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return '***';
  }

  const [localPart, domain] = email.split('@');
  
  if (!localPart || !domain) {
    // Если это не валидный email, маскируем полностью
    return '***@***';
  }

  // Маскируем локальную часть: оставляем первый символ, остальное заменяем на ***
  const maskedLocal = localPart.length > 1 
    ? `${localPart[0]}***` 
    : '***';
  
  // Маскируем домен: оставляем первый символ до точки, остальное заменяем
  const domainParts = domain.split('.');
  if (domainParts.length >= 2) {
    const maskedDomain = `${domainParts[0][0]}***.${domainParts[domainParts.length - 1]}`;
    return `${maskedLocal}@${maskedDomain}`;
  }
  
  // Если домен без точки, маскируем полностью
  return `${maskedLocal}@${domain[0]}***`;
}

/**
 * Маскирует Telegram username
 * @param {string} telegram - telegram username (с @ или без)
 * @returns {string} - замаскированный username (@username → @u******)
 */
export function maskTelegram(telegram) {
  if (!telegram || typeof telegram !== 'string') {
    return '***';
  }

  // Убираем @ если есть
  const username = telegram.startsWith('@') ? telegram.slice(1) : telegram;
  
  if (username.length === 0) {
    return '@***';
  }

  // Оставляем первый символ, остальное маскируем
  const masked = username.length > 1 
    ? `${username[0]}${'*'.repeat(Math.min(username.length - 1, 6))}`
    : '***';
  
  return `@${masked}`;
}

/**
 * Маскирует контактные данные в зависимости от типа
 * @param {string} contact - контактные данные
 * @param {string} contactType - тип контакта ('EMAIL' или 'TELEGRAM')
 * @returns {string} - замаскированные данные
 */
export function maskContact(contact, contactType) {
  if (!contact) {
    return '***';
  }

  if (contactType === 'EMAIL') {
    return maskEmail(contact);
  } else if (contactType === 'TELEGRAM') {
    return maskTelegram(contact);
  }

  // Если тип неизвестен, маскируем полностью
  return '***';
}

