## План разработки backend для записи на консультации (Node.js + PostgreSQL + Google Calendar)

Цель: реализовать сервер, который интегрируется с Google Calendar для получения свободного времени и создания записей на консультации. Позволяет пользователям записываться на консультации без ручного подтверждения (если интервал свободен в Google Calendar), возвращает только свободные окна из календаря, валидирует контактные данные (Email/Telegram), требует согласие на обработку данных и возвращает понятные ошибки для отображения на фронтенде (ошибочные поля должны быть подсвечены цветом `#F97316`). Виджет календаря на фронтенде показывает неактивными прошедшие дни и дни без свободных окон. Все вычисления вести в часовом поясе Москвы.

### 1) Технологический стек
- Язык/рантайм: Node.js LTS (18+)
- Веб‑фреймворк: Express.js
- БД: PostgreSQL 13+
- ORM: Prisma (миграции, типы, удобные запросы)
- Google Calendar API: `googleapis` (официальная библиотека Google)
- Аутентификация Google: OAuth 2.0 (Service Account или OAuth для пользователя)
- Cron-джобы: `node-cron` или `node-schedule` (для retention процессов)
- Кэш/блокировки (опционально для нагрузки): Redis
- Тесты: Vitest/Jest + supertest
- Логирование: pino
- Документация API: OpenAPI (swagger-ui-express)
- Временные зоны/даты: `luxon` или `date-fns-tz` (хранить в UTC, вычислять в Europe/Moscow)

### 2) Модель данных (PostgreSQL + Prisma)

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  // Храним только то, что пользователь ввёл для связи
  email         String?  @unique
  telegram      String?  @unique
  // Нерегистрация — заявки анонимные, id связаны с Booking
  bookings      Booking[]
}

// Модель AvailabilitySlot удалена — используем Google Calendar как источник истины
// Опционально можно оставить для кэширования, но это не обязательно

model Booking {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  // Дата бронирования (Europe/Moscow, хранится как Date без времени для группировки)
  date            DateTime @db.Date
  // Период встречи (равен периоду слота)
  startUtc        DateTime
  endUtc          DateTime
  // Контакты и согласия
  contactRaw      String?  // email или @telegram (nullable после анонимизации)
  contactType     ContactType?
  consentPersonal Boolean  @default(false) // согласие на обработку ПД (false после анонимизации)
  // Статус
  status          BookingStatus @default(CONFIRMED) // авто‑подтверждение
  // Связи
  userId          String?
  user            User?        @relation(fields: [userId], references: [id])
  // ID события в Google Calendar (для синхронизации и отмены)
  googleEventId   String?      @unique
  // Retention (поля оставлены для обратной совместимости, но не используются)
  anonymizedAt    DateTime?    // не используется (записи удаляются сразу)
  purgedAt        DateTime?     // не используется (записи удаляются сразу)
  // Защитные индексы от пересечения броней в одном интервале и для поиска по дате
  @@index([date])
  @@index([date, status])
  @@index([startUtc, endUtc])
  @@index([date, startUtc, endUtc])
  @@index([anonymizedAt])
  @@index([purgedAt])
  @@index([endUtc, anonymizedAt]) // для поиска прошедших неанонимизированных броней
}

model AuditLog {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  // Тип операции
  action          AuditAction
  // Связь с бронированием (опционально, может быть null для системных операций)
  bookingId       String?
  booking         Booking? @relation(fields: [bookingId], references: [id], onDelete: CASCADE)
  // Метаданные операции (без ПДн)
  metadata        Json?    // дополнительные данные операции (без персональных данных)
  // Индексы для поиска
  @@index([createdAt])
  @@index([action])
  @@index([bookingId])
}

enum BookingStatus {
  CONFIRMED // бронь подтверждена сразу
  CANCELLED // отменена
}

enum ContactType {
  EMAIL
  TELEGRAM
}

