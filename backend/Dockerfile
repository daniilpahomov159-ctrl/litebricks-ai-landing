# =============================================================================
# Dockerfile для production - Backend (Express + Prisma)
# Multi-stage build с оптимизацией размера образа
# =============================================================================
# Использование: docker build -t litebricks-backend:latest .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: base - Базовый образ с общими настройками
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Метаданные образа
LABEL maintainer="litebricks"
LABEL description="Litebricks Booking Backend - Express + Prisma"
LABEL version="1.0.0"

# Устанавливаем рабочую директорию
WORKDIR /app

# Переменные окружения для Node.js
ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=warn

# Устанавливаем необходимые пакеты для Prisma и удаляем кэш в одном слое
# openssl - требуется для Prisma
# dumb-init - правильная обработка сигналов в контейнере
RUN apk add --no-cache \
        openssl \
        dumb-init \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# -----------------------------------------------------------------------------
# Stage 2: deps - Установка production зависимостей
# -----------------------------------------------------------------------------
FROM base AS deps

# Копируем только файлы для установки зависимостей (кэширование слоёв)
COPY package.json package-lock.json ./

# Устанавливаем ТОЛЬКО production зависимости
# Очищаем кэш npm для уменьшения размера
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/tmp/*

# -----------------------------------------------------------------------------
# Stage 3: prisma - Генерация Prisma Client
# -----------------------------------------------------------------------------
FROM base AS prisma

# Для генерации Prisma нужны devDependencies
ENV NODE_ENV=development

# Копируем файлы зависимостей
COPY package.json package-lock.json ./

# Устанавливаем все зависимости для генерации Prisma
RUN npm ci \
    && npm cache clean --force

# Копируем Prisma схему
COPY prisma ./prisma

# Генерируем Prisma Client
# PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 для совместимости с Alpine
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN npx prisma generate

# Удаляем ненужные файлы Prisma engine для других платформ
# Оставляем только linux-musl-openssl (Alpine)
RUN find node_modules/.prisma -name "libquery_engine-*" ! -name "*linux-musl*" -delete 2>/dev/null || true \
    && find node_modules/@prisma -name "libquery_engine-*" ! -name "*linux-musl*" -delete 2>/dev/null || true

# -----------------------------------------------------------------------------
# Stage 4: runner - Финальный production образ
# -----------------------------------------------------------------------------
FROM base AS runner

# Создаём непривилегированного пользователя для безопасности
# Используем числовые ID для совместимости с Kubernetes
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs backend

# Создаём директории для приложения
RUN mkdir -p /app/prisma /app/src \
    && chown -R backend:nodejs /app

# Копируем production зависимости из deps stage
COPY --from=deps --chown=backend:nodejs /app/node_modules ./node_modules

# Копируем сгенерированный Prisma Client
COPY --from=prisma --chown=backend:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma --chown=backend:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Копируем Prisma схему (нужна для миграций)
COPY --chown=backend:nodejs prisma ./prisma

# Копируем исходный код приложения
COPY --chown=backend:nodejs src ./src
COPY --chown=backend:nodejs package.json ./package.json

# Переключаемся на непривилегированного пользователя
USER backend

# Переменные окружения для production
ENV NODE_ENV=production
ENV PORT=3001
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Порт приложения
EXPOSE 3001

# Healthcheck для оркестраторов (Docker Swarm, Kubernetes)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

# Используем dumb-init для правильной обработки сигналов
# Это важно для graceful shutdown
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Запуск приложения
# Используем exec form для корректной обработки сигналов
CMD ["node", "src/app.js"]
