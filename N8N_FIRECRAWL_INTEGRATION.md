# Интеграция n8n с Firecrawl API для обработки newsUrls

## Обзор

Это руководство описывает, как настроить n8n workflow для обработки списка URLs из поля `newsUrls`, отправки запросов в Firecrawl API и объединения результатов.

## Структура входящих данных

n8n будет получать следующий JSON:

```json
{
  "channelId": "fintech85",
  "channelName": "Fintech85",
  "userId": 123456789,
  "action": "search_news",
  "newsUrls": [
    "https://vc.ru/money",
    "https://www.rbc.ru/finances/",
    "https://www.coindesk.com/latest-crypto-news"
  ]
}
```

## Настройка n8n Workflow

### 1. Webhook Trigger Node

**Настройки:**
- **HTTP Method**: POST
- **Path**: `/fintech85_search_posts` (или соответствующий путь)
- **Response Mode**: "On Received"

### 2. Set Node - Извлечение URLs

**Настройки:**
```javascript
// В поле "Values to Set"
{
  "channelId": "={{ $json.channelId }}",
  "channelName": "={{ $json.channelName }}",
  "userId": "={{ $json.userId }}",
  "action": "={{ $json.action }}",
  "newsUrls": "={{ $json.newsUrls }}"
}
```

### 3. Split In Batches Node

**Настройки:**
- **Batch Size**: 1
- **Options**: 
  - ✅ "Reset"
  - ✅ "Options"

**Цель**: Разделить массив `newsUrls` на отдельные элементы для обработки каждого URL.

### 4. HTTP Request Node - Firecrawl API

**Настройки:**
- **Method**: POST
- **URL**: `https://api.firecrawl.dev/v1/scrape`
- **Headers**:
  ```
  Authorization: Bearer YOUR_FIRECRAWL_API_KEY
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "url": "={{ $json.newsUrls }}",
    "formats": ["markdown", "html"],
    "onlyMainContent": true,
    "includeTags": ["title", "meta", "links"],
    "excludeTags": ["nav", "footer", "ads", "sidebar"]
  }
  ```

### 5. Wait Node (опционально)

**Настройки:**
- **Amount**: 1
- **Unit**: Seconds

**Цель**: Избежать rate limiting от Firecrawl API.

### 6. Merge Node

**Настройки:**
- **Mode**: "Append"
- **Options**:
  - ✅ "Keep Key Matches"

**Цель**: Объединить все результаты от Firecrawl в один массив.

### 7. Set Node - Форматирование результата

**Настройки:**
```javascript
// В поле "Values to Set"
{
  "channelId": "={{ $('Set').item.json.channelId }}",
  "channelName": "={{ $('Set').item.json.channelName }}",
  "userId": "={{ $('Set').item.json.userId }}",
  "action": "={{ $('Set').item.json.action }}",
  "processedUrls": "={{ $json.length }}",
  "results": "={{ $json }}"
}
```

### 8. HTTP Request Node - Ответ обратно в бот

**Настройки:**
- **Method**: POST
- **URL**: `https://your-bot-domain.com/webhook/news-processed`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "channelId": "={{ $json.channelId }}",
    "channelName": "={{ $json.channelName }}",
    "userId": "={{ $json.userId }}",
    "processedUrls": "={{ $json.processedUrls }}",
    "newsData": "={{ $json.results }}"
  }
  ```

## Альтернативный подход с Loop

Если Split In Batches не подходит, можно использовать Loop:

### 1. Code Node - Подготовка данных

```javascript
// Получаем входящие данные
const inputData = $input.all()[0].json;

// Создаем массив для результатов
const results = [];

// Возвращаем данные для обработки
return [{
  json: {
    ...inputData,
    results: results,
    currentIndex: 0,
    totalUrls: inputData.newsUrls.length
  }
}];
```

### 2. IF Node - Проверка завершения

**Условие:**
```javascript
{{ $json.currentIndex < $json.totalUrls }}
```

### 3. HTTP Request Node - Firecrawl API

**Настройки аналогичны предыдущему варианту, но URL берется по индексу:**
```json
{
  "url": "={{ $json.newsUrls[$json.currentIndex] }}",
  "formats": ["markdown", "html"],
  "onlyMainContent": true
}
```

### 4. Code Node - Обновление индекса

```javascript
const currentData = $input.all()[0].json;
const firecrawlResult = $input.all()[1].json;

// Добавляем результат
currentData.results.push({
  url: currentData.newsUrls[currentData.currentIndex],
  data: firecrawlResult,
  timestamp: new Date().toISOString()
});

// Увеличиваем индекс
currentData.currentIndex++;

return [{
  json: currentData
}];
```

### 5. Merge Node - Возврат к IF Node

## Обработка ошибок

### Error Trigger Node

Добавьте Error Trigger для обработки ошибок:

```javascript
// В Code Node для обработки ошибок
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

## Переменные окружения

В n8n настройте следующие переменные:

```
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
BOT_WEBHOOK_URL=https://your-bot-domain.com/webhook
```

## Пример полного workflow

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "fintech85_search_posts",
        "responseMode": "onReceived"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook"
    },
    {
      "parameters": {
        "values": {
          "string": [
            {
              "name": "channelId",
              "value": "={{ $json.channelId }}"
            },
            {
              "name": "channelName", 
              "value": "={{ $json.channelName }}"
            },
            {
              "name": "newsUrls",
              "value": "={{ $json.newsUrls }}"
            }
          ]
        }
      },
      "name": "Set Data",
      "type": "n8n-nodes-base.set"
    },
    {
      "parameters": {
        "batchSize": 1
      },
      "name": "Split URLs",
      "type": "n8n-nodes-base.splitInBatches"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.firecrawl.dev/v1/scrape",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{ $vars.FIRECRAWL_API_KEY }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "url",
              "value": "={{ $json.newsUrls }}"
            },
            {
              "name": "formats",
              "value": "[\"markdown\", \"html\"]"
            },
            {
              "name": "onlyMainContent",
              "value": "true"
            }
          ]
        }
      },
      "name": "Firecrawl API",
      "type": "n8n-nodes-base.httpRequest"
    },
    {
      "parameters": {
        "amount": 1,
        "unit": "seconds"
      },
      "name": "Wait",
      "type": "n8n-nodes-base.wait"
    },
    {
      "parameters": {
        "mode": "append"
      },
      "name": "Merge Results",
      "type": "n8n-nodes-base.merge"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $vars.BOT_WEBHOOK_URL }}/news-processed",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "channelId",
              "value": "={{ $('Set Data').item.json.channelId }}"
            },
            {
              "name": "results",
              "value": "={{ $json }}"
            }
          ]
        }
      },
      "name": "Send Results",
      "type": "n8n-nodes-base.httpRequest"
    }
  ]
}
```

## Тестирование

1. **Локальное тестирование**: Используйте n8n CLI или webhook тестирование
2. **Проверка Firecrawl**: Убедитесь, что API ключ работает
3. **Проверка rate limits**: Firecrawl имеет ограничения на количество запросов

## Мониторинг

Добавьте логирование в каждый узел для отслеживания:
- Количество обработанных URLs
- Время выполнения
- Ошибки API
- Размер полученных данных