enum AuditAction {
  BOOKING_CREATED      // создание брони
  BOOKING_CANCELLED    // отмена брони
  BOOKING_PURGED       // удаление прошедшей брони
  RETENTION_RUN        // запуск retention процесса
}
```

Примечания:
- Все времена храним в UTC. Фронтенд показывает локально, а все вычисления на бэкенде выполняем в зоне Europe/Moscow; перед записью переводим в UTC.
- Поле `date` хранится как Date (без времени) и используется для группировки бронирований по датам. Дата всегда интерпретируется в часовом поясе Europe/Moscow.
- **Источник доступности — Google Calendar**: свободные интервалы получаем из Google Calendar API, анализируя занятые события. Свободными считаются интервалы, не занятые событиями в календаре.
- **Создание записей в Google Calendar**: при успешном бронировании создаём событие в Google Calendar с информацией о клиенте (контакт, время консультации).
- **Синхронизация**: поле `googleEventId` хранит ID события в Google Calendar для возможности отмены/обновления через API.
- **Кэширование**: опционально кэшировать свободные интервалы в Redis на 1-2 минуты для снижения нагрузки на Google Calendar API.

### 3) Валидация данных на backend

- Contact (одно из): 
  - Email: RFC‑5322 упрощённая проверка RegExp, плюс нормализация строки.
  - Telegram: разрешить `@username` (латиница/цифры/подчёркивания, 5–32 символов); без пробелов; опционально без `@`.
- consentPersonal: true (обязателен).
- date: обязательное поле в формате `YYYY-MM-DD` (дата в Europe/Moscow). Должна быть валидной датой, не в прошлом относительно текущей даты в Europe/Moscow (можно разрешить сегодня, если есть свободные интервалы).
- Обязательные поля: `date`, `startUtc`, `endUtc`, `contactRaw`, `contactType`, `consentPersonal`.
- Проверка пересечений бронирований:
  - Перед созданием брони проверять через Google Calendar API, что интервал свободен (нет событий в указанное время).
  - Дополнительно проверять в БД, что нет `CONFIRMED` брони на этот интервал (редкие гонки).
  - Фильтрация по полю `date` ускоряет проверку и исключает конфликты между разными датами.
  - Возможен advisory lock (Redis/pg_advisory_lock) для защиты от одновременных запросов на один интервал.
- Ограничение частоты (anti‑spam): rate‑limit по IP/контакту на создание заявок (например, 5/час).

Возврат ошибок (для фронта подсветить `#F97316`):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "date": "Не выбрана дата",
      "contactRaw": "Неверный email/Telegram",
      "consentPersonal": "Необходимо согласие",
      "startUtc": "Не выбран интервал"
    }
  }
}
```

### 4) API (черновик)

Базовый префикс: `/api`

- GET `/availability`
  - Параметры: `date=YYYY-MM-DD` (московская дата, обязательный).
  - Ответ: массив свободных интервалов (UTC) для указанной даты.
  - Логика:
    - Работать в Europe/Moscow.
    - Получить события из Google Calendar за указанную дату.
    - Вычислить свободные интервалы (по умолчанию рабочие часы 10:00-18:00 МСК, шаг 30 минут).
    - Исключить интервалы, занятые событиями в Google Calendar.
    - Исключить интервалы, пересекающиеся с `CONFIRMED` бронями в БД (дополнительная защита).
    - Не предлагать интервалы, начинающиеся раньше чем через 2 часа от текущего времени (Europe/Moscow).
    - Кэшировать результат в Redis на 1-2 минуты (ключ `availability:YYYY-MM-DD`).

- GET `/availability/dates`
  - Параметры: `from=YYYY-MM-DD&to=YYYY-MM-DD` (диапазон дат, опционально, по умолчанию следующие 30 дней).
  - Ответ: объект с датами и их статусом доступности:
    ```json
    {
      "dates": [
        { "date": "2025-01-01", "hasAvailableSlots": true },
        { "date": "2025-01-02", "hasAvailableSlots": false },
        { "date": "2025-01-03", "hasAvailableSlots": true }
      ]
    }
    ```
  - Логика:
    - Для каждой даты проверять наличие свободных интервалов через Google Calendar.
    - Прошедшие даты помечать как `hasAvailableSlots: false`.
    - Даты без свободных окон помечать как `hasAvailableSlots: false` (для неактивности в виджете календаря).
    - Кэшировать результат на 5-10 минут.

- POST `/bookings`
  - Тело:
    ```json
    {
      "date": "2025-01-01",
      "startUtc": "2025-01-01T10:00:00Z",
      "endUtc": "2025-01-01T10:30:00Z",
      "contactRaw": "user@example.com",
      "contactType": "EMAIL",
      "consentPersonal": true
    }
    ```
  - Ответ: `201 Created` + объект брони (статус `CONFIRMED`, `googleEventId`).
  - Валидации: см. раздел 3. Поле `date` обязательно, должно соответствовать дате из `startUtc` (в Europe/Moscow).
  - Логика:
    1. Проверить через Google Calendar API, что интервал свободен.
    2. Проверить в БД, что нет `CONFIRMED` брони на этот интервал.
    3. Создать событие в Google Calendar с названием "Консультация", описанием (контакт клиента), временем.
    4. Сохранить бронь в БД со статусом `CONFIRMED` и `googleEventId`.
    5. Создать запись в `AuditLog` с action `BOOKING_CREATED` (без ПДн в metadata).
    6. Отправить уведомление в Telegram.
  - Конкурентность: advisory lock (Redis) на интервал; при редкой гонке — `409 CONFLICT`.
  - Ошибки:
    - `409 CONFLICT` — интервал уже занят в Google Calendar или БД.
    - `503 SERVICE_UNAVAILABLE` — ошибка при обращении к Google Calendar API.

- GET `/bookings/:id`
  - Ответ: бронь (включая `googleEventId`).

- PATCH `/bookings/:id/status`
  - Тело: `{ "status": "CANCELLED" }` — отмена (подтверждение не требуется).
  - Логика:
    - Обновить статус в БД на `CANCELLED`.
    - Удалить событие из Google Calendar по `googleEventId` **только если событие ещё не прошло** (endUtc > now в UTC). Для прошедших событий ничего не удаляем из Google Calendar.
    - Очистить кэш доступности для даты брони.
    - Создать запись в AuditLog с action `BOOKING_CANCELLED`.

### 5) Алгоритм получения свободных интервалов из Google Calendar

1. Получить дату `date` (обязательный параметр) в формате `YYYY-MM-DD` (Europe/Moscow).
2. Определить рабочие часы для даты (по умолчанию 10:00-18:00 МСК, можно настраивать).
3. Получить события из Google Calendar за указанную дату:
   - Конвертировать дату в диапазон UTC (начало и конец дня в Europe/Moscow).
   - Запросить события через Google Calendar API: `calendar.events.list()` с параметрами `timeMin`, `timeMax`, `calendarId`.
4. Вычислить занятые интервалы из событий Google Calendar.
5. Сгенерировать возможные интервалы (шаг 30 минут) в рабочих часах.
6. Отфильтровать интервалы:
   - Исключить пересекающиеся с событиями из Google Calendar.
   - Исключить пересекающиеся с `CONFIRMED` бронями в БД (дополнительная защита).
   - Исключить интервалы, начинающиеся раньше чем через 2 часа от текущего времени (Europe/Moscow).
7. Вернуть массив свободных интервалов (UTC) для указанной даты.

Для производительности:
- Кэшировать результат в Redis на 1-2 минуты (ключ `availability:YYYY-MM-DD`).
- Кэшировать список дат с доступностью на 5-10 минут (ключ `availability:dates:YYYY-MM-DD:YYYY-MM-DD`).
- Использовать индексы в БД по `date`, `startUtc`, `endUtc` для быстрой проверки конфликтов.

### 5.1) Интеграция с Google Calendar API

**Настройка аутентификации:**
- Вариант 1 (рекомендуется): Service Account — для серверного доступа к календарю.
- Вариант 2: OAuth 2.0 — для доступа к календарю пользователя (требует авторизации).

**Необходимые разрешения (scopes):**
- `https://www.googleapis.com/auth/calendar` — чтение и запись событий.

