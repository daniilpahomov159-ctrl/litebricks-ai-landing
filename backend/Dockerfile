## Multi-stage Dockerfile для продакшн-сборки backend (Node.js + Express + Prisma)

# Базовый образ
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Создаём непривилегированного пользователя для запуска приложения
RUN addgroup -S appgroup && adduser -S appuser -G appgroup


# Stage deps: установка только prod-зависимостей
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev


# Stage build: полная установка зависимостей + генерация Prisma Client
FROM base AS build
ENV NODE_ENV=development

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src


# Stage production: финальный лёгкий образ
FROM base AS production

# Копируем только то, что нужно для запуска
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json

# Гарантируем, что приложение принадлежит непривилегированному пользователю
RUN chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production

EXPOSE 3000

# Основная команда запуска
CMD ["node", "src/app.js"]


