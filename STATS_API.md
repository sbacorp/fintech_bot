# API Статистики Постов

Система автоматически собирает статистику по всем постам для дальнейшего анализа в админке.

## Endpoints

### 1. Общая статистика - `GET /api/stats/posts`

Возвращает общую статистику по всем постам.

**Ответ:**
```json
{
  "success": true,
  "summary": {
    "total_posts": 150,
    "published_posts": 120,
    "cancelled_posts": 25,
    "draft_posts": 5,
    "total_regenerations": {
      "title": 85,
      "text": 67
    },
    "avg_processing_time": 4.2,
    "categories": ["fintech", "crypto", "stocks", "news"],
    "popular_hashtags": [
      { "hashtag": "#Финтех", "count": 45 },
      { "hashtag": "#Криптовалюты", "count": 38 },
      { "hashtag": "#Новости", "count": 32 }
    ]
  },
  "posts": [
    {
      "id": "post_123456_1640995200000",
      "title": "Сбер идет войной на Visa и Mastercard – сработает ли?",
      "original_title": "Сбербанк запустил новую платежную систему",
      "publish_date": "2024-01-15T10:30:00.000Z",
      "category": "fintech",
      "hashtags": ["#Финтех", "#Сбер", "#Платежи"],
      "hashtags_count": 3,
      "user_id": 123456,
      "processing_time": 5.2,
      "regeneration_count": {
        "title": 2,
        "text": 1
      },
      "status": "published"
    }
  ]
}
```

### 2. Последние посты - `GET /api/stats/posts/recent?limit=10`

Возвращает последние N постов (по умолчанию 10).

**Параметры:**
- `limit` (optional) - количество постов (по умолчанию 10)

**Ответ:**
```json
{
  "success": true,
  "posts": [
    {
      "id": "post_123456_1640995200000",
      "title": "ЦБ душит электронные кошельки – твой бизнес под угрозой?",
      "original_title": "Банк России ужесточил требования к электронным кошелькам",
      "publish_date": "2024-01-15T15:45:00.000Z",
      "category": "regulation",
      "hashtags": ["#ЦБ", "#Регулирование", "#Кошельки"],
      "user_id": 123456,
      "regeneration_count": {
        "title": 1,
        "text": 0
      },
      "status": "published"
    }
  ],
  "count": 5
}
```

### 3. Статистика по датам - `GET /api/stats/posts/by-date?start_date=2024-01-01&end_date=2024-01-31`

Возвращает статистику постов за указанный период с группировкой по дням.

**Параметры:**
- `start_date` (required) - начальная дата в формате YYYY-MM-DD
- `end_date` (required) - конечная дата в формате YYYY-MM-DD

**Ответ:**
```json
{
  "success": true,
  "date_range": {
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  },
  "posts": [...], // все посты за период
  "by_day": [
    {
      "date": "2024-01-15",
      "count": 8,
      "published": 6,
      "cancelled": 2,
      "regenerations": {
        "title": 12,
        "text": 8
      }
    },
    {
      "date": "2024-01-16",
      "count": 5,
      "published": 4,
      "cancelled": 1,
      "regenerations": {
        "title": 7,
        "text": 3
      }
    }
  ],
  "total_count": 45
}
```

## Автоматический сбор статистики

Система автоматически собирает следующие метрики:

### При создании поста:
- Время начала обработки
- Исходные данные (заголовок, категория)

### При регенерации:
- Увеличивается счетчик регенераций для заголовка/текста
- Сохраняется в поле `_regeneration_count` поста

### При публикации:
- Создается запись со статусом `published`
- Сохраняется финальный заголовок и метаданные
- Записывается общее количество регенераций

### При отмене:
- Создается запись со статусом `cancelled`
- Сохраняются данные о количестве регенераций до отмены

## Структура данных PostStats

```typescript
interface PostStats {
  id: string;                    // уникальный ID поста
  title: string;                 // финальный заголовок
  original_title: string;        // исходный заголовок
  publish_date: string;          // дата публикации/отмены (ISO string)
  category?: string;             // категория поста
  hashtags: string[];            // массив хештегов
  user_id: number;              // ID пользователя
  processing_time?: number;      // время обработки в секундах
  regeneration_count: {          // счетчики регенераций
    title: number;
    text: number;
  };
  status: 'published' | 'cancelled' | 'draft';  // статус поста
}
```

## Использование в админке

### Дашборд статистики:
```javascript
// Получение общей статистики
const statsResponse = await fetch('/api/stats/posts');
const { summary, posts } = await statsResponse.json();

// Отображение метрик
console.log(`Всего постов: ${summary.total_posts}`);
console.log(`Опубликовано: ${summary.published_posts}`);
console.log(`Среднее время обработки: ${summary.avg_processing_time}s`);
console.log(`Популярные хештеги:`, summary.popular_hashtags);
```

### График активности:
```javascript
// Получение данных за последний месяц
const startDate = '2024-01-01';
const endDate = '2024-01-31';
const dailyStats = await fetch(`/api/stats/posts/by-date?start_date=${startDate}&end_date=${endDate}`);
const { by_day } = await dailyStats.json();

// Построение графика по дням
by_day.forEach(day => {
  console.log(`${day.date}: ${day.published} опубликовано, ${day.cancelled} отменено`);
});
```

### Последние посты:
```javascript
// Получение последних 20 постов
const recentResponse = await fetch('/api/stats/posts/recent?limit=20');
const { posts } = await recentResponse.json();

// Отображение в таблице
posts.forEach(post => {
  console.log(`${post.title} - ${post.status} (${post.regeneration_count.title + post.regeneration_count.text} регенераций)`);
});
```

## Хранение данных

⚠️ **Важно**: В текущей версии данные хранятся в памяти (`Map<string, PostStats>`). 

Для продакшена рекомендуется:
- Использовать Redis для быстрого доступа
- Дублировать в PostgreSQL для долгосрочного хранения
- Настроить бэкапы статистики

## Расширение функционала

Легко добавить новые метрики:
- Время отклика AI
- Источники новостей
- Эффективность заголовков (CTR)
- A/B тесты промптов