**Основные операции:**
- `calendar.events.list()` — получить события за период.
- `calendar.events.insert()` — создать событие (бронь).
- `calendar.events.delete()` — удалить событие (отмена брони).

**Обработка ошибок:**
- Rate limiting: Google Calendar API имеет лимиты (по умолчанию 1000 запросов/100 секунд на пользователя).
- Retry с экспоненциальной задержкой при временных ошибках.
- Логирование ошибок для мониторинга.

### 6) Безопасность и приватность
- CORS (разрешить домен фронта).
- Rate‑limit на маршруты `/bookings`.
- Санитизация пользовательских строк (escape, trim).
- Согласие на обработку ПД — обязательно сохранять (boolean).
- Срок хранения ПД — параметризуемый (cron на очистку старых/отменённых броней).

### 7) Настройка окружения

`.env`:
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PORT=3001
LOG_LEVEL=info
REDIS_URL=redis://localhost:6379  # опционально
TIMEZONE=Europe/Moscow

# Google Calendar интеграция
GOOGLE_CALENDAR_ID=primary  # или email календаря
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# Или для OAuth 2.0:
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token

# Рабочие часы (Europe/Moscow)
WORK_HOURS_START=10:00
WORK_HOURS_END=18:00
SLOT_DURATION_MINUTES=30
MIN_ADVANCE_HOURS=2  # минимальное время до записи (часов)

