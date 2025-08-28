# Настройка Supabase для Telegram бота

## Обзор

Этот документ описывает настройку Supabase для хранения данных Telegram бота, включая сессии пользователей, новости, обработанные посты и статистику.

## Преимущества использования Supabase

- 🔄 **Персистентность данных** - данные сохраняются между перезапусками бота
- 📊 **Аналитика** - встроенные представления и функции для анализа
- 🔒 **Безопасность** - Row Level Security (RLS) политики
- ⚡ **Производительность** - оптимизированные индексы и запросы
- 🛠️ **Масштабируемость** - готовность к росту пользователей

## Шаги настройки

### 1. Создание проекта Supabase

1. Перейдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Запишите URL и API ключи

### 2. Настройка базы данных

1. Откройте SQL Editor в панели управления Supabase
2. Выполните SQL скрипт из файла `supabase-schema-simple.sql` (рекомендуется для начала)
   - Или используйте `supabase-schema.sql` если нужны RLS политики
3. Проверьте, что все таблицы созданы

### 3. Настройка переменных окружения

Добавьте следующие переменные в ваш `.env` файл:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 4. Проверка настройки

Запустите бота и проверьте логи:

```bash
npm run dev
```

Должно появиться сообщение:
```
Supabase client initialized
```

## Структура базы данных

### Таблицы

#### `user_sessions`
Хранение сессий пользователей
- `user_id` - ID пользователя Telegram
- `session_data` - JSON данные сессии
- `created_at` - время создания
- `updated_at` - время обновления

#### `user_news`
Хранение новостей пользователей
- `user_id` - ID пользователя Telegram
- `news_data` - JSON массив новостей
- `created_at` - время создания
- `updated_at` - время обновления

#### `processed_posts`
Хранение обработанных постов
- `user_id` - ID пользователя Telegram
- `post_data` - JSON данные поста
- `created_at` - время создания
- `updated_at` - время обновления

#### `post_stats`
Статистика постов
- `id` - уникальный идентификатор
- `user_id` - ID пользователя
- `title` - заголовок поста
- `original_title` - оригинальный заголовок
- `publish_date` - дата публикации
- `category` - категория поста
- `hashtags` - массив хештегов
- `processing_time` - время обработки
- `regeneration_count` - счетчик регенераций
- `status` - статус поста
- `channel_id` - ID канала
- `created_at` - время создания

#### `grammy_sessions`
Сессии Grammy framework
- `key` - ключ сессии
- `value` - значение сессии
- `created_at` - время создания
- `updated_at` - время обновления

### Представления

#### `user_stats_summary`
Сводная статистика по пользователям:
- Общее количество постов
- Опубликованные посты
- Отмененные посты
- Среднее время обработки
- Количество регенераций

#### `channel_stats_summary`
Сводная статистика по каналам:
- Общее количество постов
- Опубликованные посты
- Отмененные посты
- Среднее время обработки
- Количество регенераций

### Функции

#### `cleanup_old_data(days_to_keep)`
Очистка старых данных:
```sql
SELECT cleanup_old_data(30); -- Удалить данные старше 30 дней
```

#### `get_popular_hashtags(limit_count)`
Получение популярных хештегов:
```sql
SELECT * FROM get_popular_hashtags(10);
```

## Безопасность

### Row Level Security (RLS)

> **Примечание**: В упрощенной версии (`supabase-schema-simple.sql`) RLS отключен для упрощения настройки.

В полной версии (`supabase-schema.sql`) все таблицы защищены RLS политиками:

- **user_sessions**: сервисный доступ для всех операций
- **user_news**: сервисный доступ для всех операций
- **processed_posts**: сервисный доступ для всех операций
- **post_stats**: сервисный доступ для всех операций
- **grammy_sessions**: полный доступ для сервиса

### API ключи

- **ANON_KEY**: для клиентских запросов (с RLS в полной версии)
- **SERVICE_ROLE_KEY**: для серверных запросов (без RLS)

## Мониторинг и аналитика

