# Docker настройка для Fintech Telegram Bot

## Быстрый старт

### 1. Подготовка окружения

Создайте файл `.env` на основе `env.example`:

```bash
cp env.example .env
```

Отредактируйте `.env` файл, указав ваши реальные значения:

```env
# Telegram Bot Configuration
BOT_TOKEN=ваш_токен_бота

# Bot Settings
BOT_USERNAME=@ваш_бот
BOT_ADMIN_USER_IDS=ваш_id,другой_id
MAIN_CONTENT_CREATOR_ID=ваш_id

# N8N Integration
BASE_N8N_WEBHOOK_URL=https://n8n.your-domain.com/webhook

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=ваш_анонимный_ключ
SUPABASE_SERVICE_ROLE_KEY=ваш_сервисный_ключ

# Channels Configuration
CHANNELS=[{"id": "channel1","name": "Channel 1","description": "Description","channelId": "@channel1"}]

# Остальные настройки...
```

### 2. Сборка и запуск

```bash
# Разработка (порт 3000)
docker-compose build
docker-compose up -d
docker-compose logs -f fintech-bot

# Production (порт 8080)
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml logs -f fintech-bot
```

### 3. Остановка

```bash
# Остановка контейнера
docker-compose down

# Остановка с удалением образов
docker-compose down --rmi all
```

## Команды для разработки

### Пересборка после изменений кода

```bash
# Принудительная пересборка
docker-compose build --no-cache

# Перезапуск с пересборкой
docker-compose up -d --build
```

### Просмотр логов

```bash
# Все логи
docker-compose logs fintech-bot

# Логи в реальном времени
docker-compose logs -f fintech-bot

# Последние 100 строк
docker-compose logs --tail=100 fintech-bot
```

### Вход в контейнер

```bash
# Вход в запущенный контейнер
docker-compose exec fintech-bot sh

# Запуск контейнера в интерактивном режиме
docker-compose run --rm fintech-bot sh
```

## Структура Docker

### Dockerfile

Использует многоэтапную сборку для оптимизации размера образа:

1. **base** - базовый образ Node.js 18 Alpine
2. **deps** - установка production зависимостей
3. **builder** - сборка TypeScript кода
4. **runner** - финальный образ с собранным приложением

### docker-compose.yml

- **fintech-bot** - основной сервис с ботом (порт 3000)
- **supabase** - опциональный локальный Supabase (закомментирован)
- **networks** - изолированная сеть для сервисов
- **volumes** - монтирование логов

### docker-compose.prod.yml

- **fintech-bot** - production сервис с ботом (порт 8080)
- **networks** - изолированная сеть для сервисов
- **volumes** - монтирование логов
- **healthcheck** - проверка здоровья приложения
- **resource limits** - ограничения ресурсов

## Переменные окружения

Все переменные из `.env` файла автоматически передаются в контейнер:

- `BOT_TOKEN` - токен Telegram бота
- `BOT_USERNAME` - имя бота
- `BOT_ADMIN_USER_IDS` - ID администраторов
- `MAIN_CONTENT_CREATOR_ID` - ID создателя контента
- `BASE_N8N_WEBHOOK_URL` - базовый URL для N8N webhook
- `SUPABASE_URL` - URL Supabase проекта
- `SUPABASE_ANON_KEY` - анонимный ключ Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - сервисный ключ Supabase
- `CHANNELS` - конфигурация каналов в JSON формате
- `LOG_LEVEL` - уровень логирования
- `NODE_ENV` - окружение (production/development)
- `PORT` - порт приложения (по умолчанию 3000)
- `POSTING_SCHEDULE` - расписание постинга (cron формат)

## Мониторинг и логи

Логи сохраняются в директории `./logs` на хосте и доступны через:

```bash
# Docker логи
docker-compose logs fintech-bot

# Файловые логи
tail -f logs/bot.log
```

## Безопасность

- Контейнер запускается от непривилегированного пользователя `nodeuser`
- Используется Alpine Linux для минимального размера образа
- Многоэтапная сборка исключает dev-зависимости из финального образа

## Troubleshooting

### Проблемы с правами доступа

```bash
# Исправление прав на директорию логов
sudo chown -R $USER:$USER logs/
```

### Очистка Docker

```bash
# Удаление неиспользуемых образов
docker image prune -a

# Удаление неиспользуемых контейнеров
docker container prune

# Полная очистка
docker system prune -a
```

### Проверка состояния

```bash
# Статус контейнеров
docker-compose ps

# Использование ресурсов
docker stats

# Информация об образе
docker images fintech-telegram-bot
```