# Retention политика (все времена в UTC)
RETENTION_PAST_BOOKING_MINUTES=60  # через сколько минут после endUtc удалять запись со всеми данными
```

### 8) Пример обработчиков (псевдо‑Express)

```js
// Инициализация Google Calendar API
const { google } = require('googleapis');
const { DateTime } = require('luxon');

const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/calendar']
);

const calendar = google.calendar({ version: 'v3', auth });
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// GET /api/availability
app.get('/api/availability', async (req, res) => {
  const { date } = req.query;
  
  if (!date) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', fields: { date: 'Не указана дата' } } });
  }

  // Проверка кэша
  const cacheKey = `availability:${date}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  try {
    // Конвертация даты в UTC диапазон
    const dateMoscow = DateTime.fromISO(date).setZone('Europe/Moscow');
    const startOfDay = dateMoscow.startOf('day').toUTC();
    const endOfDay = dateMoscow.endOf('day').toUTC();

    // Получение событий из Google Calendar
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startOfDay.toISO(),
      timeMax: endOfDay.toISO(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    const busyIntervals = events.map(event => ({
      start: DateTime.fromISO(event.start.dateTime || event.start.date).toUTC(),
      end: DateTime.fromISO(event.end.dateTime || event.end.date).toUTC(),
    }));

    // Генерация возможных интервалов (10:00-18:00 МСК, шаг 30 минут)
    const workStart = dateMoscow.set({ hour: 10, minute: 0, second: 0 });
    const workEnd = dateMoscow.set({ hour: 18, minute: 0, second: 0 });
    const nowMoscow = DateTime.now().setZone('Europe/Moscow');
    const minTime = nowMoscow.plus({ hours: 2 }); // минимум за 2 часа

    const slots = [];
    let current = workStart;
    while (current < workEnd) {
      const slotStart = current.toUTC();
      const slotEnd = current.plus({ minutes: 30 }).toUTC();

      // Проверка, что слот не в прошлом
      if (slotStart >= minTime.toUTC()) {
        // Проверка пересечения с занятыми интервалами
        const isBusy = busyIntervals.some(busy => 
          (slotStart < busy.end && slotEnd > busy.start)
        );

        // Дополнительная проверка в БД
        const dbConflict = await prisma.booking.findFirst({
          where: {
            date: dateMoscow.toISODate(),
            status: 'CONFIRMED',
            startUtc: { lt: slotEnd.toJSDate() },
            endUtc: { gt: slotStart.toJSDate() },
          },
        });

        if (!isBusy && !dbConflict) {
          slots.push({
            startUtc: slotStart.toISO(),
            endUtc: slotEnd.toISO(),
          });
        }
      }

      current = current.plus({ minutes: 30 });
    }

    // Кэширование на 2 минуты
    await redis.setex(cacheKey, 120, JSON.stringify(slots));

    res.json(slots);
  } catch (error) {
    logger.error({ error }, 'Ошибка при получении доступности из Google Calendar');
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Ошибка при обращении к календарю' } });
  }
});

// GET /api/availability/dates
app.get('/api/availability/dates', async (req, res) => {
  const from = req.query.from || DateTime.now().setZone('Europe/Moscow').toISODate();
  const to = req.query.to || DateTime.now().setZone('Europe/Moscow').plus({ days: 30 }).toISODate();

  const cacheKey = `availability:dates:${from}:${to}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  try {
    const dates = [];
    let current = DateTime.fromISO(from).setZone('Europe/Moscow');
    const endDate = DateTime.fromISO(to).setZone('Europe/Moscow');
    const today = DateTime.now().setZone('Europe/Moscow').startOf('day');

    while (current <= endDate) {
      const dateStr = current.toISODate();
      
      // Прошедшие даты неактивны
      if (current < today) {
        dates.push({ date: dateStr, hasAvailableSlots: false });
        current = current.plus({ days: 1 });
        continue;
      }

      // Проверка наличия свободных интервалов (упрощённая версия)
      const startOfDay = current.startOf('day').toUTC();
      const endOfDay = current.endOf('day').toUTC();

      const response = await calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin: startOfDay.toISO(),
        timeMax: endOfDay.toISO(),
        singleEvents: true,
        maxResults: 50, // достаточно для проверки занятости
      });

      const events = response.data.items || [];
      const busyCount = events.length;
      
      // Если событий меньше 16 (максимум слотов в день 10:00-18:00 с шагом 30 мин), есть свободные
      const hasAvailableSlots = busyCount < 16;

      dates.push({ date: dateStr, hasAvailableSlots });
      current = current.plus({ days: 1 });
    }

    await redis.setex(cacheKey, 600, JSON.stringify({ dates })); // кэш на 10 минут

    res.json({ dates });
  } catch (error) {
    logger.error({ error }, 'Ошибка при получении дат с доступностью');
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Ошибка при обращении к календарю' } });
  }
});

