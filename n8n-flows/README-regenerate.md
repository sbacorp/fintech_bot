# N8N Флоу для перегенерации частей поста

## Описание
Этот флоу предназначен для перегенерации отдельных частей поста (заголовка или текста) когда админ нажимает соответствующие кнопки в боте.

## Структура флоу

### 1. Webhook - Regenerate Part
**Входная точка флоу**
- Принимает POST запросы на `/regenerate_post_part`
- Ожидает JSON с данными:
```json
{
  "action": "regenerate_title" | "regenerate_text",
  "link": "https://original-article-link.com",
  "current_title": "Текущий заголовок поста",
  "current_text": "Текущий текст поста"
}
```

### 2. Check Action Type
**Условная логика** (пока упрощена, но готова к расширению)
- Проверяет тип действия (`regenerate_title` или `regenerate_text`)
- В текущей версии оба пути ведут к одному скрапингу

### 3. Scrape Content
**Получение контента**
- Использует Firecrawl API для получения содержимого статьи
- Парсит в markdown формат
- Передает данные для обработки AI

### 4. AI Агенты для регенерации

#### Regenerate Title AI
- Специализированный промпт для создания нового заголовка
- Учитывает текущий заголовок и создает альтернативный
- Возвращает только новый заголовок в JSON формате

#### Regenerate Text AI
- Специализированный промпт для создания нового текста поста
- Учитывает текущий текст и создает альтернативный
- Возвращает только новый текст в JSON формате

### 5. Process Result (финальная точка)
**Обработка результата**
- Парсит ответ от AI
- Возвращает только новую сгенерированную часть
- Бот ждет ответ синхронно (как при создании поста)

## Формат ответа

### Для regenerate_title:
```json
{
  "output": "{\"new_title\": \"🚨 Bitcoin не впечатляет: слабый отскок и угроза падения ниже $112K\"}",
  "isValidJson": true
}
```

### Для regenerate_text:
```json
{
  "output": "{\"new_text\": \"💥 Биткоин провалил попытку роста: объёмы слабые, настроения медвежьи. Ждём пробой $112K и дальнейшее падение 📉\"}",
  "isValidJson": true
}
```

## Интеграция с ботом

### Вызов из бота:
```javascript
// Когда админ нажимает кнопку "Перегенерировать заголовок"
const regenerateData = {
  action: "regenerate_title",
  link: selectedPost.originalLink,
  current_title: selectedPost.title,
  current_text: selectedPost.text
};

await fetch('https://your-n8n-instance.com/webhook/regenerate_post_part', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(regenerateData)
});
```

### Обработка ответа в боте:
```javascript
// Синхронное ожидание ответа (как при создании поста)
const response = await axios.post(n8nUrl, regenerateData);

// Парсим ответ от N8N (format: {"output": "{\"new_title\": \"...\"}", "isValidJson": true})
let parsedData = null;
if (response.data && response.data.output) {
  try {
    parsedData = JSON.parse(response.data.output);
  } catch (error) {
    console.error('Failed to parse N8N output:', error);
  }
}

if (parsedData && parsedData.new_title) {
  // Обновляем заголовок в выбранном посте в памяти
  selectedPost.trigger_title = parsedData.new_title;
  // Сохраняем в хранилище и обновляем UI
  setUserProcessedPost(userId, selectedPost);
  await updatePostMessage(ctx, selectedPost);
} else if (parsedData && parsedData.new_text) {
  // Обновляем текст в выбранном посте в памяти
  selectedPost.post_text = parsedData.new_text;
  // Сохраняем в хранилище и обновляем UI
  setUserProcessedPost(userId, selectedPost);
  await updatePostMessage(ctx, selectedPost);
}
```

## Настройка

1. Импортируй флоу в N8N
2. Настрой Anthropic API credentials  
3. Обнови Firecrawl API ключ
4. Убедись что webhook URL настроен правильно в коде бота

## Преимущества

- ✅ Быстрая перегенерация только нужной части поста
- ✅ Сохранение контекста остальных частей поста
- ✅ Специализированные промпты для заголовков и текста
- ✅ Синхронная работа - просто ждем ответ
- ✅ Никаких дополнительных webhook endpoints
- ✅ Простая и надежная архитектура
