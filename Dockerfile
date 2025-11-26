## Multi-stage Dockerfile для продакшн-сборки фронтенда (React + Vite)

# Stage 1: build
FROM node:20-alpine AS build

WORKDIR /app

# Устанавливаем только необходимые зависимости по lock-файлу
COPY package.json package-lock.json ./
RUN npm ci

# Копируем исходники фронтенда
COPY . .

# Продакшн-сборка Vite
RUN npm run build


# Stage 2: минимальный nginx-образ для отдачи статики
FROM nginx:1.27-alpine AS production

# Копируем собранный фронтенд
COPY --from=build /app/dist /usr/share/nginx/html

# Гарантируем корректные права для пользователя nginx
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

# Запускаем nginx не от root (официальный образ использует пользователя nginx)
USER nginx

# Запуск nginx в foreground-режиме
CMD ["nginx", "-g", "daemon off;"]