// POST /api/bookings
app.post('/api/bookings', async (req, res) => {
  const { date, startUtc, endUtc, contactRaw, contactType, consentPersonal } = req.body;

  // 1) Валидация (аналогично предыдущему примеру)
  const errors = {};
  
  if (!date) {
    errors.date = 'Не выбрана дата';
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      errors.date = 'Неверный формат даты';
    } else {
      const nowMoscow = DateTime.now().setZone('Europe/Moscow');
      const todayMoscow = nowMoscow.startOf('day');
      const selectedDate = DateTime.fromISO(date).setZone('Europe/Moscow').startOf('day');
      if (selectedDate < todayMoscow) {
        errors.date = 'Нельзя записаться на прошедшую дату';
      }
    }
  }
  
  if (!startUtc || !endUtc) errors.startUtc = 'Не выбран интервал';
  if (!consentPersonal) errors.consentPersonal = 'Необходимо согласие';
  
  const isEmail = contactType === 'EMAIL';
  const isTelegram = contactType === 'TELEGRAM';
  if (!(isEmail || isTelegram)) errors.contactRaw = 'Выберите тип контакта';
  if (isEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactRaw)) errors.contactRaw = 'Неверный email';
  if (isTelegram && !/^@?[a-zA-Z0-9_]{5,32}$/.test(contactRaw)) errors.contactRaw = 'Неверный Telegram';
  
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', fields: errors } });
  }

  // 2) Advisory lock для защиты от гонок
  const lockKey = `booking:lock:${date}:${startUtc}`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');
  if (!lockAcquired) {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Интервал уже занят' } });
  }

  try {
    // 3) Проверка доступности в Google Calendar
    const startTime = DateTime.fromISO(startUtc).toUTC();
    const endTime = DateTime.fromISO(endUtc).toUTC();

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startTime.toISO(),
      timeMax: endTime.toISO(),
      singleEvents: true,
    });

    const conflictingEvents = response.data.items || [];
    if (conflictingEvents.length > 0) {
      await redis.del(lockKey);
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Интервал уже занят в календаре' } });
    }

    // 4) Проверка в БД
    const dbConflict = await prisma.booking.findFirst({
      where: {
        date: date,
        status: 'CONFIRMED',
        startUtc: { lt: endTime.toJSDate() },
        endUtc: { gt: startTime.toJSDate() },
      },
    });

    if (dbConflict) {
      await redis.del(lockKey);
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Интервал уже занят' } });
    }

    // 5) Создание события в Google Calendar
    const eventTitle = 'Консультация';
    const eventDescription = `Контакт: ${contactType === 'EMAIL' ? 'Email' : 'Telegram'} ${contactRaw}`;

    const googleEvent = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: eventTitle,
        description: eventDescription,
        start: {
          dateTime: startTime.toISO(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime.toISO(),
          timeZone: 'UTC',
        },
      },
    });

    // 6) Сохранение брони в БД
    const booking = await prisma.booking.create({
      data: {
        date: date,
        startUtc: startTime.toJSDate(),
        endUtc: endTime.toJSDate(),
        contactRaw,
        contactType,
        consentPersonal,
        status: 'CONFIRMED',
        googleEventId: googleEvent.data.id,
      },
    });

    // 7) Очистка кэша
    await redis.del(`availability:${date}`);
    await redis.del(lockKey);

    // 8) Уведомление в Telegram
    // await sendTelegramNotification(booking);

    res.status(201).json(booking);
  } catch (error) {
    await redis.del(lockKey);
    logger.error({ error }, 'Ошибка при создании брони');
    
    if (error.code === 409) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Интервал уже занят' } });
    }
    
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Ошибка при обращении к календарю' } });
  }
});

