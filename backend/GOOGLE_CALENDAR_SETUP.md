# Подробная инструкция по подключению Google Calendar

Это руководство поможет вам настроить интеграцию с Google Calendar для системы бронирования. Поддерживаются два способа аутентификации: **Service Account** (рекомендуется) и **OAuth 2.0**.

---

## Способ 1: Service Account (Рекомендуется)

Service Account — это специальный тип аккаунта для серверных приложений. Он не требует интерактивной авторизации и идеально подходит для автоматизации.

### Шаг 1: Создание проекта в Google Cloud Console

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Войдите в свой Google аккаунт
3. Нажмите на выпадающий список проектов в верхней панели
4. Нажмите **"Новый проект"** (или выберите существующий)
5. Введите название проекта (например, "Booking System")
6. Нажмите **"Создать"**

### Шаг 2: Включение Google Calendar API

1. В меню слева выберите **"APIs & Services"** → **"Library"** (Библиотека)
2. В поиске введите **"Google Calendar API"**
3. Нажмите на **"Google Calendar API"** в результатах
4. Нажмите кнопку **"Enable"** (Включить)

### Шаг 3: Создание Service Account

1. В меню слева выберите **"APIs & Services"** → **"Credentials"** (Учетные данные)
2. Нажмите **"+ CREATE CREDENTIALS"** (Создать учетные данные)
3. Выберите **"Service account"** (Сервисный аккаунт)
4. Заполните форму:
   - **Service account name**: `booking-calendar-service` (или любое другое имя)
   - **Service account ID**: будет сгенерирован автоматически
   - **Description** (опционально): "Service account for booking system calendar integration"
5. Нажмите **"CREATE AND CONTINUE"**
6. На шаге **"Grant this service account access to project"** можно пропустить (нажать **"CONTINUE"**)
7. На шаге **"Grant users access to this service account"** можно пропустить (нажать **"DONE"**)

### Шаг 4: Создание ключа для Service Account

1. В списке Service Accounts найдите созданный аккаунт и нажмите на него
2. Перейдите на вкладку **"KEYS"** (Ключи)
3. Нажмите **"ADD KEY"** → **"Create new key"**
4. Выберите формат **JSON**
5. Нажмите **"CREATE"**
6. Файл JSON автоматически скачается на ваш компьютер

**⚠️ ВАЖНО:** Сохраните этот файл в безопасном месте! Он содержит приватный ключ, который нельзя публиковать.

### Шаг 5: Извлечение данных из JSON файла

Откройте скачанный JSON файл. Он будет выглядеть примерно так:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "booking-calendar-service@your-project-id.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

Вам понадобятся два значения:
- **`client_email`** — это email Service Account
- **`private_key`** — это приватный ключ (весь блок от `-----BEGIN PRIVATE KEY-----` до `-----END PRIVATE KEY-----`)

### Шаг 6: Предоставление доступа к календарю

Service Account должен иметь доступ к вашему Google Calendar. Есть два способа:

#### Способ A: Предоставить доступ к основному календарю

