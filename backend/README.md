# Backend для системы записи на консультации

Backend сервер для системы записи на консультации с интеграцией Google Calendar.

## Технологический стек

- Node.js LTS (18+)
- Express.js
- PostgreSQL 13+
- Prisma ORM
- Google Calendar API
- Redis (опционально)
- node-cron для retention процессов

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Настройте переменные окружения:
```bash
cp .env.example .env
# Отредактируйте .env файл
```

3. Настройте базу данных:
```bash
# Создайте базу данных PostgreSQL
# Затем выполните миграции:
npm run prisma:migrate
```

4. Сгенерируйте Prisma Client:
```bash
npm run prisma:generate
```

## Запуск

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## API Endpoints

### GET /api/availability
Получить свободные интервалы для указанной даты.

**Параметры:**
- `date` (query, обязательный) - дата в формате YYYY-MM-DD

**Ответ:**
```json
[
  {
    "startUtc": "2025-01-01T10:00:00.000Z",
    "endUtc": "2025-01-01T10:30:00.000Z"
  }
]
```

### GET /api/availability/dates
Получить список дат с доступностью.

**Параметры:**
- `from` (query, опционально) - начальная дата
- `to` (query, опционально) - конечная дата

**Ответ:**
```json
{
  "dates": [
    { "date": "2025-01-01", "hasAvailableSlots": true },
    { "date": "2025-01-02", "hasAvailableSlots": false }
  ]
}
```

### POST /api/bookings
Создать новую бронь.

**Тело запроса:**
```json
{
  "date": "2025-01-01",
  "startUtc": "2025-01-01T10:00:00Z",
  "endUtc": "2025-01-01T10:30:00Z",
  "contactRaw": "user@example.com",
  "contactType": "EMAIL",
  "consentPersonal": true,
  "marketingConsent": false
}
```

### GET /api/bookings/:id
Получить бронь по ID.

### PATCH /api/bookings/:id/status
Отменить бронь.

**Тело запроса:**
```json
{
  "status": "CANCELLED"
}
```

## Retention процессы

Система автоматически:
- Анонимизирует ПД в прошедших бронях (каждые 10 минут)
- Удаляет старые анонимизированные брони (ежедневно в 02:30 UTC)

Настройки в `.env`:
- `RETENTION_PAST_BOOKING_MINUTES` - через сколько минут анонимизировать
- `RETENTION_PURGE_DAYS` - через сколько дней удалять
- `RETENTION_ANONYMIZE` - включить/выключить анонимизацию

## Переменные окружения

См. `.env.example` для полного списка переменных.

## Разработка

### Запуск Prisma Studio
```bash
npm run prisma:studio
```

### Миграции
```bash
# Создать новую миграцию
npm run prisma:migrate

# Применить миграции в production
npm run prisma:deploy
```

## Лицензия

ISC

