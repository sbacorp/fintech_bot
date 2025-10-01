# Supabase кэш для Firecrawl в n8n

## Установка

### 1. Создать таблицу в Supabase

Выполните SQL из файла `supabase-firecrawl-cache.sql`:

```sql
-- Таблица для кэширования данных Firecrawl
CREATE TABLE IF NOT EXISTS firecrawl_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    markdown TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);
```

### 2. Настроить переменные в n8n

Добавьте в переменные окружения n8n:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

### 3. Импортировать workflow

Используйте `create_news_supabase_cache.json` вместо обычного `create_news.json`.

## Как работает

1. **Check Supabase Cache** - проверяет кэш в Supabase
2. **Cache Condition** - если кэш есть, идет в AI, иначе в Firecrawl
3. **Save to Supabase Cache** - сохраняет результат Firecrawl в Supabase

## Структура кэша

```sql
firecrawl_cache:
- id: UUID (авто)
- url: TEXT (уникальный)
- markdown: TEXT (данные от Firecrawl)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP  
- expires_at: TIMESTAMP (авто +1 час)
```

## Преимущества

- ✅ Кэш сохраняется между перезапусками n8n
- ✅ Автоматическое истечение через 1 час
- ✅ Можно мониторить через Supabase Dashboard
- ✅ Масштабируется на несколько инстансов n8n

## Мониторинг

В Supabase Dashboard можно:
- Смотреть количество записей в кэше
- Очищать устаревшие записи
- Анализировать использование

## Очистка кэша

```sql
-- Очистить устаревшие записи
DELETE FROM firecrawl_cache WHERE expires_at < NOW();

-- Очистить весь кэш
DELETE FROM firecrawl_cache;
```
