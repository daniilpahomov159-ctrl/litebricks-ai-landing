/**
 * Тестовый скрипт для проверки Google Calendar API
 * Запуск: node test-calendar.js
 */

import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const keyFile = './google-key.json';
const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

console.log('=== ДИАГНОСТИКА GOOGLE CALENDAR ===\n');

// 1. Проверка файла ключа
console.log('1. Проверка файла ключа:');
if (fs.existsSync(keyFile)) {
  const keyData = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  console.log('   ✓ Файл google-key.json найден');
  console.log(`   - Project ID: ${keyData.project_id}`);
  console.log(`   - Client Email: ${keyData.client_email}`);
  console.log(`   - Private Key ID: ${keyData.private_key_id}`);
  console.log(`   - Private Key начинается с: ${keyData.private_key?.substring(0, 50)}...`);
} else {
  console.log('   ✗ Файл google-key.json НЕ найден!');
  process.exit(1);
}

// 2. Проверка Calendar ID
console.log('\n2. Calendar ID из .env:');
console.log(`   ${calendarId}`);

// 3. Инициализация клиента
console.log('\n3. Инициализация Google Calendar клиента...');
let auth;
try {
  auth = new google.auth.GoogleAuth({
    keyFile: keyFile,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  console.log('   ✓ Клиент создан');
} catch (e) {
  console.log('   ✗ Ошибка создания клиента:', e.message);
  process.exit(1);
}

const calendar = google.calendar({ version: 'v3', auth });

// 4. Проверка доступа к календарю
console.log('\n4. Проверка доступа к календарю...');
try {
  const calInfo = await calendar.calendars.get({
    calendarId: calendarId,
  });
  console.log('   ✓ Доступ к календарю ЕСТЬ!');
  console.log(`   - Название: ${calInfo.data.summary}`);
  console.log(`   - Timezone: ${calInfo.data.timeZone}`);
  console.log(`   - ID: ${calInfo.data.id}`);
} catch (e) {
  console.log('   ✗ ОШИБКА доступа к календарю!');
  console.log(`   - Код ошибки: ${e.code}`);
  console.log(`   - Сообщение: ${e.message}`);
  if (e.code === 404) {
    console.log('\n   ⚠️  КАЛЕНДАРЬ НЕ НАЙДЕН!');
    console.log('   Проверьте правильность Calendar ID');
  }
  if (e.code === 403) {
    console.log('\n   ⚠️  НЕТ ПРАВ ДОСТУПА!');
    console.log('   Service Account не имеет доступа к этому календарю.');
    console.log(`   Добавьте ${(JSON.parse(fs.readFileSync(keyFile, 'utf8'))).client_email} в настройках календаря.`);
  }
  process.exit(1);
}

// 5. Получение списка событий
console.log('\n5. Получение событий за ближайшие 7 дней...');
try {
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const events = await calendar.events.list({
    calendarId: calendarId,
    timeMin: now.toISOString(),
    timeMax: week.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  console.log(`   ✓ Найдено событий: ${events.data.items?.length || 0}`);
  if (events.data.items?.length > 0) {
    console.log('\n   Список событий:');
    events.data.items.forEach((event, i) => {
      const start = event.start.dateTime || event.start.date;
      console.log(`   ${i + 1}. [${start}] ${event.summary} (ID: ${event.id})`);
    });
  }
} catch (e) {
  console.log('   ✗ Ошибка получения событий:', e.message);
}

// 6. Тестовое создание события
console.log('\n6. Создание тестового события...');
try {
  const startTime = new Date();
  startTime.setDate(startTime.getDate() + 2); // через 2 дня
  startTime.setHours(14, 0, 0, 0);
  
  const endTime = new Date(startTime);
  endTime.setHours(15, 0, 0, 0);
  
  const testEvent = await calendar.events.insert({
    calendarId: calendarId,
    requestBody: {
      summary: 'ТЕСТ - Консультация (можно удалить)',
      description: 'Тестовое событие для проверки интеграции',
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Europe/Moscow',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Europe/Moscow',
      },
    },
  });
  
  console.log('   ✓ СОБЫТИЕ УСПЕШНО СОЗДАНО!');
  console.log(`   - Event ID: ${testEvent.data.id}`);
  console.log(`   - HTML Link: ${testEvent.data.htmlLink}`);
  console.log(`\n   👆 Перейдите по ссылке выше, чтобы увидеть событие!`);
} catch (e) {
  console.log('   ✗ ОШИБКА создания события!');
  console.log(`   - Код: ${e.code}`);
  console.log(`   - Сообщение: ${e.message}`);
  if (e.errors) {
    console.log('   - Детали:', JSON.stringify(e.errors, null, 2));
  }
}

console.log('\n=== ДИАГНОСТИКА ЗАВЕРШЕНА ===\n');