// PATCH /api/bookings/:id/status
app.patch('/api/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== 'CANCELLED') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Можно только отменить бронь' } });
  }

  try {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Бронь не найдена' } });
    }

    // Обновление статуса в БД
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Удаление события из Google Calendar (только если событие ещё не прошло)
    const now = new Date();
    if (booking.googleEventId && booking.endUtc > now) {
      try {
        await calendar.events.delete({
          calendarId: CALENDAR_ID,
          eventId: booking.googleEventId,
        });
      } catch (error) {
        // Логируем, но не прерываем процесс, если событие уже удалено
        logger.warn({ error, googleEventId: booking.googleEventId }, 'Ошибка при удалении события из Google Calendar');
      }
    } else if (booking.googleEventId && booking.endUtc <= now) {
      // Событие уже прошло - не удаляем из Google Calendar
      logger.info({ bookingId: booking.id, endUtc: booking.endUtc }, 'Событие уже прошло, не удаляем из Google Calendar');
    }

    // Создание записи в AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'BOOKING_CANCELLED',
        bookingId: booking.id,
        metadata: {
          endUtc: booking.endUtc.toISOString(),
          date: booking.date.toISOString().split('T')[0],
          status: 'CANCELLED',
        },
      },
    });

    // Очистка кэша доступности
    await redis.del(`availability:${booking.date}`);

    res.json(updatedBooking);
  } catch (error) {
    logger.error({ error, id }, 'Ошибка при отмене брони');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ошибка при отмене брони' } });
  }
});
```

### 9) Тест‑кейсы

**Интеграция с Google Calendar:**
- Успешное получение свободных интервалов из Google Calendar — 200.
- Обработка ошибок Google Calendar API (rate limit, недоступность) — 503.
- Создание брони при свободном интервале в Google Calendar — 201, событие создано в календаре.
- Попытка брони при занятом интервале в Google Calendar — 409.
- Попытка брони при пересечении — 409 (редкая гонка, UI не показывает такие интервалы).

**Валидаторы:**
- отсутствует дата → 400 + `fields.date` ("Не выбрана дата")
- неверный формат даты → 400 + `fields.date` ("Неверный формат даты")
- дата в прошлом → 400 + `fields.date` ("Нельзя записаться на прошедшую дату")
- пустой контакт → 400 + `fields.contactRaw`
- невалидный email/telegram → 400 + `fields.contactRaw`
- отсутствует согласие → 400 + `fields.consentPersonal`
- незаполненные обязательные поля → 400 + `fields.*`

**API доступности:**
- GET `/availability/dates` — возвращает список дат с флагом `hasAvailableSlots`.
- Прошедшие даты помечены как `hasAvailableSlots: false`.
- Даты без свободных окон помечены как `hasAvailableSlots: false`.
- Кэширование работает корректно.

**Отмена брони:**
- PATCH `/bookings/:id/status` с `CANCELLED` — событие удаляется из Google Calendar.
- Кэш доступности очищается для даты брони.

### 10) Retention и удаление данных

**Политика retention:**
- Удаление: через `RETENTION_PAST_BOOKING_MINUTES` минут после `endUtc` (в UTC) удалять записи `Booking` со всеми данными.
- Записи удаляются сразу, без этапа анонимизации.

**Cron-джоб:**

**Удаление прошедших броней (ежедневно):**
- Запуск: `0 2 * * *` (ежедневно в 02:00 UTC)
- Логика:
  - Найти все `Booking` где:
    - `endUtc < NOW() - INTERVAL '${RETENTION_PAST_BOOKING_MINUTES} minutes'` (в UTC)
    - `status = 'CONFIRMED'` (только завершённые брони)
  - Для каждой брони:
    - Создать запись в `AuditLog` перед удалением:
      - `action = 'BOOKING_PURGED'`
      - `bookingId = <id брони>`
      - `metadata = { endUtc: <endUtc>, date: <date>, deletedAt: <now> }` (без ПДн)
    - Удалить запись `Booking` со всеми данными
    - Очистить кэш доступности для даты брони
  - **Не удалять события из Google Calendar** — они остаются для истории.

**Реализация cron-джоба:**

Использовать библиотеку `node-cron`:

```js
// jobs/retention.js
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RETENTION_PAST_BOOKING_MINUTES = parseInt(process.env.RETENTION_PAST_BOOKING_MINUTES || '60');

