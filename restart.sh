#!/bin/bash
#
# СКРИПТ ПОЛНОГО ВОССТАНОВЛЕНИЯ СЕРВИСА
# Использование: ./restart.sh
#
# Этот скрипт гарантирует, что все переменные окружения
# будут перечитаны из .env файлов
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  ВОССТАНОВЛЕНИЕ СЕРВИСА LITEBRICK"
echo "=========================================="
echo ""

# 1. Остановка и удаление контейнеров (сохраняем данные)
echo "1. Останавливаю контейнеры..."
docker-compose down 2>/dev/null || true

# 2. Проверка конфигурации
echo ""
echo "2. Проверка конфигурации..."

if [ ! -f "backend/.env" ]; then
    echo "   ❌ ОШИБКА: backend/.env не найден!"
    exit 1
fi

if [ ! -f "backend/google-key.json" ]; then
    echo "   ⚠️  ПРЕДУПРЕЖДЕНИЕ: backend/google-key.json не найден"
    echo "      Google Calendar интеграция будет отключена"
else
    echo "   ✓ google-key.json найден"
fi

# Проверяем ключевые переменные
CALENDAR_ID=$(grep "^GOOGLE_CALENDAR_ID=" backend/.env | cut -d'=' -f2)
if [ -z "$CALENDAR_ID" ] || [ "$CALENDAR_ID" = "primary" ]; then
    echo "   ⚠️  ПРЕДУПРЕЖДЕНИЕ: GOOGLE_CALENDAR_ID не настроен или = 'primary'"
else
    echo "   ✓ GOOGLE_CALENDAR_ID: ${CALENDAR_ID:0:30}..."
fi

# 3. Запуск контейнеров
echo ""
echo "3. Запускаю контейнеры..."
docker-compose up -d

# 4. Ожидание запуска
echo ""
echo "4. Ожидаю готовность сервисов..."
sleep 10

# 5. Проверка здоровья
echo ""
echo "5. Проверка здоровья сервисов..."

# Backend
HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null || echo '{"status":"error"}')
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo "   ✓ Backend: OK"
else
    echo "   ❌ Backend: НЕ ОТВЕЧАЕТ"
    echo "      Логи: docker-compose logs backend"
fi

# Frontend
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null || echo "000")
if [ "$FRONTEND" = "200" ]; then
    echo "   ✓ Frontend: OK"
else
    echo "   ⚠️  Frontend: код ответа $FRONTEND (может требовать больше времени)"
fi

# 6. Проверка Google Calendar
echo ""
echo "6. Проверка Google Calendar..."
docker-compose exec -T backend node test-calendar.js 2>&1 | grep -E "✓|✗|⚠️|Название|Calendar ID" | head -10

echo ""
echo "=========================================="
echo "  ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО"
echo "=========================================="
echo ""
echo "Сайт доступен по адресу: https://litebrick.ru"
echo ""



