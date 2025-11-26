import { DateTime } from 'luxon';

/**
 * Валидация email
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  // Упрощённая проверка RFC-5322
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Валидация Telegram username
 */
export function validateTelegram(telegram) {
  if (!telegram || typeof telegram !== 'string') {
    return false;
  }
  // Разрешаем @username или username (латиница/цифры/подчёркивания, 5-32 символов)
  const telegramRegex = /^@?[a-zA-Z0-9_]{5,32}$/;
  return telegramRegex.test(telegram.trim());
}

/**
 * Валидация даты
 */
export function validateDate(date) {
  if (!date || typeof date !== 'string') {
    return false;
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }
  const parsed = DateTime.fromISO(date);
  return parsed.isValid;
}

/**
 * Валидация данных бронирования
 */
export function validateBooking(data) {
  const errors = {};
  
  // Дата
  if (!data.date) {
    errors.date = 'Не выбрана дата';
  } else if (!validateDate(data.date)) {
    errors.date = 'Неверный формат даты';
  } else {
    const nowMoscow = DateTime.now().setZone('Europe/Moscow');
    const todayMoscow = nowMoscow.startOf('day');
    const selectedDate = DateTime.fromISO(data.date).setZone('Europe/Moscow').startOf('day');
    if (selectedDate < todayMoscow) {
      errors.date = 'Нельзя записаться на прошедшую дату';
    }
  }
  
  // Время начала и конца
  if (!data.startUtc) {
    errors.startUtc = 'Не выбран интервал';
  }
  if (!data.endUtc) {
    errors.endUtc = 'Не выбран интервал';
  }
  
  // Проверка соответствия даты и времени начала
  if (data.date && data.startUtc) {
    try {
      const startDate = DateTime.fromISO(data.startUtc).setZone('Europe/Moscow');
      const selectedDate = DateTime.fromISO(data.date).setZone('Europe/Moscow').startOf('day');
      if (!startDate.startOf('day').equals(selectedDate)) {
        errors.date = 'Дата не соответствует выбранному интервалу';
      }
    } catch (error) {
      errors.startUtc = 'Неверный формат времени';
    }
  }
  
  // Контакт
  if (!data.contactRaw || typeof data.contactRaw !== 'string' || !data.contactRaw.trim()) {
    errors.contactRaw = 'Укажите контакт для связи';
  } else {
    const contactType = data.contactType;
    if (!contactType || (contactType !== 'EMAIL' && contactType !== 'TELEGRAM')) {
      errors.contactRaw = 'Выберите тип контакта';
    } else if (contactType === 'EMAIL' && !validateEmail(data.contactRaw)) {
      errors.contactRaw = 'Неверный email';
    } else if (contactType === 'TELEGRAM' && !validateTelegram(data.contactRaw)) {
      errors.contactRaw = 'Неверный Telegram';
    }
  }
  
  // Согласие
  if (!data.consentPersonal) {
    errors.consentPersonal = 'Необходимо согласие на обработку персональных данных';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

