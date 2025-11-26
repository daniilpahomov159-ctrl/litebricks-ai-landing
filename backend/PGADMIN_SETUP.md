# Настройка базы данных через pgAdmin 4

Это руководство поможет вам создать базу данных PostgreSQL через pgAdmin 4 для подключения к проекту.

## Шаг 1: Подключение к серверу PostgreSQL

1. Откройте **pgAdmin 4**
2. В левой панели найдите ваш сервер PostgreSQL (обычно называется "PostgreSQL" или имя, которое вы указали при установке)
3. Если сервер не подключен, щелкните правой кнопкой мыши и выберите **Connect Server**
4. Введите пароль суперпользователя (postgres) при запросе

## Шаг 2: Создание пользователя базы данных

1. В левой панели разверните ваш сервер PostgreSQL
2. Разверните **Login/Group Roles**
3. Щелкните правой кнопкой мыши на **Login/Group Roles** и выберите **Create** → **Login/Group Role...**

4. В открывшемся окне заполните:
   - **General** вкладка:
     - **Name**: `booking_user`
   
   - **Definition** вкладка:
     - **Password**: `booking_pass` (или ваш безопасный пароль)
     - **Password expiration**: можно оставить пустым
   
   - **Privileges** вкладка:
     - Убедитесь, что включены:
       - ✅ Can login?
       - ✅ Create databases? (опционально, но рекомендуется)
   
5. Нажмите **Save**

## Шаг 3: Создание базы данных

1. В левой панели разверните ваш сервер PostgreSQL
2. Щелкните правой кнопкой мыши на **Databases** и выберите **Create** → **Database...**

3. В открывшемся окне заполните:
   - **General** вкладка:
     - **Database**: `booking_db`
     - **Owner**: выберите `booking_user` из выпадающего списка
     - **Encoding**: `UTF8` (по умолчанию)
     - **Template**: `template0` (рекомендуется для новой базы)
   
   - **Definition** вкладка:
     - Можно оставить значения по умолчанию
   
4. Нажмите **Save**

## Шаг 4: Настройка прав доступа

1. В левой панели разверните **Databases** → **booking_db**
2. Разверните **Schemas** → **public**
3. Щелкните правой кнопкой мыши на **public** и выберите **Properties**
4. Перейдите на вкладку **Security**
5. Нажмите **+** (плюс) для добавления нового права
6. Выберите **Grantee**: `booking_user`
7. Установите все флажки в колонке **Privileges**:
   - ✅ ALL
8. Нажмите **Save**

### Альтернативный способ через Query Tool (SQL)

Если вы предпочитаете использовать SQL, выполните следующие команды:

1. Щелкните правой кнопкой мыши на базе данных **booking_db** и выберите **Query Tool**
2. Вставьте и выполните следующий SQL-код:

```sql
-- Подключиться к базе данных booking_db
\c booking_db

-- Предоставить права на схему public
GRANT ALL ON SCHEMA public TO booking_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO booking_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO booking_user;

-- Установить права по умолчанию для будущих таблиц
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO booking_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO booking_user;
```

3. Нажмите **Execute** (F5) для выполнения запроса

## Шаг 5: Настройка переменных окружения

Создайте файл `.env` в папке `backend` (если его еще нет) и добавьте строку подключения:

```env
DATABASE_URL=postgresql://booking_user:booking_pass@localhost:5432/booking_db
```

**Важно:** 
- Замените `booking_pass` на пароль, который вы указали при создании пользователя
- Если ваш PostgreSQL работает на другом хосте или порту, измените `localhost:5432` соответственно
- Если вы используете другой пароль или имя пользователя, обновите строку подключения

## Шаг 6: Применение миграций Prisma

После настройки базы данных выполните миграции Prisma:

```bash
cd backend
npx prisma migrate dev
```

Эта команда:
- Создаст все необходимые таблицы согласно схеме в `schema.prisma`
- Применит все миграции
- Сгенерирует Prisma Client

## Шаг 7: Проверка подключения

Для проверки, что всё работает корректно:

1. В pgAdmin 4 разверните **booking_db** → **Schemas** → **public** → **Tables**
2. После выполнения миграций вы должны увидеть таблицы:
   - `User`
   - `Booking`
   - `AuditLog`
   - `_prisma_migrations`

## Дополнительные советы

### Безопасность паролей

Для production окружения:
- Используйте более сложные пароли
- Не храните пароли в открытом виде
- Используйте переменные окружения или секреты

### Формат DATABASE_URL

Формат строки подключения PostgreSQL:
```
postgresql://[пользователь]:[пароль]@[хост]:[порт]/[база_данных]
```

Примеры:
- Локальная база: `postgresql://booking_user:booking_pass@localhost:5432/booking_db`
- Удаленная база: `postgresql://booking_user:booking_pass@example.com:5432/booking_db`
- С SSL: `postgresql://booking_user:booking_pass@localhost:5432/booking_db?sslmode=require`

### Решение проблем

**Ошибка подключения:**
- Убедитесь, что PostgreSQL запущен
- Проверьте, что порт 5432 открыт
- Проверьте правильность имени пользователя и пароля

**Ошибка прав доступа:**
- Убедитесь, что пользователь `booking_user` имеет все необходимые права
- Проверьте, что база данных `booking_db` существует и принадлежит `booking_user`

**Ошибка миграций:**
- Убедитесь, что DATABASE_URL указан правильно в `.env`
- Проверьте, что пользователь имеет права на создание таблиц