// Удаление прошедших броней ежедневно в 02:00 UTC
cron.schedule('0 2 * * *', async () => {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() - RETENTION_PAST_BOOKING_MINUTES * 60 * 1000);

    const bookings = await prisma.booking.findMany({
      where: {
        endUtc: { lt: threshold },
        status: 'CONFIRMED',
      },
    });

    for (const booking of bookings) {
      // Сохранить данные перед удалением
      const bookingId = booking.id;
      const bookingDate = booking.date.toISOString().split('T')[0];
      const metadata = {
        endUtc: booking.endUtc.toISOString(),
        date: bookingDate,
        deletedAt: now.toISOString(),
      };

      // Удалить запись со всеми данными
      await prisma.booking.delete({
        where: { id: bookingId },
      });

      // Создать запись в AuditLog после удаления (bookingId = null)
      await prisma.auditLog.create({
        data: {
          action: 'BOOKING_PURGED',
          bookingId: null, // null, так как запись уже удалена
          metadata: metadata, // без ПДн
        },
      });

      // Очистить кэш доступности
      await deleteCache(`availability:${bookingDate}`);
    }

    if (bookings.length > 0) {
      logger.info({ count: bookings.length }, 'Удалено прошедших броней');
    }
  } catch (error) {
    logger.error({ error }, 'Ошибка при удалении прошедших броней');
  }
});
```

**Важные правила:**
- Все сравнения дат выполняются в UTC.
- В `AuditLog.metadata` **не сохраняем персональные данные** (только даты, статусы, ID).
- События в Google Calendar **не удаляются** для прошедших броней — только для отменённых заранее.
- При отмене брони проверяем: если `endUtc < now` (UTC), не удаляем событие из Google Calendar.
- Записи удаляются сразу через указанное время после завершения, без этапа анонимизации.

### 11) Развёртывание
- БД: миграции `prisma migrate deploy`.
- Приложение: Dockerfile + docker‑compose (app + db + redis).
- Мониторинг: healthcheck `/health`, логирование pino.
- Cron-джобы: запускать в основном процессе приложения или в отдельном worker-процессе.

### 12) Интеграция с фронтендом

**Виджет календаря для выбора даты:**
- Использовать готовый виджет календаря (например, `react-datepicker`, `@mui/x-date-pickers`, или нативный HTML5 `input type="date"`).
- При загрузке компонента запросить `/api/availability/dates` для получения списка дат с доступностью.
- Неактивные дни (недоступные для выбора):
  - Прошедшие даты — визуально затемнены, клик недоступен.
  - Даты без свободных окон (`hasAvailableSlots: false`) — визуально затемнены, клик недоступен.
- Активные дни (`hasAvailableSlots: true`) — доступны для выбора, подсвечены.

**Валидация и отображение ошибок:**
- Фронтенд подсвечивает ошибки полей цветом `#F97316`, если backend возвращает `VALIDATION_ERROR` и перечисляет поля в `error.fields`.
- Кнопка «Записаться на консультацию» недоступна, пока:
  - не выбрана дата (из активных дней),
  - не выбран интервал времени,
  - не введён валидный Email/Telegram,
  - не поставлен чек‑бокс согласия.
