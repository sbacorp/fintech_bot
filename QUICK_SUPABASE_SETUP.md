# Быстрая настройка Supabase для Telegram бота

## 🚀 Быстрый старт (5 минут)

### 1. Создайте проект Supabase
1. Перейдите на [supabase.com](https://supabase.com)
2. Нажмите "New Project"
3. Выберите организацию и введите название проекта
4. Дождитесь создания проекта

### 2. Получите ключи
1. В панели управления перейдите в Settings → API
2. Скопируйте:
   - **Project URL** (например: `https://abc123.supabase.co`)
   - **anon public** ключ
   - **service_role** ключ (секретный)

### 3. Создайте базу данных
1. Перейдите в SQL Editor
2. Скопируйте содержимое файла `supabase-schema-simple.sql`
3. Вставьте и выполните SQL

### 4. Настройте переменные окружения
Добавьте в ваш `.env` файл:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 5. Запустите бота
```bash
npm run dev
```

Должно появиться: `Supabase client initialized` ✅

## 🔧 Проверка настройки

### Проверьте таблицы
В Supabase Dashboard → Table Editor должны быть:
- `user_sessions`
- `user_news` 
- `processed_posts`
- `post_stats`
- `grammy_sessions`

### Проверьте логи
При запуске бота в логах должно быть:
```
Supabase client initialized
```

## ❌ Частые ошибки

### Ошибка: "cannot cast type uuid to bigint"
**Решение**: Используйте `supabase-schema-simple.sql` вместо `supabase-schema.sql`

### Ошибка: "Supabase not configured"
**Решение**: Проверьте переменные окружения в `.env`

### Ошибка: "connect ECONNREFUSED"
**Решение**: Проверьте правильность URL в `SUPABASE_URL`

## 📊 Что получили

✅ **Персистентность данных** - данные сохраняются между перезапусками  
✅ **Сессии пользователей** - выбор каналов и настройки  
✅ **Статистика постов** - аналитика и метрики  
✅ **Автоматические бэкапы** - ежедневные резервные копии  
✅ **Масштабируемость** - готовность к росту пользователей  

## 🔄 Fallback режим

Если Supabase недоступен, бот автоматически переключится на in-memory storage с предупреждением в логах.

## 📚 Дополнительно

- Полная документация: `SUPABASE_SETUP.md`
- SQL схема с RLS: `supabase-schema.sql`
- SQL схема без RLS: `supabase-schema-simple.sql`
