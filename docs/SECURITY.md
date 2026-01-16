# Документация по безопасности

## Обзор

Этот документ описывает меры безопасности, реализованные в системе бронирования, и инструкции по их настройке.

## Реализованные меры безопасности

### 1. Шифрование в пути (HTTPS/TLS)

- **Nginx reverse proxy** с поддержкой HTTPS/TLS
- **Let's Encrypt** сертификаты для SSL
- Принудительное перенаправление HTTP → HTTPS
- Современные cipher suites (TLS 1.2+)
- Security headers (HSTS, CSP, X-Frame-Options)

### 2. Шифрование в покое

#### База данных PostgreSQL
- Пароли хранятся в переменных окружения (не в коде)
- Чувствительные поля (`contactRaw`) шифруются перед сохранением
- Используется AES-256-GCM шифрование

#### Redis
- Поддержка AUTH (пароль)
- Поддержка TLS (опционально для production)
- Данные доступны только внутри Docker сети

### 3. Шифрование чувствительных полей

- **Алгоритм**: AES-256-GCM
- **Поля**: `contactRaw` (email/telegram пользователей)
- Автоматическое шифрование при сохранении
- Автоматическое дешифрование при чтении
- Поддержка миграции существующих данных

### 4. HTTP заголовки безопасности

- **Helmet.js** для установки security headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options, X-Content-Type-Options
- X-XSS-Protection

### 5. Логирование

- Маскирование чувствительных данных в логах
- Email: `user@example.com` → `u***@e***.com`
- Telegram: `@username` → `@u******`

### 6. Rate Limiting

- Ограничение количества запросов на создание броней
- Настраиваемые лимиты для development/production

## Настройка безопасности

### Шаг 1: Генерация ключа шифрования

```bash
# Генерация 32-байтового ключа в base64
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Скопируйте сгенерированный ключ в переменную окружения `ENCRYPTION_KEY`.

### Шаг 2: Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните все необходимые переменные:

```bash
cp .env.example .env
```

**Критически важные переменные:**
- `ENCRYPTION_KEY` - ключ шифрования (32 байта в base64)
- `POSTGRES_PASSWORD` - пароль базы данных
- `REDIS_PASSWORD` - пароль Redis
- `REDIS_TLS` - включить TLS для Redis (true/false)

### Шаг 3: Генерация безопасных паролей

```bash
# Генерация пароля для PostgreSQL
openssl rand -base64 32

# Генерация пароля для Redis
openssl rand -base64 32
```

### Шаг 4: Настройка SSL сертификатов

```bash
# Запустите скрипт настройки SSL
sudo ./scripts/setup-ssl.sh
```

Или вручную:

```bash
# Установка certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot certonly --webroot -w /var/www/certbot -d litebrick.ru -d www.litebrick.ru

# Настройка автообновления
sudo crontab -e
# Добавьте: 0 0 * * * certbot renew --quiet --post-hook 'docker exec booking-nginx nginx -s reload'
```

### Шаг 5: Миграция существующих данных

Если у вас есть существующие незашифрованные данные:

```bash
# Создайте бэкап базы данных
docker-compose exec postgres pg_dump -U booking_user booking_db > backup.sql

# Запустите миграцию
cd backend
node src/scripts/migrate-encrypt-data.js
```

## Ротация ключей шифрования

Если необходимо сменить ключ шифрования:

1. **Создайте новый ключ** и сохраните его в безопасном месте
2. **Расшифруйте все данные** старым ключом
3. **Зашифруйте новым ключом**
4. **Обновите ENCRYPTION_KEY** в переменных окружения
5. **Перезапустите приложение**

⚠️ **ВАЖНО**: Потеря ключа шифрования приведет к невозможности расшифровать данные!

## Рекомендации по безопасности

### Production

1. ✅ Используйте сильные пароли (минимум 32 символа)
2. ✅ Включите `REDIS_TLS=true` для Redis
3. ✅ Регулярно обновляйте зависимости
4. ✅ Мониторьте логи на предмет подозрительной активности
5. ✅ Регулярно создавайте бэкапы базы данных
6. ✅ Храните ключи шифрования в безопасном хранилище (например, HashiCorp Vault)
7. ✅ Используйте секреты Docker/Kubernetes для паролей

### Development

- Можно использовать более простые пароли для локальной разработки
- TLS для Redis не обязателен
- CSP может быть отключен для удобства разработки

## Проверка безопасности

### Проверка HTTPS

```bash
# Проверка SSL сертификата
openssl s_client -connect litebrick.ru:443 -servername litebrick.ru

# Онлайн проверка
# https://www.ssllabs.com/ssltest/analyze.html?d=litebrick.ru
```

### Проверка заголовков безопасности

```bash
curl -I https://litebrick.ru
```

Должны присутствовать заголовки:
- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Content-Security-Policy`

### Проверка шифрования данных

```bash
# Запуск тестов безопасности
cd backend
npm test -- security.test.js
```

## Устранение неполадок

### Ошибка "ENCRYPTION_KEY не установлен"

Убедитесь, что переменная `ENCRYPTION_KEY` установлена в `.env` файле и загружается при старте приложения.

### Ошибка "Не удалось расшифровать данные"

1. Проверьте, что используется правильный ключ шифрования
2. Убедитесь, что данные были зашифрованы этим ключом
3. Проверьте логи на наличие ошибок

### Redis не подключается с паролем

1. Убедитесь, что `REDIS_PASSWORD` установлен в `.env`
2. Проверьте, что Redis запущен с `--requirepass`
3. Проверьте формат URL: `redis://:password@redis:6379`

## Контакты

При обнаружении уязвимостей безопасности, пожалуйста, свяжитесь с администратором системы.

