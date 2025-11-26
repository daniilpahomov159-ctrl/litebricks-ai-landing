# Инструкция по развёртыванию

## Production развёртывание

### 1. Подготовка сервера

- Node.js 18+ LTS
- PostgreSQL 13+
- Redis (опционально, но рекомендуется)

### 2. Клонирование и установка

```bash
git clone <repository>
cd backend
npm ci --production
```

### 3. Настройка переменных окружения

Создайте `.env` файл со всеми необходимыми переменными (см. `.env.example`).

**Обязательные переменные:**
- `DATABASE_URL` - строка подключения к PostgreSQL
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` или `GOOGLE_CLIENT_ID` - для Google Calendar
- `GOOGLE_PRIVATE_KEY` или `GOOGLE_CLIENT_SECRET` - для Google Calendar

### 4. Настройка базы данных

```bash
# Сгенерировать Prisma Client
npm run prisma:generate

# Применить миграции
npm run prisma:deploy
```

### 5. Запуск приложения

#### Вариант A: PM2 (рекомендуется)

```bash
npm install -g pm2
pm2 start src/app.js --name booking-backend
pm2 save
pm2 startup
```

#### Вариант B: systemd

Создайте файл `/etc/systemd/system/booking-backend.service`:

```ini
[Unit]
Description=Booking Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/app.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl enable booking-backend
sudo systemctl start booking-backend
```

#### Вариант C: Docker

Создайте `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN npm run prisma:generate

EXPOSE 3001

CMD ["node", "src/app.js"]
```

### 6. Мониторинг

- Health check endpoint: `GET /health`
- Логи: проверяйте логи приложения (pino)
- База данных: мониторинг через Prisma Studio или pgAdmin

### 7. Backup

Настройте регулярные бэкапы PostgreSQL:

```bash
# Пример cron задачи для бэкапа
0 2 * * * pg_dump -U booking_user booking_db > /backups/booking_$(date +\%Y\%m\%d).sql
```

## Обновление

```bash
git pull
npm ci --production
npm run prisma:generate
npm run prisma:deploy
pm2 restart booking-backend  # или systemctl restart booking-backend
```

## Troubleshooting

### Проблемы с Google Calendar

- Проверьте, что Service Account имеет доступ к календарю
- Убедитесь, что Google Calendar API включен в проекте
- Проверьте формат `GOOGLE_PRIVATE_KEY` (должен содержать `\n`)

### Проблемы с базой данных

- Проверьте подключение: `psql $DATABASE_URL`
- Проверьте миграции: `npm run prisma:studio`
- Убедитесь, что база данных создана

### Проблемы с Redis

- Redis опционален, приложение работает без него
- Проверьте подключение: `redis-cli -u $REDIS_URL ping`

## Безопасность

- Никогда не коммитьте `.env` файл
- Используйте сильные пароли для базы данных
- Настройте firewall для ограничения доступа
- Используйте HTTPS в production (через reverse proxy: nginx, Caddy)
- Регулярно обновляйте зависимости: `npm audit fix`

