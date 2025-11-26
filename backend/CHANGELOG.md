# Changelog

## [1.0.0] - 2025-01-XX

### Добавлено

- Полная структура backend согласно плану разработки
- Prisma schema с моделями User, Booking, AuditLog
- API endpoints для работы с доступностью и бронями
- Интеграция с Google Calendar API
- Retention процессы (анонимизация и пурж)
- Cron-джобы для автоматической обработки данных
- Валидация данных (email, telegram, даты)
- Rate limiting для защиты от спама
- Кэширование через Redis
- Уведомления в Telegram
- Обработка ошибок с подсветкой полей
- Docker Compose для разработки
- Полная документация

### Технологии

- Node.js + Express.js
- PostgreSQL + Prisma ORM
- Google Calendar API
- Redis для кэширования
- node-cron для scheduled tasks
- pino для логирования

