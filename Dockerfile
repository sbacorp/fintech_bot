# Используем официальный Node.js образ как базовый
FROM node:18-alpine AS base

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Этап установки зависимостей
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Этап сборки
FROM base AS builder
# Копируем все файлы для сборки
COPY . .
# Устанавливаем все зависимости (включая dev)
RUN npm ci
# Собираем TypeScript
RUN npm run build

# Финальный этап
FROM base AS runner

# Создаем пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser

# Копируем собранные файлы и зависимости
COPY --from=builder --chown=nodeuser:nodejs /app/build ./build
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/package*.json ./

# Создаем директорию для логов
RUN mkdir -p logs && chown nodeuser:nodejs logs

# Переключаемся на непривилегированного пользователя
USER nodeuser

# Открываем порт
EXPOSE 3000

# Устанавливаем переменные окружения
ENV NODE_ENV=production
ENV PORT=3000

# Команда запуска
CMD ["node", "build/index.js"]
