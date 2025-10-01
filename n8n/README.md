# n8n Workflows для Fintech Bot

## create_news.json

Workflow для создания постов на основе новостей с использованием Firecrawl и AI.

### Поток выполнения:

1. **Webhook Trigger** - получает POST запрос на `/create_news`
2. **Extract Data** - извлекает данные из запроса
3. **Scrape with Firecrawl** - получает полный контент страницы по ссылке
4. **Prepare AI Data** - подготавливает данные для AI агента
5. **AI Generate Post** - генерирует пост с помощью OpenAI
6. **Process AI Response** - обрабатывает ответ AI и приводит к стандартному формату
7. **Send to Bot** - отправляет результат в бот
8. **Respond to Webhook** - возвращает ответ

### Необходимые credentials:

1. **Firecrawl API** - для скрапинга контента
2. **OpenAI API** - для генерации постов

### Переменные окружения:

```
BOT_WEBHOOK_URL=https://your-bot-domain.com/webhook
```

### Входящие данные:

```json
{
  "title": "Заголовок новости",
  "description": "Описание новости",
  "link": "https://example.com/news",
  "image": "https://example.com/image.jpg",
  "category": "финансы",
  "urgency": "средняя",
  "publishedAt": "2025-01-26",
  "source": "РБК",
  "channelId": "fintech85",
  "channelName": "Fintech85",
  "channelDescription": "FINTECH SU NEWS",
  "userId": 123456789,
  "aiPrompt": "Создай аналитический пост для финтех-аудитории..."
}
```

### Исходящие данные:

```json
{
  "title": "Заголовок поста",
  "content": "Текст поста с форматированием",
  "hashtags": ["#финансы", "#новости"],
  "image": "URL изображения или null",
  "link": "Ссылка на источник",
  "metadata": {
    "wordCount": 150,
    "hasEmojis": true,
    "hasHashtags": true
  }
}
```

## regenerate_post.json

Workflow для перегенерации заголовка или текста поста с использованием Firecrawl и AI.

### Поток выполнения:

1. **Webhook Trigger** - получает POST запрос на `/regenerate_post`
2. **Extract Data** - извлекает данные из запроса
3. **Scrape with Firecrawl** - получает полный контент страницы по ссылке
4. **Prepare AI Data** - подготавливает данные для AI агента
5. **AI Regenerate** - генерирует новый заголовок или текст с помощью OpenAI
6. **Process Response** - обрабатывает ответ AI и приводит к стандартному формату
7. **Respond to Webhook** - возвращает ответ

### Входящие данные:

```json
{
  "action": "regenerate_title|regenerate_text",
  "link": "https://example.com/news",
  "current_title": "Текущий заголовок",
  "current_text": "Текущий текст поста",
  "channelId": "fintech85",
  "channelName": "Fintech85"
}
```

### Исходящие данные:

**Для regenerate_title:**
```json
{
  "new_title": "Новый заголовок",
  "success": true,
  "action": "regenerate_title"
}
```

**Для regenerate_text:**
```json
{
  "new_text": "Новый текст поста",
  "success": true,
  "action": "regenerate_text"
}
```

### Установка:

1. Импортируйте `create_news.json` и `regenerate_post.json` в n8n
2. Настройте credentials для Firecrawl и OpenAI
3. Установите переменную `BOT_WEBHOOK_URL`
4. Активируйте workflows

### Тестирование:

**Создание поста:**
```bash
curl -X POST https://your-n8n-instance.com/webhook/create_news \
  -H "Content-Type: application/json" \
  -d '{
    "title": "ЦБ продлил ограничения на перевод валюты",
    "description": "Центральный банк пролонгировал действие валютных ограничений",
    "link": "https://vc.ru/money/2238753-cb-prodlil-ogranicheniya-na-perevod-valyuty",
    "category": "банки",
    "urgency": "средняя",
    "source": "VC.ru",
    "channelId": "fintech85",
    "channelName": "Fintech85",
    "userId": 123456789,
    "aiPrompt": "Создай аналитический пост для финтех-аудитории..."
  }'
```

**Перегенерация заголовка:**
```bash
curl -X POST https://your-n8n-instance.com/webhook/regenerate_post \
  -H "Content-Type: application/json" \
  -d '{
    "action": "regenerate_title",
    "link": "https://vc.ru/money/2238753-cb-prodlil-ogranicheniya-na-perevod-valyuty",
    "current_title": "ЦБ продлил ограничения на перевод валюты",
    "current_text": "Текущий текст поста...",
    "channelId": "fintech85",
    "channelName": "Fintech85"
  }'
```

**Перегенерация текста:**
```bash
curl -X POST https://your-n8n-instance.com/webhook/regenerate_post \
  -H "Content-Type: application/json" \
  -d '{
    "action": "regenerate_text",
    "link": "https://vc.ru/money/2238753-cb-prodlil-ogranicheniya-na-perevod-valyuty",
    "current_title": "ЦБ продлил ограничения на перевод валюты",
    "current_text": "Текущий текст поста...",
    "channelId": "fintech85",
    "channelName": "Fintech85"
  }'
```