- Поле даты обязательно для заполнения. При отсутствии или неверном формате подсвечивается цветом `#F97316` с сообщением об ошибке.

**Работа с временем:**
- Переход на локаль пользователя: фронт отправляет UTC, backend хранит UTC; все расчёты в Europe/Moscow.
- Дата всегда передаётся в формате `YYYY-MM-DD` и интерпретируется в часовом поясе Europe/Moscow.
- После выбора даты запрашивать `/api/availability?date=YYYY-MM-DD` для получения списка свободных интервалов.

**UX рекомендации:**
- Показывать индикатор загрузки при запросе доступных дат и интервалов.
- Обновлять список доступных интервалов при изменении выбранной даты.
- Показывать сообщение, если для выбранной даты нет свободных интервалов.

**Очистка localStorage на фронтенде:**
- При загрузке компонента `Booking` проверять сохранённые данные в `localStorage` (ключ `bookingForm:v1`).
- Если в сохранённых данных есть `endUtc` и `endUtc < Date.now()` (в UTC), очистить `localStorage.removeItem('bookingForm:v1')`.
- Это предотвращает восстановление данных прошедших броней.

Пример реализации:
```js
// В компоненте Booking при монтировании
useEffect(() => {
  try {
    const saved = localStorage.getItem('bookingForm:v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Если есть endUtc и бронь прошла, очищаем
      if (parsed.endUtc) {
        const endUtc = new Date(parsed.endUtc);
        if (endUtc < new Date()) {
          localStorage.removeItem('bookingForm:v1');
        }
      }
    }
  } catch (error) {
    console.error('Ошибка при проверке сохранённых данных:', error);
  }
}, []);
```

### 13) Уведомления в Telegram
- Переменные окружения: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- После успешного создания брони отправлять сообщение через Telegram Bot API с временем (МСК) и контактами пользователя.

---

Этот план покрывает данные, API, алгоритмику доступности, валидации и контуры эксплуатации. На его основе можно быстро поднять прототип (Express + Prisma), затем углублять логику слотов/подтверждений в зависимости от бизнес‑правил. 


