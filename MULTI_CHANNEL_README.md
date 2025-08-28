# Много-канальная система для Telegram бота

## Описание
Система позволяет модераторам работать с несколькими Telegram каналами через одного бота. Каждый канал имеет свои настройки, URL для интеграции с n8n и отдельные потоки обработки новостей.

## Основные возможности

### 🎯 Выбор канала
- Команда `/select_channel` для выбора канала модерации
- Автоматический выбор единственного канала при его наличии
- Сессии пользователей сохраняют выбранный канал

### 📢 Работа с каналами
- Разные URL для n8n интеграции по каналам
- Отдельные потоки обработки новостей
- Публикация в разные каналы
- Разные стили контента для каждого канала

### 🔄 Перегенерация контента
- Перегенерация заголовков через соответствующие n8n флоу канала
- Перегенерация текста через соответствующие n8n флоу канала
- Сохранение статистики регенераций по каналам

## Конфигурация

### Структура канала
```typescript
interface Channel {
  id: string;              // Уникальный идентификатор канала
  name: string;            // Отображаемое имя канала
  description: string;     // Описание канала
  channelId: string;       // ID Telegram канала (@channelname или -100...)
  n8nTriggerUrl: string;   // URL для запуска обработки новостей
  n8nRegenerateUrl?: string; // URL для перегенерации контента (опционально)
  webhookToken?: string;   // Токен для webhook авторизации (опционально)
}
```

### Переменные окружения
```bash
# Конфигурация каналов в формате JSON
CHANNELS=[
  {
    "id": "alarm_payments",
    "name": "ALARM PAYMENTS",
    "description": "Трансграничные платежи и финансовые новости",
    "channelId": "@alarm_payments_channel",
    "n8nTriggerUrl": "https://your-n8n-instance.com/webhook/alarm-payments-trigger",
    "n8nRegenerateUrl": "https://your-n8n-instance.com/webhook/alarm-payments-regenerate"
  }
]
```

## API Endpoints

### Webhook эндпойнты

#### 1. Обработка новостей по каналам
```
POST /news-processed/:channelId
```

Пример использования:
```bash
# Без userId (уведомляются все админы)
curl -X POST https://your-bot.com/news-processed/alarm_payments \
  -H "Content-Type: application/json" \
  -d '{
    "news": [...],
    "error": null
  }'

# С userId (уведомляется конкретный пользователь)
curl -X POST https://your-bot.com/news-processed/alarm_payments \
  -H "Content-Type: application/json" \
  -d '{
    "news": [...],
    "error": null,
    "userId": 123456789
  }'
```

#### 2. Универсальный эндпойнт (для обратной совместимости)
```
POST /news-processed
```

Пример использования:
```bash
# Без userId (уведомляются все админы)
curl -X POST https://your-bot.com/news-processed \
  -H "Content-Type: application/json" \
  -d '{
    "news": [...],
    "error": null
  }'

# С userId (уведомляется конкретный пользователь)
curl -X POST https://your-bot.com/news-processed \
  -H "Content-Type: application/json" \
  -d '{
    "news": [...],
    "error": null,
    "userId": 123456789
  }'
```

## Команды бота

### /select_channel
Открывает меню выбора канала для модерации

### /get_posts
Запускает обработку новостей для выбранного канала

### /view_posts
Показывает уже запрошенные и сохраненные новости (без нового запроса к n8n)

### /test_post
Отправляет тестовое сообщение в выбранный канал

### /check_channel
Показывает информацию о выбранном канале и статусе бота

### /set_commands
Обновляет список команд в Telegram (добавляет новые команды в меню)

## Пример использования

### 1. Настройка каналов
```bash
# В файле .env
CHANNELS=[
  {
    "id": "alarm_payments",
    "name": "ALARM PAYMENTS",
    "description": "Трансграничные платежи",
    "channelId": "@alarm_payments",
    "n8nTriggerUrl": "https://n8n.example.com/webhook/alarm-trigger",
    "n8nRegenerateUrl": "https://n8n.example.com/webhook/alarm-regenerate"
  },
  {
    "id": "crypto_news",
    "name": "Крипто Новости",
    "description": "Новости криптовалют",
    "channelId": "@crypto_news",
    "n8nTriggerUrl": "https://n8n.example.com/webhook/crypto-trigger"
  }
]
```

### 2. Работа с ботом
1. Пользователь запускает `/select_channel`
2. Выбирает нужный канал (например, "ALARM PAYMENTS")
3. Запускает `/get_posts` - новости обрабатываются через соответствующий n8n флоу
4. При перегенерации контента используются соответствующие URL канала
5. Пост публикуется в выбранный канал

## Архитектура

### Middleware
- `requireSelectedChannel()` - проверяет выбран ли канал
- `logCurrentChannel()` - логирует текущий канал пользователя

### Сервисы
- `ChannelService` - управление каналами и их конфигурациями
- Обновленные обработчики команд для работы с каналами
- Модифицированные callback обработчики

### Хранение данных
- Сессии пользователей сохраняют выбранный канал
- Глобальное хранилище новостей работает по пользователям
- Статистика постов сохраняется с учетом каналов

## Безопасность

### Webhook токены
Каждый канал может иметь свой webhook токен для авторизации:
```typescript
{
  "webhookToken": "alarm_payments_webhook_token"
}
```

### Проверка каналов
- Валидация существования каналов при запуске
- Проверка прав бота в каналах
- Логирование всех операций с каналами

## Мониторинг и логирование

### Логи
- Все операции с каналами логируются с указанием channelId
- Отдельные логи для каждого канала
- Детальная диагностика ошибок по каналам

### Статистика
- Статистика по каждому каналу отдельно
- Учет регенераций контента по каналам
- Публикации в соответствующие каналы

## Расширение

### Добавление нового канала
1. Добавить канал в конфигурацию CHANNELS
2. Настроить соответствующие n8n флоу
3. Протестировать интеграцию

### Кастомизация поведения
- Переопределить методы ChannelService
- Добавить специфические обработчики для каналов
- Создать отдельные middleware для специфических каналов

## Обратная совместимость
- Система поддерживает старые конфигурации
- DEFAULT_N8N_TRIGGER_URL работает для канала по умолчанию
- Существующие команды продолжают работать

## Пример для канала "ALARM PAYMENTS"

```json
{
  "id": "alarm_payments",
  "name": "ALARM PAYMENTS",
  "description": "Трансграничные платежи, инвойсинг, валютный контроль и международные переводы",
  "channelId": "@alarm_payments",
  "n8nTriggerUrl": "https://n8n.example.com/webhook/alarm-payments-trigger",
  "n8nRegenerateUrl": "https://n8n.example.com/webhook/alarm-payments-regenerate",
  "webhookToken": "alarm_payments_token"
}
```

Особенности канала:
- 🔥 Алармный, провокационный стиль
- ⏰ Публикация 2 раза в день в 14:00
- 🎯 FOMO элементы в контенте
- 💣 Кричащие заголовки
- 📈 Эффект срочности и важности

