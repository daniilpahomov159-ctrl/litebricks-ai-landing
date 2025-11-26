# Быстрый старт

## Предварительные требования

- Node.js 18+
- PostgreSQL 13+
- Redis (опционально, для кэширования)
- Google Calendar API credentials

## Шаги для запуска

### 1. Установка зависимостей

```bash
cd backend
npm install
```

### 2. Настройка базы данных

#### Вариант A: Использование Docker Compose

```bash
# Запустить PostgreSQL и Redis
docker-compose up -d

# Подождать пока база данных запустится (несколько секунд)
```

#### Вариант B: Локальная установка

Установите PostgreSQL и Redis локально и настройте подключение.

### 3. Настройка переменных окружения

Создайте файл `.env` на основе `.env.example`:

```bash
# Минимальная конфигурация
DATABASE_URL=postgresql://booking_user:booking_pass@localhost:5432/booking_db
PORT=3001
LOG_LEVEL=info

# Redis (опционально)
REDIS_URL=redis://localhost:6379

# Google Calendar (обязательно)
GOOGLE_CALENDAR_ID=primary
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Retention (опционально)
RETENTION_PAST_BOOKING_MINUTES=60
RETENTION_PURGE_DAYS=365
RETENTION_ANONYMIZE=true
```

### 4. Настройка Google Calendar API

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект или выберите существующий
3. Включите Google Calendar API
4. Создайте Service Account:
   - Перейдите в "IAM & Admin" > "Service Accounts"
   - Создайте новый Service Account
   - Создайте ключ (JSON) и скачайте его
   - Извлеките `client_email` и `private_key` из JSON файла
5. Предоставьте доступ к календарю:
   - Откройте Google Calendar
   - Настройки > Календари > Добавить календарь
   - Добавьте email Service Account с правами "Управление событиями"

### 5. Применение миграций базы данных

```bash
# Сгенерировать Prisma Client
npm run prisma:generate

# Применить миграции
npm run prisma:migrate
```

### 6. Запуск сервера

```bash
# Development режим (с автоперезагрузкой)
npm run dev

# Production режим
npm start
```

Сервер запустится на `http://localhost:3001`

## Проверка работы

### Health check

```bash
curl http://localhost:3001/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "uptime": 123.45
}
```

### Получение доступных интервалов

```bash
curl "http://localhost:3001/api/availability?date=2025-01-15"
```

### Создание брони

```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15",
    "startUtc": "2025-01-15T10:00:00Z",
    "endUtc": "2025-01-15T10:30:00Z",
    "contactRaw": "test@example.com",
    "contactType": "EMAIL",
    "consentPersonal": true
  }'
```

## Полезные команды

### Prisma Studio (GUI для базы данных)

```bash
npm run prisma:studio
```

Откроется веб-интерфейс на `http://localhost:5555`

### Создание новой миграции

```bash
npm run prisma:migrate
```

### Применение миграций в production

```bash
npm run prisma:deploy
```

## Структура проекта

```
backend/
├── src/
│   ├── app.js              # Основной файл приложения
│   ├── config/              # Конфигурация
│   ├── routes/              # API роуты
│   ├── middleware/          # Middleware (валидация, обработка ошибок)
│   ├── utils/               # Утилиты (Prisma, Redis, Google Calendar)
│   └── jobs/                # Cron-джобы (retention)
├── prisma/
│   └── schema.prisma        # Схема базы данных
├── package.json
├── docker-compose.yml        # Docker Compose для разработки
└── README.md
```

## Troubleshooting

### Ошибка подключения к базе данных

- Проверьте, что PostgreSQL запущен
- Проверьте `DATABASE_URL` в `.env`
- Убедитесь, что база данных создана

### Ошибка Google Calendar API

- Проверьте credentials в `.env`
- Убедитесь, что Service Account имеет доступ к календарю
- Проверьте, что Google Calendar API включен в проекте

### Redis не подключается

- Redis опционален, приложение будет работать без него
- Проверьте `REDIS_URL` в `.env` если используете Redis

## Дополнительная информация

См. [README.md](./README.md) для полной документации.

