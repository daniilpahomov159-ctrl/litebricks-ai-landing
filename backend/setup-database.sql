-- Скрипт для создания базы данных и пользователя
-- Выполните этот скрипт в pgAdmin или через psql

-- Создать пользователя (если не существует)
CREATE USER booking_user WITH PASSWORD 'booking_pass';

-- Создать базу данных
CREATE DATABASE booking_db OWNER booking_user;

-- Предоставить все права пользователю на базу данных
GRANT ALL PRIVILEGES ON DATABASE booking_db TO booking_user;

-- Подключиться к базе данных booking_db
\c booking_db

-- Предоставить права на схему public
GRANT ALL ON SCHEMA public TO booking_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO booking_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO booking_user;

-- Установить права по умолчанию для будущих таблиц
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO booking_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO booking_user;

