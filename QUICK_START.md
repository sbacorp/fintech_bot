# 🚀 Быстрый старт FINTECH Telegram Bot

## Предварительные требования

- Node.js 18+ 
- npm или yarn
- Docker & Docker Compose (опционально)
- Telegram Bot Token (получить у @BotFather)

## Шаг 1: Настройка переменных окружения

```bash
# Копируем пример конфигурации
cp env.example .env

# Редактируем .env файл
nano .env
```

### Обязательные переменные в .env:

```env
# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
CHANNEL_ID=@your_channel_id_here

# Bot Settings  
BOT_USERNAME=your_bot_username
ADMIN_USER_IDS=123456789,987654321
```

## Шаг 2: Установка зависимостей

```bash
npm install
```

## Шаг 3: Сборка проекта

```bash
npm run build
```

## Шаг 4: Запуск бота

### Локальный запуск:
```bash
npm run dev
```

### Продакшн запуск:
```bash
npm start
```

### Docker запуск:
```bash
docker-compose up -d
```

## Шаг 5: Проверка работы

1. Найдите вашего бота в Telegram
2. Отправьте команду `/start`
3. Проверьте статус командой `/status`

## Доступные команды

### Общие команды:
- `/start` - Запуск бота
- `/help` - Справка по командам  
- `/status` - Статус бота и канала
- `/stats` - Статистика канала

### Админские команды:
- `/admin` - Админ-панель
- `/publish [текст]` - Публикация поста
- `/schedule` - Управление расписанием
- `/test` - Тестовая публикация

## Структура проекта

```
fintech-bot/
├── src/
│   ├── bot/              # Логика бота
│   ├── services/         # Сервисы
│   ├── types/            # TypeScript типы
│   ├── utils/            # Утилиты
│   └── config/           # Конфигурация
├── scripts/              # Скрипты
├── logs/                 # Логи (создается автоматически)
├── docker-compose.yml    # Docker конфигурация
└── package.json
```

## Логирование

Логи сохраняются в папку `logs/`:
- `bot.log` - основные логи
- `error.log` - только ошибки

## Разработка

```bash
# Запуск в режиме разработки с автоперезагрузкой
npm run dev

# Линтинг кода
npm run lint

# Исправление ошибок линтера
npm run lint:fix

# Тесты
npm test
```

## Docker команды

```bash
# Сборка образа
docker build -t fintech-bot .

# Запуск контейнера
docker run -d --name fintech-bot fintech-bot

# Просмотр логов
docker logs fintech-bot

# Остановка контейнера
docker stop fintech-bot
```

## Troubleshooting

### Ошибка "Bot does not have required permissions"
1. Добавьте бота в канал как администратора
2. Убедитесь, что у бота есть права на публикацию сообщений

### Ошибка "Missing required environment variables"
1. Проверьте, что файл `.env` существует
2. Убедитесь, что все обязательные переменные заполнены

### Бот не отвечает на команды
1. Проверьте логи в папке `logs/`
2. Убедитесь, что токен бота правильный
3. Проверьте, что бот не заблокирован

## Следующие шаги

После успешного запуска базового бота:

1. **Интеграция с N8N** - автоматизация генерации контента
2. **AI интеграция** - генерация текста и изображений  
3. **Admin Panel** - веб-интерфейс для модерации
4. **Firecrawl** - парсинг новостей
5. **Автоматизация** - планировщик публикаций

---

**Поддержка:** Если возникли проблемы, проверьте логи и обратитесь к документации.