### Встроенные метрики

Supabase предоставляет встроенные метрики:
- Количество запросов
- Время ответа
- Использование хранилища
- Активные соединения

### Кастомные запросы

Примеры полезных запросов:

```sql
-- Статистика по дням
SELECT 
    DATE(publish_date) as date,
    COUNT(*) as posts,
    COUNT(*) FILTER (WHERE status = 'published') as published
FROM post_stats
GROUP BY DATE(publish_date)
ORDER BY date DESC;

-- Топ пользователей по активности
SELECT 
    user_id,
    COUNT(*) as total_posts,
    AVG(processing_time) as avg_processing_time
FROM post_stats
GROUP BY user_id
ORDER BY total_posts DESC
LIMIT 10;

-- Статистика по каналам
SELECT 
    channel_id,
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE status = 'published') as published_posts
FROM post_stats
WHERE channel_id IS NOT NULL
GROUP BY channel_id;
```

## Резервное копирование

### Автоматические бэкапы

Supabase автоматически создает ежедневные бэкапы.

### Ручное резервное копирование

```bash
# Экспорт данных
pg_dump "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" > backup.sql

# Импорт данных
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" < backup.sql
```

## Оптимизация производительности

### Индексы

Автоматически созданы индексы для:
- `user_id` во всех таблицах
- `status` в post_stats
- `publish_date` в post_stats
- `channel_id` в post_stats
- `key` в grammy_sessions

### Рекомендации

1. **Регулярная очистка**: запускайте `cleanup_old_data()` еженедельно
2. **Мониторинг размера**: следите за размером таблиц
3. **Оптимизация запросов**: используйте LIMIT для больших выборок

## Устранение неполадок

### Частые проблемы

#### 1. Ошибка подключения
```
Error: connect ECONNREFUSED
```
**Решение**: Проверьте URL и API ключи в .env

#### 2. Ошибка RLS
```
Error: new row violates row-level security policy
```
**Решение**: Проверьте политики RLS в Supabase или используйте упрощенную схему без RLS

#### 3. Ошибка приведения типов
```
ERROR: 42846: cannot cast type uuid to bigint
```
**Решение**: Используйте `supabase-schema-simple.sql` вместо `supabase-schema.sql`

#### 4. Ошибка JSON
```
Error: invalid input syntax for type jsonb
```
**Решение**: Проверьте формат данных перед сохранением

### Логирование

Включите детальное логирование:

```typescript
// В config/index.ts
LOG_LEVEL: "debug"
```

### Тестирование подключения

```typescript
// Тест подключения к Supabase
import { supabaseService } from './services/supabase-service.js';

console.log('Supabase enabled:', supabaseService.isSupabaseEnabled());
```

## Миграция с in-memory storage

### Пошаговая миграция

1. **Настройте Supabase** (следуйте шагам выше)
2. **Добавьте переменные окружения**
3. **Перезапустите бота**
4. **Проверьте логи** - должно быть "Supabase client initialized"

### Fallback режим

Если Supabase недоступен, бот автоматически переключится на in-memory storage:

```
Supabase not configured, using in-memory storage
```

## Примеры использования

### Сохранение сессии пользователя

```typescript
import { supabaseService } from './services/supabase-service.js';

const sessionData = {
  isAdmin: true,
  selectedChannel: { id: 'alarm_payments', name: 'ALARM PAYMENTS' }
};

await supabaseService.saveUserSession(userId, sessionData);
```

### Получение статистики

```typescript
import { supabaseService } from './services/supabase-service.js';

const stats = await supabaseService.getAllPostStats();
const recentStats = await supabaseService.getRecentPostStats(10);
```

### Очистка старых данных

```sql
-- Удалить данные старше 7 дней
SELECT cleanup_old_data(7);
```

## Поддержка

При возникновении проблем:

1. Проверьте логи бота
2. Проверьте логи Supabase в панели управления
3. Убедитесь в правильности переменных окружения
4. Проверьте RLS политики
5. Обратитесь к документации Supabase
