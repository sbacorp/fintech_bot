# Webhook для отправки новостей в Telegram

## Endpoint
```
POST http://localhost:3000/posts
```

## Формат запроса

### Заголовки
```
Content-Type: application/json
```

### Тело запроса
```json
{
  "channelId": "@your_channel_id",  // опционально, если не указан - используется из .env
  "messages": [
    {
      "telegramMessage": "📈 Новости финансов и криптовалют (часть 1/2)\n\n1. 📰 Wyoming State Debuts...",
      "messageNumber": 1,
      "totalMessages": 2,
      "newsCount": 5
    },
    {
      "telegramMessage": "📈 Новости финансов и криптовалют (часть 2/2)\n\n6. 📰 Ripple Extends...",
      "messageNumber": 2,
      "totalMessages": 2,
      "newsCount": 3
    }
  ]
}
```

## Пример ответа

### Успешный ответ (200)
```json
{
  "success": true,
  "channelId": "@your_channel_id",
  "totalMessages": 2,
  "successCount": 2,
  "failureCount": 0,
  "results": [
    {
      "messageNumber": 1,
      "messageId": 12345,
      "status": "sent"
    },
    {
      "messageNumber": 2,
      "messageId": 12346,
      "status": "sent"
    }
  ]
}
```

### Ответ с ошибками (200, но с неудачными сообщениями)
```json
{
  "success": true,
  "channelId": "@your_channel_id",
  "totalMessages": 2,
  "successCount": 1,
  "failureCount": 1,
  "results": [
    {
      "messageNumber": 1,
      "messageId": 12345,
      "status": "sent"
    },
    {
      "messageNumber": 2,
      "status": "failed",
      "error": "Chat not found"
    }
  ]
}
```

### Ошибка запроса (400)
```json
{
  "error": "Invalid request: messages array is required"
}
```

## Дополнительные endpoints

### Проверка здоровья
```
GET http://localhost:3000/health
```

Ответ:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "botInfo": "your_bot_username"
}
```

### Информация о боте
```
GET http://localhost:3000/bot/info
```

Ответ:
```json
{
  "success": true,
  "bot": {
    "id": 123456789,
    "is_bot": true,
    "first_name": "Your Bot",
    "username": "your_bot_username"
  },
  "config": {
    "channelId": "@your_channel_id",
    "isDev": true,
    "isProd": false
  }
}
```

## Использование в n8n

1. **HTTP Request Node** с настройками:
   - Method: POST
   - URL: `http://localhost:3000/posts`
   - Headers: `Content-Type: application/json`
   - Body: результат из news-formatter.js

2. **Пример workflow в n8n:**
   ```
   [Trigger] → [Format News] → [HTTP Request to /posts]
   ```

3. **В node Code/Function** используйте:
   ```javascript
   // ... ваш код обработки новостей ...
   
   // Отправляем результат на webhook
   const response = await $http.request({
     method: 'POST',
     url: 'http://localhost:3000/posts',
     headers: {
       'Content-Type': 'application/json'
     },
     body: {
       messages: results  // результат из news-formatter.js
     }
   });
   
   return response;
   ```

## Переменные окружения

Добавьте в ваш `.env` файл:
```env
BOT_SERVER_HOST=0.0.0.0
BOT_SERVER_PORT=3000
CHANNEL_ID=@your_channel_id
```

## Особенности

- Webhook работает параллельно с обычным long polling ботом
- Сообщения отправляются с задержкой 1 секунда между ними для избежания rate limit
- Поддерживается HTML разметка в сообщениях
- Логирование всех операций
- Graceful shutdown при остановке приложения
