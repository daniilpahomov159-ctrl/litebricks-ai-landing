/**
 * Скрипт миграции для шифрования существующих данных contactRaw
 * 
 * Использование:
 *   node src/scripts/migrate-encrypt-data.js
 * 
 * ВАЖНО: Перед запуском убедитесь, что:
 * 1. ENCRYPTION_KEY установлен в переменных окружения
 * 2. Создан бэкап базы данных
 * 3. Приложение остановлено (или работает в режиме только чтения)
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { prisma } from '../utils/prisma.js';
import { encryptField, isEncrypted } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

// Настройка пути для загрузки .env файла
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

/**
 * Миграция данных: шифрование существующих записей contactRaw
 */
async function migrateEncryptData() {
  try {
    logger.info('Начало миграции: шифрование contactRaw');

    // Проверяем наличие ключа шифрования
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY не установлен в переменных окружения');
    }

    // Получаем все записи с незашифрованными данными
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { contactRaw: { not: null } }, // Есть незашифрованные данные
          { contactRawEncrypted: null }, // Нет зашифрованных данных
        ],
      },
      select: {
        id: true,
        contactRaw: true,
        contactRawEncrypted: true,
        contactType: true,
      },
    });

    logger.info({ count: bookings.length }, 'Найдено записей для миграции');

    if (bookings.length === 0) {
      logger.info('Нет записей для миграции');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Обрабатываем каждую запись
    for (const booking of bookings) {
      try {
        // Пропускаем записи, которые уже зашифрованы
        if (booking.contactRawEncrypted && isEncrypted(booking.contactRawEncrypted)) {
          logger.debug({ bookingId: booking.id }, 'Запись уже зашифрована, пропускаем');
          continue;
        }

        // Пропускаем записи без контакта
        if (!booking.contactRaw) {
          logger.debug({ bookingId: booking.id }, 'Запись без контакта, пропускаем');
          continue;
        }

        // Шифруем данные
        const encrypted = encryptField(booking.contactRaw);

        // Обновляем запись в БД
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            contactRawEncrypted: encrypted,
            encryptionVersion: 1,
            // Оставляем contactRaw для обратной совместимости (можно удалить позже)
          },
        });

        successCount++;
        logger.debug({ bookingId: booking.id }, 'Запись успешно зашифрована');
      } catch (error) {
        errorCount++;
        const errorInfo = {
          bookingId: booking.id,
          error: error.message,
        };
        errors.push(errorInfo);
        logger.error(errorInfo, 'Ошибка при шифровании записи');
      }
    }

    // Итоговая статистика
    logger.info({
      total: bookings.length,
      success: successCount,
      errors: errorCount,
      skipped: bookings.length - successCount - errorCount,
    }, 'Миграция завершена');

    if (errors.length > 0) {
      logger.warn({ errors }, 'Ошибки при миграции (см. детали выше)');
      console.error('\nОшибки миграции:');
      errors.forEach(err => {
        console.error(`  - Booking ID ${err.bookingId}: ${err.error}`);
      });
    }

    // Проверка целостности: проверяем, что все записи с contactRaw имеют contactRawEncrypted
    const unencryptedCount = await prisma.booking.count({
      where: {
        contactRaw: { not: null },
        contactRawEncrypted: null,
      },
    });

    if (unencryptedCount > 0) {
      logger.warn({ count: unencryptedCount }, 'Обнаружены незашифрованные записи после миграции');
    } else {
      logger.info('Все записи успешно зашифрованы');
    }

  } catch (error) {
    logger.error({ error }, 'Критическая ошибка при миграции');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Проверка целостности данных после миграции
 */
async function verifyMigration() {
  try {
    logger.info('Проверка целостности данных после миграции');

    // Проверяем записи с contactRaw но без contactRawEncrypted
    const unencrypted = await prisma.booking.findMany({
      where: {
        contactRaw: { not: null },
        contactRawEncrypted: null,
      },
      select: {
        id: true,
        contactRaw: true,
      },
      take: 10, // Берем только первые 10 для примера
    });

    if (unencrypted.length > 0) {
      logger.warn({ count: unencrypted.length }, 'Обнаружены незашифрованные записи');
      return false;
    }

    logger.info('Проверка целостности пройдена успешно');
    return true;
  } catch (error) {
    logger.error({ error }, 'Ошибка при проверке целостности');
    return false;
  }
}

// Запуск миграции
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateEncryptData()
    .then(() => {
      logger.info('Миграция завершена успешно');
      return verifyMigration();
    })
    .then((isValid) => {
      if (isValid) {
        process.exit(0);
      } else {
        logger.error('Проверка целостности не пройдена');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error({ error }, 'Миграция завершилась с ошибкой');
      process.exit(1);
    });
}

export { migrateEncryptData, verifyMigration };