1. Откройте [Google Calendar](https://calendar.google.com/)
2. Слева найдите **"Мой календарь"** → **"Настройки"** (шестерёнка рядом с календарём)
3. Прокрутите вниз до раздела **"Доступ для отдельных пользователей"**
4. Нажмите **"Добавить людей"**
5. Введите **email Service Account** (тот, что из JSON файла, например: `booking-calendar-service@your-project-id.iam.gserviceaccount.com`)
6. Выберите уровень доступа: **"Управление событиями"** (Make changes to events)
7. Нажмите **"Отправить"**

#### Способ B: Создать отдельный календарь для бронирований

1. В Google Calendar нажмите **"+"** рядом с "Другие календари"
2. Выберите **"Создать новый календарь"**
3. Введите название (например, "Бронирования")
4. Нажмите **"Создать календарь"**
5. Откройте настройки этого календаря
6. В разделе **"Доступ для отдельных пользователей"** добавьте email Service Account с правами **"Управление событиями"**
7. Скопируйте **Calendar ID** из настроек (обычно это email календаря или специальный ID)

### Шаг 7: Настройка переменных окружения

Откройте файл `.env` в папке `backend` и добавьте следующие переменные:

```env
# Google Calendar - Service Account
GOOGLE_CALENDAR_ID=primary
GOOGLE_SERVICE_ACCOUNT_EMAIL=booking-calendar-service@your-project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**Важные моменты:**

1. **GOOGLE_CALENDAR_ID:**
   - Для основного календаря используйте `primary`
   - Для отдельного календаря используйте его Calendar ID (можно найти в настройках календаря)

2. **GOOGLE_SERVICE_ACCOUNT_EMAIL:**
   - Скопируйте значение `client_email` из JSON файла

3. **GOOGLE_PRIVATE_KEY:**
   - Скопируйте значение `private_key` из JSON файла
   - **Обязательно** заключите в двойные кавычки `"`
   - Сохраните все символы `\n` (они будут автоматически преобразованы в переносы строк)
   - Пример правильного формата:
     ```env
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
     ```

### Шаг 8: Проверка подключения

1. Перезапустите приложение:
   ```bash
   cd backend
   npm start
   ```

2. Проверьте логи. Вы должны увидеть:
   ```
   Google Calendar: инициализирован через Service Account
   ```

3. Проверьте работу API:
   ```bash
   curl "http://localhost:3001/api/availability?date=2025-01-15"
   ```

Если всё настроено правильно, вы получите список доступных интервалов для указанной даты.

---

## Способ 2: OAuth 2.0

OAuth 2.0 используется, когда нужно работать от имени пользователя. Этот способ требует интерактивной авторизации.

### Шаг 1-2: Создание проекта и включение API

Выполните шаги 1-2 из способа 1 (Service Account).

### Шаг 3: Создание OAuth 2.0 credentials

1. В Google Cloud Console перейдите в **"APIs & Services"** → **"Credentials"**
2. Нажмите **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Если появится предупреждение о настройке экрана согласия:
   - Нажмите **"CONFIGURE CONSENT SCREEN"**
   - Выберите **"External"** (Внешний) и нажмите **"CREATE"**
   - Заполните обязательные поля:
     - **App name**: Booking System
     - **User support email**: ваш email
     - **Developer contact information**: ваш email
   - Нажмите **"SAVE AND CONTINUE"**
   - На следующих шагах можно нажать **"BACK TO DASHBOARD"**

4. Вернитесь в **"Credentials"** → **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
5. Выберите тип приложения: **"Web application"**
6. Заполните:
   - **Name**: Booking System OAuth Client
   - **Authorized JavaScript origins**: `http://localhost:3001` (для разработки)
   - **Authorized redirect URIs**: `http://localhost:3001/oauth2callback` (для разработки)
7. Нажмите **"CREATE"**
8. Скопируйте **Client ID** и **Client Secret** (они понадобятся позже)

### Шаг 4: Получение Refresh Token

Для работы без интерактивной авторизации нужен Refresh Token. Получить его можно несколькими способами:

#### Способ A: Использование Google OAuth 2.0 Playground

1. Перейдите на [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. В правом верхнем углу нажмите на иконку настроек (⚙️)
3. Установите флажок **"Use your own OAuth credentials"**
4. Введите ваш **Client ID** и **Client Secret**
5. В левой панели найдите **"Calendar API v3"** и выберите:
   - `https://www.googleapis.com/auth/calendar`
6. Нажмите **"Authorize APIs"**
7. Войдите в свой Google аккаунт и предоставьте разрешения
8. Нажмите **"Exchange authorization code for tokens"**
9. Скопируйте значение **"Refresh token"**

#### Способ B: Использование Node.js скрипта

Создайте файл `get-refresh-token.js`:

```javascript
import { google } from 'googleapis';
import readline from 'readline';

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost:3001/oauth2callback'
);

const scopes = ['https://www.googleapis.com/auth/calendar'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
});

console.log('Откройте эту ссылку в браузере:');
console.log(authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Введите код из URL после авторизации: ', (code) => {
  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error('Ошибка получения токена:', err);
      return;
    }
    console.log('Refresh Token:', token.refresh_token);
    rl.close();
  });
});
```

Запустите скрипт и следуйте инструкциям.

### Шаг 5: Настройка переменных окружения

Добавьте в `.env`:

```env
# Google Calendar - OAuth 2.0
GOOGLE_CALENDAR_ID=primary
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

### Шаг 6: Проверка подключения

Выполните шаг 8 из способа 1 (Service Account).

---

## Сравнение способов

| Критерий | Service Account | OAuth 2.0 |
|----------|----------------|-----------|
| Сложность настройки | Проще | Сложнее |
| Интерактивная авторизация | Не требуется | Требуется (один раз) |
| Подходит для | Серверных приложений | Пользовательских приложений |
| Доступ к календарю | Нужно явно предоставить | От имени пользователя |
| Рекомендуется для | ✅ Production | ⚠️ Разработка/тестирование |

---

## Решение проблем

### Ошибка: "Calendar API has not been used"

**Причина:** Google Calendar API не включен в проекте.

**Решение:**
1. Перейдите в Google Cloud Console → APIs & Services → Library
2. Найдите "Google Calendar API" и включите его

### Ошибка: "Insufficient Permission" или "Forbidden"

**Причина:** Service Account не имеет доступа к календарю.

**Решение:**
1. Убедитесь, что вы добавили email Service Account в настройки календаря
2. Проверьте, что уровень доступа — "Управление событиями" (Make changes to events)
3. Если используете отдельный календарь, проверьте правильность `GOOGLE_CALENDAR_ID`

### Ошибка: "Invalid credentials" или "Invalid JWT"

**Причина:** Неправильно скопирован приватный ключ.

**Решение:**
1. Убедитесь, что `GOOGLE_PRIVATE_KEY` заключён в двойные кавычки
2. Проверьте, что все символы `\n` сохранены
3. Убедитесь, что ключ начинается с `-----BEGIN PRIVATE KEY-----` и заканчивается `-----END PRIVATE KEY-----`

### Ошибка: "Token has been expired or revoked" (OAuth 2.0)

**Причина:** Refresh Token истёк или был отозван.

**Решение:**
1. Получите новый Refresh Token (см. Шаг 4 способа 2)
2. Обновите `GOOGLE_REFRESH_TOKEN` в `.env`

### События не создаются в календаре

**Причина:** Неправильный Calendar ID или недостаточные права.

**Решение:**
1. Проверьте `GOOGLE_CALENDAR_ID`:
   - Для основного календаря: `primary`
   - Для отдельного календаря: найдите ID в настройках календаря
2. Убедитесь, что Service Account имеет права "Управление событиями"

---

## Дополнительные настройки

### Использование отдельного календаря

Если вы создали отдельный календарь для бронирований:

1. Откройте настройки календаря в Google Calendar
2. Прокрутите вниз до раздела **"Интеграция календаря"**
3. Найдите **"Calendar ID"** (обычно это email вида `calendar-id@group.calendar.google.com`)
4. Используйте этот ID в `GOOGLE_CALENDAR_ID`:

```env
GOOGLE_CALENDAR_ID=calendar-id@group.calendar.google.com
```

### Настройка рабочего времени

В `.env` можно настроить рабочие часы:

```env
WORK_HOURS_START=10:00
WORK_HOURS_END=18:00
SLOT_DURATION_MINUTES=30
MIN_ADVANCE_HOURS=2
```

Эти настройки используются для генерации доступных интервалов бронирования.

---

## Безопасность

⚠️ **ВАЖНО:**

1. **Никогда не публикуйте** файл с ключами Service Account или `.env` файл в публичных репозиториях
2. Добавьте `.env` в `.gitignore`
3. Для production используйте переменные окружения сервера или секреты
4. Регулярно проверяйте, какие приложения имеют доступ к вашему календарю
5. При компрометации ключей немедленно удалите их в Google Cloud Console и создайте новые

---

## Проверка работы

После настройки проверьте работу интеграции:

1. **Проверка получения событий:**
   ```bash
   curl "http://localhost:3001/api/availability?date=2025-01-15"
   ```

2. **Создание тестового бронирования:**
   ```bash
   curl -X POST http://localhost:3001/api/bookings \
     -H "Content-Type: application/json" \
     -d '{
       "date": "2025-01-15",
       "startUtc": "2025-01-15T10:00:00Z",
       "endUtc": "2025-01-15T10:30:00Z",
       "contactRaw": "test@example.com",
       "contactType": "EMAIL",
       "consentPersonal": true
     }'
   ```

3. **Проверка в Google Calendar:**
   - Откройте Google Calendar
   - Убедитесь, что событие создано в указанное время

---

## Дополнительная информация

- [Документация Google Calendar API](https://developers.google.com/calendar/api)
- [Документация Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Документация OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

Если у вас возникли проблемы, проверьте логи приложения и убедитесь, что все переменные окружения установлены правильно.

