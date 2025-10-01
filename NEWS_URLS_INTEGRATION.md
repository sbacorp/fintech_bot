# Интеграция списка URLs для поиска новостей

## Обзор

Добавлена поддержка передачи списка URLs новостных источников при обращении к n8n для поиска новостей. Это позволяет настраивать различные источники новостей для каждого канала.

## Конфигурация

### Глобальные URLs по умолчанию

В файле `.env` можно настроить список URLs по умолчанию:

```env
DEFAULT_NEWS_URLS=["https://vc.ru/fintech", "https://www.rbc.ru/finances/", "https://www.vedomosti.ru/finance"]
```

### URLs для конкретных каналов

В конфигурации каналов можно указать специфичные URLs для каждого канала:

```env
CHANNELS=[
  {
    "id": "fintech85",
    "name": "Fintech85", 
    "description": "FINTECH SU NEWS",
    "channelId": "@fintech85",
    "newsUrls": ["https://vc.ru/fintech", "https://www.rbc.ru/finances/"]
  },
  {
    "id": "trans_payments",
    "name": "Trans Payments",
    "description": "Трансграничные платежи и финансовые новости с элементами FOMO", 
    "channelId": "@fomopayments",
    "newsUrls": ["https://www.vedomosti.ru/finance", "https://www.kommersant.ru/finance"]
  }
]
```

## Приоритет URLs

1. **URLs канала** - если в конфигурации канала указан массив `newsUrls`, используются эти URLs
2. **Глобальные URLs** - если у канала нет собственных URLs, используются `DEFAULT_NEWS_URLS`
3. **Пустой массив** - если не настроены ни глобальные, ни канальные URLs

## Изменения в коде

### 1. Конфигурация (`src/config/index.ts`)

- Добавлено поле `newsUrls` в схему канала
- Добавлена глобальная конфигурация `DEFAULT_NEWS_URLS`

### 2. ChannelService (`src/services/channel-service.ts`)

- Добавлен метод `getNewsUrls(channel: Channel): string[]` для получения списка URLs

### 3. Команда поиска новостей (`src/bot/handlers/commands/get-posts.ts`)

- Добавлена передача `newsUrls` в запросе к n8n
- Добавлено логирование используемых URLs

### 4. Планировщик (`src/services/scheduler.ts`)

- Добавлена передача `newsUrls` в ежедневном поиске новостей
- Добавлено логирование используемых URLs

## Формат запроса к n8n

Теперь при обращении к n8n передается дополнительное поле `newsUrls`:

```json
{
  "channelId": "fintech85",
  "channelName": "Fintech85", 
  "userId": 123456789,
  "action": "search_news",
  "newsUrls": [
    "https://vc.ru/fintech",
    "https://www.rbc.ru/finances/"
  ]
}
```

## Логирование

Добавлено подробное логирование использования URLs:

```javascript
logger.info({
  msg: 'Using news URLs for search',
  channelId: selectedChannel.id,
  channelName: selectedChannel.name,
  newsUrlsCount: newsUrls.length,
  newsUrls: newsUrls
});
```

## Обратная совместимость

- Если в конфигурации канала не указаны `newsUrls`, система автоматически использует глобальные URLs
- Если не настроены ни канальные, ни глобальные URLs, передается пустой массив
- Все существующие конфигурации продолжают работать без изменений

## Примеры использования

### Настройка для разных каналов

```env
# Fintech канал - только fintech новости
{
  "id": "fintech85",
  "newsUrls": ["https://vc.ru/fintech", "https://www.rbc.ru/finances/"]
}

# Платежи канал - фокус на платежных системах  
{
  "id": "trans_payments", 
  "newsUrls": ["https://www.vedomosti.ru/finance", "https://www.kommersant.ru/finance"]
}
```

### Глобальная настройка

```env
# Все каналы без собственных URLs будут использовать эти источники
DEFAULT_NEWS_URLS=["https://vc.ru/fintech", "https://www.rbc.ru/finances/", "https://www.vedomosti.ru/finance"]
```
