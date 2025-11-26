import dotenv from 'dotenv';
import { config } from './src/config/index.js';
import { initGoogleCalendar, getCalendarEvents, createCalendarEvent } from './src/utils/googleCalendar.js';
import { DateTime } from 'luxon';
import { logger } from './src/utils/logger.js';

dotenv.config();

async function testGoogleCalendar() {
  console.log('🔍 Проверка подключения к Google Calendar...\n');

  // Проверка конфигурации
  console.log('📋 Проверка конфигурации:');
  console.log(`   Calendar ID: ${config.googleCalendar.calendarId || 'не указан'}`);
  
  if (config.googleCalendar.serviceAccountEmail) {
    console.log(`   ✅ Service Account Email: ${config.googleCalendar.serviceAccountEmail}`);
    console.log(`   ✅ Private Key: ${config.googleCalendar.privateKey ? 'установлен' : 'не установлен'}`);
  } else if (config.googleCalendar.clientId) {
    console.log(`   ✅ OAuth Client ID: ${config.googleCalendar.clientId}`);
    console.log(`   ✅ OAuth Client Secret: ${config.googleCalendar.clientSecret ? 'установлен' : 'не установлен'}`);
    console.log(`   ✅ Refresh Token: ${config.googleCalendar.refreshToken ? 'установлен' : 'не установлен'}`);
  } else {
    console.log('   ❌ Google Calendar credentials не настроены');
    console.log('   Убедитесь, что в .env указаны либо Service Account, либо OAuth 2.0 credentials');
    process.exit(1);
  }

  console.log('\n🔐 Инициализация клиента...');
  
  try {
    const client = initGoogleCalendar();
    
    if (!client) {
      console.log('   ❌ Не удалось инициализировать клиент Google Calendar');
      process.exit(1);
    }
    
    console.log('   ✅ Клиент успешно инициализирован');

    // Тест 1: Получение списка календарей (опционально)
    console.log('\n📅 Тест 1: Получение информации о календаре...');
    try {
      const calendar = client;
      const calendarInfo = await calendar.calendars.get({
        calendarId: config.googleCalendar.calendarId,
      });
      console.log(`   ✅ Календарь найден: "${calendarInfo.data.summary || 'Без названия'}"`);
      console.log(`   📧 Email календаря: ${calendarInfo.data.id}`);
    } catch (error) {
      console.log(`   ❌ Ошибка при получении информации о календаре:`);
      console.log(`      ${error.message}`);
      if (error.code === 404) {
        console.log(`   💡 Совет: Проверьте, что Calendar ID правильный и календарь существует`);
      } else if (error.code === 403) {
        console.log(`   💡 Совет: Убедитесь, что Service Account имеет доступ к календарю`);
        console.log(`      Добавьте email Service Account в настройки календаря с правами "Управление событиями"`);
      }
      throw error;
    }

    // Тест 2: Получение событий за сегодня
    console.log('\n📆 Тест 2: Получение событий за сегодня...');
    try {
      const now = DateTime.now().setZone('UTC');
      const startOfDay = now.startOf('day');
      const endOfDay = now.endOf('day');
      
      const events = await getCalendarEvents(startOfDay.toJSDate(), endOfDay.toJSDate());
      console.log(`   ✅ Успешно получено событий: ${events.length}`);
      
      if (events.length > 0) {
        console.log(`   📝 Первые события:`);
        events.slice(0, 3).forEach((event, index) => {
          const start = event.start?.dateTime || event.start?.date;
          console.log(`      ${index + 1}. ${event.summary || 'Без названия'} (${start})`);
        });
      } else {
        console.log(`   ℹ️  Событий на сегодня нет`);
      }
    } catch (error) {
      console.log(`   ❌ Ошибка при получении событий:`);
      console.log(`      ${error.message}`);
      throw error;
    }

    // Тест 3: Создание тестового события
    console.log('\n✏️  Тест 3: Создание тестового события...');
    try {
      const testStart = DateTime.now().setZone('UTC').plus({ minutes: 5 });
      const testEnd = testStart.plus({ minutes: 30 });
      
      const testEvent = await createCalendarEvent(
        'Тестовое событие - проверка подключения',
        'Это тестовое событие создано для проверки подключения к Google Calendar API. Его можно удалить.',
        testStart.toJSDate(),
        testEnd.toJSDate()
      );
      
      console.log(`   ✅ Тестовое событие успешно создано!`);
      console.log(`   🔗 ID события: ${testEvent.id}`);
      console.log(`   📅 Время: ${testStart.toFormat('yyyy-MM-dd HH:mm')} UTC`);
      console.log(`   💡 Вы можете удалить это событие в Google Calendar`);
      console.log(`   💡 Или удалить через API, используя ID: ${testEvent.id}`);
    } catch (error) {
      console.log(`   ❌ Ошибка при создании события:`);
      console.log(`      ${error.message}`);
      if (error.code === 403) {
        console.log(`   💡 Совет: Убедитесь, что Service Account имеет права "Управление событиями"`);
      }
      throw error;
    }

    console.log('\n✅ Все тесты пройдены успешно!');
    console.log('🎉 Подключение к Google Calendar работает корректно!\n');
    
  } catch (error) {
    console.log('\n❌ Ошибка при проверке подключения:');
    console.log(`   ${error.message}`);
    if (error.response) {
      console.log(`   Статус: ${error.response.status}`);
      console.log(`   Данные: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

testGoogleCalendar();

