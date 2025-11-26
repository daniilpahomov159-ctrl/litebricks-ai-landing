-- Предоставить права пользователю booking_user на схему public в базе данных booking_db
-- Выполните: psql -U postgres -h localhost -p 5432 -d booking_db -f grant-permissions-to-booking-db.sql

-- Предоставить права на схему public
GRANT ALL ON SCHEMA public TO booking_user;

-- Предоставить права на все существующие таблицы
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO booking_user;

-- Предоставить права на все существующие последовательности
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO booking_user;

-- Установить права по умолчанию для будущих таблиц
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO booking_user;

-- Установить права по умолчанию для будущих последовательностей
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO booking_user;

