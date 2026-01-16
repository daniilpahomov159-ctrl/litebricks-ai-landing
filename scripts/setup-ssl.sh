#!/bin/bash
# Скрипт для настройки SSL сертификатов через Let's Encrypt

set -e

DOMAIN="litebrick.ru"
EMAIL="admin@litebrick.ru"  # Замените на ваш email
NGINX_CONTAINER="booking-nginx"

echo "Настройка SSL сертификатов для $DOMAIN"

# Проверка наличия certbot
if ! command -v certbot &> /dev/null; then
    echo "Установка certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Создание временной конфигурации nginx для верификации
if [ ! -f "/etc/nginx/sites-available/$DOMAIN" ]; then
    echo "Создание временной конфигурации nginx..."
    cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
fi

# Получение сертификата
echo "Получение SSL сертификата..."
certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --domains $DOMAIN,www.$DOMAIN

# Настройка автообновления
echo "Настройка автообновления сертификатов..."
(crontab -l 2>/dev/null; echo "0 0 * * * certbot renew --quiet --post-hook 'docker exec $NGINX_CONTAINER nginx -s reload'") | crontab -

echo "SSL сертификаты успешно настроены!"
echo "Сертификаты находятся в: /etc/letsencrypt/live/$DOMAIN/"

