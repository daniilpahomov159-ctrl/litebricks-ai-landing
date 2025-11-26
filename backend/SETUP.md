# Инструкция по настройке и запуску

## Полная структура проекта

```
backend/
├── src/
│   ├── app.js                    # Основной файл приложения
│   ├── config/
│   │   └── index.js              # Конфигурация из переменных окружения
│   ├── routes/
│   │   ├── availability.js       # Роуты для получения доступности
│   │   └── bookings.js           # Роуты для работы с бронями
│   ├── middleware/
│   │   ├── validation.js         # Валидация данных
│   │   ├── errorHandler.js      # Обработка ошибок
│   │   └── rateLimiter.js       # Rate limiting
│   ├── utils/
│   │   ├── prisma.js            # Prisma Client
│   │   ├── redis.js             # Redis клиент и кэширование
│   │   ├── googleCalendar.js    # Интеграция с Google Calendar
│   │   ├── telegram.js          # Уведомления в Telegram
│   │   └── logger.js            # Логирование (pino)
│   └── jobs/
│       └── retention.js         # Cron-джобы для retention
├── prisma/
│   └── schema.prisma            # Схема базы данных
├── package.json                 # Зависимости и скрипты
├── docker-compose.yml           # Docker Compose для разработки
├── .env.example                 # Пример переменных окружения
├── .gitignore
├── README.md                    # Основная документация
├── QUICKSTART.md               # Быстрый старт
└── SETUP.md                    # Этот файл
```

## Что реализовано

✅ **Модели данных (Prisma)**
- User, Booking, AuditLog
- Поля анонимизации (anonymizedAt, purgedAt)
- Все необходимые индексы

✅ **API Endpoints**
- GET /api/availability - получение свободных интервалов
- GET /api/availability/dates - получение дат с доступностью
- POST /api/bookings - создание брони
- GET /api/bookings/:id - получение брони
- PATCH /api/bookings/:id/status - отмена брони

✅ **Интеграция с Google Calendar**
- Получение событий из календаря
- Создание событий при бронировании
- Удаление событий при отмене (только для будущих событий)

✅ **Валидация**
- Email и Telegram валидация
- Проверка дат и времени
- Проверка согласия на обработку ПД

✅ **Retention процессы**
- Анонимизация прошедших броней (каждые 10 минут)
- Пурж старых записей (ежедневно в 02:30 UTC)
- AuditLog для всех операций

✅ **Кэширование и производительность**
- Redis для кэширования доступности
- Advisory locks для защиты от гонок
- Rate limiting для защиты от спама

✅ **Обработка ошибок**
- Структурированные ошибки для фронтенда
- Подсветка полей с ошибками (#F97316)
- Обработка конфликтов (409)

## Следующие шаги

1. **Установите зависимости:**
   ```bash
   cd backend
   npm install
   ```

2. **Настройте базу данных:**
   - Запустите PostgreSQL (через Docker Compose или локально)
   - Создайте файл `.env` с настройками
   - Выполните миграции: `npm run prisma:migrate`

3. **Настройте Google Calendar:**
   - Создайте Service Account в Google Cloud Console
   - Добавьте credentials в `.env`
   - Предоставьте доступ к календарю

4. **Запустите сервер:**
   ```bash
   npm run dev
   ```

## Проверка работы

После запуска проверьте:
- Health check: `curl http://localhost:3001/health`
- Получение доступности: `curl "http://localhost:3001/api/availability?date=2025-01-15"`

## Дополнительная информация

- См. `QUICKSTART.md` для пошаговых инструкций
- См. `README.md` для полной документации API
- См. `docs/backend-plan.md` для детального плана разработки

