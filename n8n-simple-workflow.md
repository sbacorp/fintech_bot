# Простой n8n Workflow для обработки newsUrls с Firecrawl

## Быстрый старт

### 1. Создайте новый workflow в n8n

### 2. Добавьте узлы в следующем порядке:

#### Узел 1: Webhook Trigger
- **Тип**: Webhook
- **HTTP Method**: POST
- **Path**: `fintech85_search_posts`
- **Response Mode**: "On Received"

#### Узел 2: Code - Подготовка данных
```javascript
// Получаем входящие данные
const inputData = $input.all()[0].json;

// Создаем массив для обработки каждого URL
const results = [];

// Возвращаем данные с массивом URLs для обработки
return [{
  json: {
    channelId: inputData.channelId,
    channelName: inputData.channelName,
    userId: inputData.userId,
    action: inputData.action,
    newsUrls: inputData.newsUrls,
    results: results,
    currentIndex: 0,
    totalUrls: inputData.newsUrls.length
  }
}];
```

#### Узел 3: IF - Проверка завершения
**Условие:**
```javascript
{{ $json.currentIndex < $json.totalUrls }}
```

#### Узел 4: HTTP Request - Firecrawl API
- **Method**: POST
- **URL**: `https://api.firecrawl.dev/v1/scrape`
- **Headers**:
  ```
  Authorization: Bearer {{ $vars.FIRECRAWL_API_KEY }}
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "url": "={{ $json.newsUrls[$json.currentIndex] }}",
    "formats": ["markdown"],
    "onlyMainContent": true,
    "maxLength": 5000
  }
  ```

#### Узел 5: Code - Обработка результата
```javascript
const currentData = $input.all()[0].json;
const firecrawlResult = $input.all()[1].json;

// Извлекаем данные
const scrapedData = firecrawlResult.data || firecrawlResult;

// Добавляем результат в массив
currentData.results.push({
  url: currentData.newsUrls[currentData.currentIndex],
  title: scrapedData.metadata?.title || 'No title',
  content: scrapedData.markdown || '',
  description: scrapedData.metadata?.description || '',
  processedAt: new Date().toISOString(),
  success: true
});

// Увеличиваем индекс
currentData.currentIndex++;

return [{ json: currentData }];
```

#### Узел 6: Wait
- **Amount**: 1
- **Unit**: Seconds

#### Узел 7: Merge - Возврат к IF
- **Mode**: "Append"

#### Узел 8: Code - Финальная обработка
```javascript
const finalData = $input.all()[0].json;

// Создаем финальный ответ
const response = {
  channelId: finalData.channelId,
  channelName: finalData.channelName,
  userId: finalData.userId,
  processedUrls: finalData.results.length,
  newsData: finalData.results,
  success: true,
  completedAt: new Date().toISOString()
};

return [{ json: response }];
```

#### Узел 9: HTTP Request - Отправка в бот
- **Method**: POST
- **URL**: `{{ $vars.BOT_WEBHOOK_URL }}/webhook/news-processed`
- **Body**: `{{ $json }}`

#### Узел 10: Respond to Webhook
- **Respond With**: JSON
- **Response Body**: `{{ $json }}`

## Настройка переменных окружения

В n8n добавьте переменные:
- `FIRECRAWL_API_KEY` - ваш API ключ от Firecrawl
- `BOT_WEBHOOK_URL` - URL вашего бота

## Схема соединений

```
Webhook → Code(Prepare) → IF → HTTP(Firecrawl) → Code(Process) → Wait → Merge → IF
                                                                    ↑         ↓
                                                                    ←─────────┘
                                                                    ↓
Code(Finalize) → HTTP(Send to Bot) → Respond to Webhook
```

## Обработка ошибок

Добавьте Error Trigger после HTTP Request узла:

```javascript
// Error Handler Code
const error = $input.all()[0].json;

return [{
  json: {
    error: true,
    message: error.message,
    url: error.url || 'unknown',
    timestamp: new Date().toISOString()
  }
}];
```

## Тестирование

1. **Импортируйте workflow** в n8n
2. **Настройте переменные** окружения
3. **Активируйте workflow**
4. **Отправьте тестовый запрос**:

```bash
curl -X POST https://your-n8n-instance.com/webhook/fintech85_search_posts \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "fintech85",
    "channelName": "Fintech85",
    "userId": 123456789,
    "action": "search_news",
    "newsUrls": [
      "https://vc.ru/money",
      "https://www.rbc.ru/finances/"
    ]
  }'
```

## Ожидаемый результат

n8n вернет JSON с обработанными данными:

```json
{
  "channelId": "fintech85",
  "channelName": "Fintech85",
  "userId": 123456789,
  "processedUrls": 2,
  "newsData": [
    {
      "url": "https://vc.ru/money",
      "title": "Заголовок статьи",
      "content": "Содержимое статьи в markdown...",
      "description": "Описание статьи",
      "processedAt": "2024-01-15T10:00:00.000Z",
      "success": true
    }
  ],
  "success": true,
  "completedAt": "2024-01-15T10:00:00.000Z"
}
```

