/**
 * Тесты безопасности и шифрования
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encryptField, decryptField, isEncrypted, generateEncryptionKey } from '../utils/encryption.js';
import { maskEmail, maskTelegram, maskContact } from '../utils/mask-sensitive-data.js';

describe('Шифрование данных', () => {
  // Генерируем тестовый ключ
  const testKey = generateEncryptionKey();
  
  beforeAll(() => {
    // Устанавливаем тестовый ключ в переменные окружения
    process.env.ENCRYPTION_KEY = testKey;
  });

  afterAll(() => {
    // Очищаем переменные окружения
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encryptField и decryptField', () => {
    it('должен зашифровать и расшифровать строку', () => {
      const plaintext = 'test@example.com';
      const encrypted = encryptField(plaintext);
      const decrypted = decryptField(encrypted);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('должен создавать разные зашифрованные значения для одного текста (из-за IV)', () => {
      const plaintext = 'test@example.com';
      const encrypted1 = encryptField(plaintext);
      const encrypted2 = encryptField(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      // Но оба должны расшифровываться в один текст
      expect(decryptField(encrypted1)).toBe(plaintext);
      expect(decryptField(encrypted2)).toBe(plaintext);
    });

    it('должен обрабатывать длинные строки', () => {
      const longText = 'a'.repeat(1000);
      const encrypted = encryptField(longText);
      const decrypted = decryptField(encrypted);

      expect(decrypted).toBe(longText);
    });

    it('должен обрабатывать специальные символы', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptField(specialChars);
      const decrypted = decryptField(encrypted);

      expect(decrypted).toBe(specialChars);
    });

    it('должен выбрасывать ошибку при попытке расшифровать неверные данные', () => {
      const invalidData = 'not:encrypted:data';
      
      expect(() => {
        decryptField(invalidData);
      }).toThrow();
    });

    it('должен выбрасывать ошибку при пустой строке', () => {
      expect(() => {
        encryptField('');
      }).toThrow();
    });

    it('должен выбрасывать ошибку при null/undefined', () => {
      expect(() => {
        encryptField(null);
      }).toThrow();

      expect(() => {
        encryptField(undefined);
      }).toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('должен определять зашифрованные данные', () => {
      const plaintext = 'test@example.com';
      const encrypted = encryptField(plaintext);

      expect(isEncrypted(encrypted)).toBe(true);
      expect(isEncrypted(plaintext)).toBe(false);
    });

    it('должен возвращать false для невалидных данных', () => {
      expect(isEncrypted('')).toBe(false);
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted('not:encrypted')).toBe(false);
    });
  });

  describe('generateEncryptionKey', () => {
    it('должен генерировать валидный ключ в base64', () => {
      const key = generateEncryptionKey();
      
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      
      // Проверяем, что это валидный base64
      const buffer = Buffer.from(key, 'base64');
      expect(buffer.length).toBe(32); // 32 байта для AES-256
    });

    it('должен генерировать разные ключи при каждом вызове', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1).not.toBe(key2);
    });
  });
});

describe('Маскирование чувствительных данных', () => {
  describe('maskEmail', () => {
    it('должен маскировать email адрес', () => {
      const email = 'user@example.com';
      const masked = maskEmail(email);
      
      expect(masked).toContain('@');
      expect(masked).not.toBe(email);
      expect(masked).toMatch(/u\*\*\*@e\*\*\*\.com/);
    });

    it('должен обрабатывать короткие email', () => {
      const email = 'a@b.co';
      const masked = maskEmail(email);
      
      expect(masked).toBeDefined();
      expect(masked).toContain('@');
    });

    it('должен обрабатывать null/undefined', () => {
      expect(maskEmail(null)).toBe('***');
      expect(maskEmail(undefined)).toBe('***');
    });
  });

  describe('maskTelegram', () => {
    it('должен маскировать telegram username с @', () => {
      const telegram = '@username';
      const masked = maskTelegram(telegram);
      
      expect(masked).toMatch(/^@u\*+/);
      expect(masked).not.toBe(telegram);
    });

    it('должен маскировать telegram username без @', () => {
      const telegram = 'username';
      const masked = maskTelegram(telegram);
      
      expect(masked).toMatch(/^@u\*+/);
    });

    it('должен обрабатывать короткие username', () => {
      const telegram = '@ab';
      const masked = maskTelegram(telegram);
      
      expect(masked).toBeDefined();
      expect(masked).toContain('@');
    });

    it('должен обрабатывать null/undefined', () => {
      expect(maskTelegram(null)).toBe('***');
      expect(maskTelegram(undefined)).toBe('***');
    });
  });

  describe('maskContact', () => {
    it('должен маскировать email контакт', () => {
      const contact = 'user@example.com';
      const masked = maskContact(contact, 'EMAIL');
      
      expect(masked).toContain('@');
      expect(masked).not.toBe(contact);
    });

    it('должен маскировать telegram контакт', () => {
      const contact = '@username';
      const masked = maskContact(contact, 'TELEGRAM');
      
      expect(masked).toMatch(/^@/);
      expect(masked).not.toBe(contact);
    });

    it('должен обрабатывать неизвестный тип', () => {
      const contact = 'somecontact';
      const masked = maskContact(contact, 'UNKNOWN');
      
      expect(masked).toBe('***');
    });
  });
});

describe('Интеграционные тесты шифрования', () => {
  const testKey = generateEncryptionKey();
  
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = testKey;
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it('должен корректно работать с реальными email адресами', () => {
    const emails = [
      'user@example.com',
      'test.user@domain.co.uk',
      'very.long.email.address@very.long.domain.name.com',
    ];

    emails.forEach(email => {
      const encrypted = encryptField(email);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(email);
    });
  });

  it('должен корректно работать с telegram username', () => {
    const usernames = [
      '@username',
      'username',
      '@very_long_username_123',
    ];

    usernames.forEach(username => {
      const encrypted = encryptField(username);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(username);
    });
  });
});

