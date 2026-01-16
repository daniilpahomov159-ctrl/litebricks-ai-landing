# Инструкция по развертыванию с настройкой безопасности

## Предварительные требования

- Docker и Docker Compose установлены
- Доступ к серверу с правами sudo
- Домен настроен и указывает на IP сервера
- Порты 80 и 443 открыты в firewall

## Пошаговая инструкция

### Шаг 1: Клонирование и подготовка

```bash
# Клонирование репозитория (если еще не сделано)
git clone <repository-url>
cd litebricks-ai-landing

# Создание .env файлов
cp .env.example .env
cp backend/.env.example backend/.env
```

### Шаг 2: Генерация ключей и паролей

```bash
# Генерация ключа шифрования
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> backend/.env

# Генерация пароля PostgreSQL
POSTGRES_PASSWORD=$(openssl rand -base64 32)
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> .env
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> backend/.env

# Генерация пароля Redis
REDIS_PASSWORD=$(openssl rand -base64 32)
echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> .env
echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> backend/.env

# Обновление DATABASE_URL с паролем
sed -i "s|your_strong_password_here|$POSTGRES_PASSWORD|g" backend/.env
sed -i "s|your_strong_redis_password_here|$REDIS_PASSWORD|g" backend/.env
```

### Шаг 3: Настройка переменных окружения

Отредактируйте `backend/.env` и установите:

```env
# Обязательные переменные
ENCRYPTION_KEY=<сгенерированный ключ>
POSTGRES_PASSWORD=<сгенерированный пароль>
REDIS_PASSWORD=<сгенерированный пароль>
REDIS_TLS=true  # для production
NODE_ENV=production
FRONTEND_URL=https://litebrick.ru

# Опциональные (если используются)
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
TELEGRAM_BOT_TOKEN=...
```

### Шаг 4: Получение SSL сертификатов

#### Вариант A: Автоматический (рекомендуется)

```bash
# Установка certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Создание директории для верификации
sudo mkdir -p /var/www/certbot

# Получение сертификата
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d litebrick.ru \
  -d www.litebrick.ru \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Настройка автообновления
(sudo crontab -l 2>/dev/null; echo "0 0 * * * certbot renew --quiet --post-hook 'docker exec booking-nginx nginx -s reload'") | sudo crontab -
```

#### Вариант B: Ручной (если nginx еще не запущен)

1. Временно запустите nginx на порту 80
2. Выполните команды из Варианта A
3. Обновите конфигурацию nginx для использования сертификатов

### Шаг 5: Запуск приложения

```bash
# Запуск в production режиме
docker-compose -f docker-compose.prod.yml up -d

# Проверка статуса
docker-compose -f docker-compose.prod.yml ps

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f
```

### Шаг 6: Миграция базы данных

```bash
# Создание миграций Prisma
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Шифрование существующих данных (если есть)
docker-compose -f docker-compose.prod.yml exec backend node src/scripts/migrate-encrypt-data.js
```

### Шаг 7: Проверка безопасности

```bash
# Проверка HTTPS
curl -I https://litebrick.ru

# Проверка health endpoint
curl https://litebrick.ru/api/health

# Проверка SSL сертификата
openssl s_client -connect litebrick.ru:443 -servername litebrick.ru
```

## Обновление приложения

```bash
# Остановка
docker-compose -f docker-compose.prod.yml down

# Обновление кода
git pull

# Пересборка и запуск
docker-compose -f docker-compose.prod.yml up -d --build

# Применение миграций (если есть)
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

## Резервное копирование

### База данных

```bash
# Создание бэкапа
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U booking_user booking_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из бэкапа
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U booking_user booking_db < backup.sql
```

### Ключи шифрования

⚠️ **КРИТИЧЕСКИ ВАЖНО**: Сохраните ключ шифрования в безопасном месте!

```bash
# Сохранение ключа в зашифрованном виде
echo $ENCRYPTION_KEY | gpg --encrypt --recipient your-email@example.com > encryption_key.gpg
```

## Мониторинг

### Логи

```bash
# Просмотр всех логов
docker-compose -f docker-compose.prod.yml logs -f

# Логи конкретного сервиса
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Проверка состояния

```bash
# Статус контейнеров
docker-compose -f docker-compose.prod.yml ps

# Использование ресурсов
docker stats

# Проверка подключения Redis
docker-compose -f docker-compose.prod.yml exec backend node -e "
  const { isRedisConnected } = require('./src/utils/redis.js');
  console.log('Redis connected:', isRedisConnected());
"
```

## Устранение проблем

### Проблема: Nginx не запускается

```bash
# Проверка конфигурации
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs nginx
```

### Проблема: SSL сертификат не работает

```bash
# Проверка наличия сертификатов
sudo ls -la /etc/letsencrypt/live/litebrick.ru/

# Проверка прав доступа
sudo chmod 644 /etc/letsencrypt/live/litebrick.ru/fullchain.pem
sudo chmod 600 /etc/letsencrypt/live/litebrick.ru/privkey.pem
```

### Проблема: Не удается расшифровать данные

1. Проверьте, что `ENCRYPTION_KEY` правильный
2. Убедитесь, что данные были зашифрованы этим ключом
3. Проверьте логи на наличие ошибок

## Автоматизация

### Systemd service

Создайте файл `/etc/systemd/system/litebrick.service`:

```ini
[Unit]
Description=Litebrick Booking Service
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/litebricks-ai-landing
ExecStart=/usr/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.prod.yml down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Активация:

```bash
sudo systemctl enable litebrick.service
sudo systemctl start litebrick.service
```

## Чеклист безопасности

- [ ] Все пароли сгенерированы и сохранены в безопасном месте
- [ ] `ENCRYPTION_KEY` установлен и сохранен в бэкапе
- [ ] SSL сертификаты получены и настроены
- [ ] Автообновление SSL сертификатов настроено
- [ ] Redis пароль установлен
- [ ] PostgreSQL пароль установлен
- [ ] `REDIS_TLS=true` для production
- [ ] Firewall настроен (открыты только 80, 443)
- [ ] Регулярные бэкапы настроены
- [ ] Мониторинг логов настроен
- [ ] Тесты безопасности пройдены

## Дополнительные ресурсы

- [Документация по безопасности](./SECURITY.md)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

