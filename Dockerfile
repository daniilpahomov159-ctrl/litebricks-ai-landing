# =============================================================================
# Dockerfile для development - Remix SSR Frontend
# Multi-stage build (может использоваться как для dev, так и для простого prod)
# =============================================================================
# Использование: docker build -t litebricks-frontend-dev .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: base - Базовый образ
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Метаданные образа
LABEL maintainer="litebricks"
LABEL description="Litebricks AI Landing - Remix SSR (Development/Build)"

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: deps - Установка зависимостей
# -----------------------------------------------------------------------------
FROM base AS deps

# Копируем файлы зависимостей
COPY package.json package-lock.json ./

# Устанавливаем все зависимости
RUN npm ci \
    && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 3: builder - Сборка приложения
# -----------------------------------------------------------------------------
FROM base AS builder

WORKDIR /app

# Копируем зависимости из предыдущего stage
COPY --from=deps /app/node_modules ./node_modules

# Копируем исходный код
COPY . .

# Production сборка Remix
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 4: production - Минимальный production образ
# -----------------------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production

# Создаём непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs remix

WORKDIR /app

# Копируем только необходимое для запуска
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Устанавливаем владельца
RUN chown -R remix:nodejs /app

USER remix

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["npm", "start"]
