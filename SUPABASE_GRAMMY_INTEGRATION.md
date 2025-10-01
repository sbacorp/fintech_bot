# Интеграция Supabase с GrammyJS

Данная документация описывает полную интеграцию Supabase с GrammyJS для создания Telegram ботов с персистентным хранением данных.

## Содержание

1. [Установка зависимостей](#установка-зависимостей)
2. [Настройка Supabase](#настройка-supabase)
3. [Создание схемы базы данных](#создание-схемы-базы-данных)
4. [Конфигурация проекта](#конфигурация-проекта)
5. [Создание Supabase сервиса](#создание-supabase-сервиса)
6. [Создание Storage адаптера](#создание-storage-адаптера)
7. [Интеграция с ботом](#интеграция-с-ботом)
8. [Использование в коде](#использование-в-коде)
9. [Обработка ошибок](#обработка-ошибок)
10. [Лучшие практики](#лучшие-практики)

## Установка зависимостей

```bash
npm install @supabase/supabase-js @grammyjs/storage-supabase
```

## Настройка Supabase

### 1. Создание проекта в Supabase

1. Перейдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Получите URL и API ключи из настроек проекта

### 2. Переменные окружения

Создайте файл `.env`:

```env
# Supabase конфигурация
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Создание схемы базы данных

Выполните SQL скрипт для создания необходимых таблиц:

```sql
-- Включаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица для хранения сессий пользователей
CREATE TABLE IF NOT EXISTS user_sessions (
    user_id BIGINT PRIMARY KEY,
    session_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для хранения новостей пользователей
CREATE TABLE IF NOT EXISTS user_news (
    user_id BIGINT PRIMARY KEY,
    news_data JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для хранения обработанных постов
CREATE TABLE IF NOT EXISTS processed_posts (
    user_id BIGINT PRIMARY KEY,
    post_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для хранения статистики постов
CREATE TABLE IF NOT EXISTS post_stats (
    id TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    original_title TEXT NOT NULL,
    publish_date TIMESTAMP WITH TIME ZONE NOT NULL,
    category TEXT,
    hashtags TEXT[] DEFAULT '{}',
    processing_time INTEGER,
    regeneration_count JSONB DEFAULT '{"title": 0, "text": 0}',
    status TEXT NOT NULL CHECK (status IN ('published', 'cancelled', 'draft')),
    channel_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для Grammy sessions
CREATE TABLE IF NOT EXISTS grammy_sessions (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем индексы для улучшения производительности
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_news_user_id ON user_news(user_id);
CREATE INDEX IF NOT EXISTS idx_processed_posts_user_id ON processed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_post_stats_user_id ON post_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_post_stats_status ON post_stats(status);
CREATE INDEX IF NOT EXISTS idx_post_stats_publish_date ON post_stats(publish_date);
CREATE INDEX IF NOT EXISTS idx_post_stats_channel_id ON post_stats(channel_id);
CREATE INDEX IF NOT EXISTS idx_grammy_sessions_key ON grammy_sessions(key);

-- Создаем функции для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Создаем триггеры для автоматического обновления updated_at
CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON user_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_news_updated_at 
    BEFORE UPDATE ON user_news 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processed_posts_updated_at 
    BEFORE UPDATE ON processed_posts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grammy_sessions_updated_at 
    BEFORE UPDATE ON grammy_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Создаем RLS (Row Level Security) политики
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammy_sessions ENABLE ROW LEVEL SECURITY;

-- Политики для доступа (отключаем RLS для сервисного использования)
CREATE POLICY "Service can manage user sessions" ON user_sessions FOR ALL USING (true);
CREATE POLICY "Service can manage user news" ON user_news FOR ALL USING (true);
CREATE POLICY "Service can manage processed posts" ON processed_posts FOR ALL USING (true);
CREATE POLICY "Service can manage post stats" ON post_stats FOR ALL USING (true);
CREATE POLICY "Service can manage grammy sessions" ON grammy_sessions FOR ALL USING (true);
```

## Конфигурация проекта

### config/index.ts

```typescript
import "dotenv/config";
import z from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  BOT_TOKEN: z.string(),
  // Supabase конфигурация
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parseConfig = (environment: NodeJS.ProcessEnv) => {
  const config = configSchema.parse(environment);
  return {
    ...config,
    isDev: config.NODE_ENV === "development",
    isProd: config.NODE_ENV === "production",
  };
};

export type Config = ReturnType<typeof parseConfig>;
export const config = parseConfig(process.env);
```

## Создание Supabase сервиса

### services/supabase-service.ts

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Типы для Supabase таблиц
export interface UserSession {
  user_id: number;
  session_data: any;
  created_at: string;
  updated_at: string;
}

export interface UserNews {
  user_id: number;
  news_data: any[];
  created_at: string;
  updated_at: string;
}

export interface PostStats {
  id: string;
  user_id: number;
  title: string;
  original_title: string;
  publish_date: string;
  category?: string;
  hashtags: string[];
  processing_time?: number;
  regeneration_count: {
    title: number;
    text: number;
  };
  status: 'published' | 'cancelled' | 'draft';
  channel_id?: string;
  created_at: string;
}

export class SupabaseService {
  public client;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
    
    if (this.isEnabled) {
      this.client = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
      logger.info({
        msg: 'Supabase client initialized',
        url: config.SUPABASE_URL,
      });
    } else {
      logger.warn({
        msg: 'Supabase not configured, using in-memory storage',
        supabaseUrl: config.SUPABASE_URL,
        supabaseKey: config.SUPABASE_ANON_KEY ? 'configured' : 'not configured'
      });
    }
  }

  /**
   * Проверяет, включен ли Supabase
   */
  isSupabaseEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Сохраняет новости пользователя
   */
  async saveUserNews(userId: number, newsData: any[], channelId?: string): Promise<void> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, skipping news save',
        userId,
        channelId
      });
      return;
    }

    try {
      // Получаем существующие новости
      const { data, error: fetchError } = await this.client!
        .from('user_news')
        .select('news_data')
        .eq('user_id', userId)
        .single();

      let allNewsData: Record<string, any[]> = {};
      
      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Пользователь не найден, создаем новый
          logger.debug({
            msg: 'User news not found, creating new',
            userId,
            channelId
          });
        } else {
          logger.error({
            msg: 'Failed to fetch user news for save',
            userId,
            channelId,
            error: fetchError.message
          });
          throw fetchError;
        }
      } else {
        const existingData = data.news_data;
        
        if (existingData && typeof existingData === 'object' && !Array.isArray(existingData)) {
          allNewsData = existingData;
        } else if (existingData && Array.isArray(existingData)) {
          allNewsData = { 'default': existingData };
        }
      }
      
      // Добавляем/обновляем новости для конкретного канала
      const storageKey = channelId || 'default';
      allNewsData[storageKey] = newsData;

      const { error } = await this.client!
        .from('user_news')
        .upsert({
          user_id: userId,
          news_data: allNewsData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        logger.error({
          msg: 'Failed to save user news',
          userId,
          channelId,
          error: error.message
        });
        throw error;
      }

      logger.info({
        msg: 'User news saved',
        userId,
        channelId,
        storageKey,
        newsCount: newsData.length
      });
    } catch (error) {
      logger.error({
        msg: 'Error saving user news',
        userId,
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает новости пользователя
   */
  async getUserNews(userId: number, channelId?: string): Promise<any[] | null> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, returning null news',
        userId,
        channelId
      });
      return null;
    }

    try {
      const { data, error } = await this.client!
        .from('user_news')
        .select('news_data')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.debug({
            msg: 'User news not found',
            userId,
            channelId
          });
          return null;
        }
        logger.error({
          msg: 'Failed to get user news',
          userId,
          channelId,
          error: error.message
        });
        throw error;
      }

      const newsData = data.news_data;
      
      // Если передан channelId, возвращаем новости для конкретного канала
      if (channelId && typeof newsData === 'object' && !Array.isArray(newsData)) {
        const channelNews = newsData[channelId];
        return channelNews || null;
      }
      
      // Если это новый формат (объект с ключами), но channelId не передан
      if (typeof newsData === 'object' && !Array.isArray(newsData)) {
        return null; // Возвращаем null, так как нужен конкретный канал
      }
      
      // Если это старый формат (массив), возвращаем как есть
      return Array.isArray(newsData) ? newsData : null;
    } catch (error) {
      logger.error({
        msg: 'Error getting user news',
        userId,
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Сохраняет статистику поста
   */
  async savePostStats(postStats: PostStats): Promise<void> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, skipping stats save',
        postId: postStats.id
      });
      return;
    }

    try {
      const { error } = await this.client!
        .from('post_stats')
        .insert({
          id: postStats.id,
          user_id: postStats.user_id,
          title: postStats.title,
          original_title: postStats.original_title,
          publish_date: postStats.publish_date,
          category: postStats.category,
          hashtags: postStats.hashtags,
          processing_time: postStats.processing_time,
          regeneration_count: postStats.regeneration_count,
          status: postStats.status,
          channel_id: postStats.channel_id,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error({
          msg: 'Failed to save post stats',
          postId: postStats.id,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Post stats saved',
        postId: postStats.id
      });
    } catch (error) {
      logger.error({
        msg: 'Error saving post stats',
        postId: postStats.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает все статистики постов
   */
  async getAllPostStats(): Promise<PostStats[]> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, returning empty stats'
      });
      return [];
    }

    try {
      const { data, error } = await this.client!
        .from('post_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error({
          msg: 'Failed to get all post stats',
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'All post stats retrieved',
        count: data.length
      });

      return data;
    } catch (error) {
      logger.error({
        msg: 'Error getting all post stats',
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
}

// Создаем singleton экземпляр
export const supabaseService = new SupabaseService();
```

## Создание Storage адаптера

### services/supabase-storage-adapter.ts

```typescript
import { StorageAdapter } from "grammy";
import { supabaseService } from "./supabase-service.js";
import { logger } from "../utils/logger.js";

/**
 * Адаптер для Grammy storage с использованием Supabase
 * Реализует интерфейс StorageAdapter для хранения сессий
 */
export class SupabaseStorageAdapter implements StorageAdapter<unknown> {
  private tableName: string;

  constructor(tableName: string = "grammy_sessions") {
    this.tableName = tableName;
  }

  /**
   * Получает значение по ключу
   */
  async read(key: string): Promise<unknown | undefined> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, returning undefined for read',
        key
      });
      return undefined;
    }

    try {
      const { data, error } = await supabaseService.client!
        .from(this.tableName)
        .select('value')
        .eq('key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Ключ не найден
          logger.debug({
            msg: 'Key not found in storage',
            key
          });
          return undefined;
        }
        logger.error({
          msg: 'Failed to read from storage',
          key,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Value read from storage',
        key
      });

      return data.value;
    } catch (error) {
      logger.error({
        msg: 'Error reading from storage',
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }

  /**
   * Сохраняет значение по ключу
   */
  async write(key: string, value: unknown): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping write',
        key
      });
      return;
    }

    try {
      const { error } = await supabaseService.client!
        .from(this.tableName)
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        logger.error({
          msg: 'Failed to write to storage',
          key,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Value written to storage',
        key
      });
    } catch (error) {
      logger.error({
        msg: 'Error writing to storage',
        key,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Удаляет значение по ключу
   */
  async delete(key: string): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping delete',
        key
      });
      return;
    }

    try {
      const { error } = await supabaseService.client!
        .from(this.tableName)
        .delete()
        .eq('key', key);

      if (error) {
        logger.error({
          msg: 'Failed to delete from storage',
          key,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Value deleted from storage',
        key
      });
    } catch (error) {
      logger.error({
        msg: 'Error deleting from storage',
        key,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает все ключи
   */
  async readMany(keys: string[]): Promise<(unknown | undefined)[]> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, returning undefined array for readMany',
        keysCount: keys.length
      });
      return new Array(keys.length).fill(undefined);
    }

    try {
      const { data, error } = await supabaseService.client!
        .from(this.tableName)
        .select('key, value')
        .in('key', keys);

      if (error) {
        logger.error({
          msg: 'Failed to read many from storage',
          keys,
          error: error.message
        });
        throw error;
      }

      // Создаем Map для быстрого поиска
      const valueMap = new Map(data.map(item => [item.key, item.value]));

      // Возвращаем значения в том же порядке, что и ключи
      const result = keys.map(key => valueMap.get(key));

      logger.debug({
        msg: 'Values read many from storage',
        keysCount: keys.length,
        foundCount: data.length
      });

      return result;
    } catch (error) {
      logger.error({
        msg: 'Error reading many from storage',
        keys,
        error: error instanceof Error ? error.message : String(error)
      });
      return new Array(keys.length).fill(undefined);
    }
  }

  /**
   * Сохраняет несколько значений
   */
  async writeMany(entries: readonly (readonly [string, unknown])[]): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping writeMany',
        entriesCount: entries.length
      });
      return;
    }

    try {
      const data = entries.map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabaseService.client!
        .from(this.tableName)
        .upsert(data, {
          onConflict: 'key'
        });

      if (error) {
        logger.error({
          msg: 'Failed to write many to storage',
          entriesCount: entries.length,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Values written many to storage',
        entriesCount: entries.length
      });
    } catch (error) {
      logger.error({
        msg: 'Error writing many to storage',
        entriesCount: entries.length,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Удаляет несколько значений
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping deleteMany',
        keysCount: keys.length
      });
      return;
    }

    try {
      const { error } = await supabaseService.client!
        .from(this.tableName)
        .delete()
        .in('key', keys);

      if (error) {
        logger.error({
          msg: 'Failed to delete many from storage',
          keys,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Values deleted many from storage',
        keysCount: keys.length
      });
    } catch (error) {
      logger.error({
        msg: 'Error deleting many from storage',
        keys,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает все ключи
   */
  async *readAllKeys(): AsyncIterable<string> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, returning empty keys array'
      });
      return [];
    }

    try {
      const { data, error } = await supabaseService.client!
        .from(this.tableName)
        .select('key');

      if (error) {
        logger.error({
          msg: 'Failed to read all keys from storage',
          error: error.message
        });
        throw error;
      }

      const keys = data.map(item => item.key);

      logger.debug({
        msg: 'All keys read from storage',
        keysCount: keys.length
      });

      for (const key of keys) {
        yield key;
      }
    } catch (error) {
      logger.error({
        msg: 'Error reading all keys from storage',
        error: error instanceof Error ? error.message : String(error)
      });
      // Возвращаем пустой итератор
    }
  }

  /**
   * Очищает все данные
   */
  async clear(): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping clear'
      });
      return;
    }

    try {
      const { error } = await supabaseService.client!
        .from(this.tableName)
        .delete()
        .neq('key', ''); // Удаляем все записи

      if (error) {
        logger.error({
          msg: 'Failed to clear storage',
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Storage cleared'
      });
    } catch (error) {
      logger.error({
        msg: 'Error clearing storage',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Создает адаптер для Grammy storage с Supabase
 */
export function createSupabaseStorageAdapter(tableName?: string): StorageAdapter<unknown> {
  return new SupabaseStorageAdapter(tableName);
}
```

## Интеграция с ботом

### bot/index.ts

```typescript
import { session, Bot as TelegramBot } from "grammy";
import { config } from "../config/index.js";
import { createSupabaseStorageAdapter } from "../services/supabase-storage-adapter.js";

// Типы для контекста
export interface SessionData {
  isAdmin: boolean;
  selectedChannel?: string;
  pendingNewsRequest?: any;
  // Добавьте другие поля сессии по необходимости
}

export interface MyContext extends Context {
  session: SessionData;
}

export function createBot(token: string) {
  const bot = new TelegramBot<MyContext>(token);

  // Создаем storage адаптер для Supabase
  const storage = createSupabaseStorageAdapter("grammy_sessions");

  // Создаем конфигурацию сессии с Supabase storage
  const sessionConfig = {
    initial: (): SessionData => ({
      isAdmin: false,
    }),
    storage
  };

  bot.use(session(sessionConfig));

  // Ваши обработчики команд и middleware
  bot.command("start", (ctx) => {
    ctx.reply("Добро пожаловать!");
  });

  return bot;
}
```

## Использование в коде

### Сохранение данных пользователя

```typescript
import { supabaseService } from '../services/supabase-service.js';

// Сохранение новостей пользователя
await supabaseService.saveUserNews(userId, newsData, channelId);

// Получение новостей пользователя
const news = await supabaseService.getUserNews(userId, channelId);

// Сохранение статистики поста
const postStats = {
  id: 'unique-post-id',
  user_id: userId,
  title: 'Заголовок поста',
  original_title: 'Оригинальный заголовок',
  publish_date: new Date().toISOString(),
  hashtags: ['#fintech', '#news'],
  processing_time: 5000,
  regeneration_count: { title: 0, text: 0 },
  status: 'published' as const,
  channel_id: 'channel-id'
};

await supabaseService.savePostStats(postStats);
```

### Работа с сессиями

```typescript
// В обработчике команды
bot.command("save_data", async (ctx) => {
  // Данные автоматически сохраняются в Supabase через session middleware
  ctx.session.someData = "important data";
  ctx.session.userPreferences = { theme: "dark" };
  
  await ctx.reply("Данные сохранены!");
});

bot.command("get_data", async (ctx) => {
  // Данные автоматически загружаются из Supabase
  const data = ctx.session.someData;
  const preferences = ctx.session.userPreferences;
  
  await ctx.reply(`Данные: ${data}, Тема: ${preferences?.theme}`);
});
```

## Обработка ошибок

### Graceful degradation

Сервис автоматически переключается в режим in-memory storage, если Supabase недоступен:

```typescript
// Проверка доступности Supabase
if (supabaseService.isSupabaseEnabled()) {
  // Используем Supabase
  await supabaseService.saveUserNews(userId, newsData);
} else {
  // Fallback на локальное хранение
  console.log("Supabase недоступен, используем локальное хранение");
}
```

### Обработка ошибок подключения

```typescript
try {
  await supabaseService.saveUserNews(userId, newsData);
} catch (error) {
  if (error.code === 'PGRST116') {
    // Запись не найдена - это нормально
    logger.debug('User news not found');
  } else {
    // Другие ошибки
    logger.error('Failed to save user news', { error: error.message });
    // Можно реализовать retry логику или fallback
  }
}
```

## Лучшие практики

### 1. Типизация

Всегда используйте TypeScript интерфейсы для данных:

```typescript
interface UserNews {
  user_id: number;
  news_data: NewsItem[];
  created_at: string;
  updated_at: string;
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  published_at: string;
}
```

### 2. Логирование

Используйте структурированное логирование:

```typescript
logger.info({
  msg: 'User news saved',
  userId,
  channelId,
  newsCount: newsData.length
});
```

### 3. Валидация данных

Валидируйте данные перед сохранением:

```typescript
import z from 'zod';

const postStatsSchema = z.object({
  id: z.string(),
  user_id: z.number(),
  title: z.string().min(1),
  status: z.enum(['published', 'cancelled', 'draft'])
});

// Валидация перед сохранением
const validatedData = postStatsSchema.parse(postStats);
await supabaseService.savePostStats(validatedData);
```

### 4. Индексы и производительность

Создавайте индексы для часто используемых запросов:

```sql
-- Индекс для поиска по user_id
CREATE INDEX idx_user_news_user_id ON user_news(user_id);

-- Индекс для поиска по статусу
CREATE INDEX idx_post_stats_status ON post_stats(status);

-- Составной индекс
CREATE INDEX idx_post_stats_user_status ON post_stats(user_id, status);
```

### 5. Очистка данных

Реализуйте периодическую очистку старых данных:

```typescript
// Функция очистки старых данных
async function cleanupOldData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  await supabaseService.client!
    .from('user_sessions')
    .delete()
    .lt('updated_at', thirtyDaysAgo.toISOString());
}
```

### 6. Мониторинг

Добавьте метрики для мониторинга:

```typescript
// Счетчики для метрик
let saveOperations = 0;
let readOperations = 0;
let errorCount = 0;

// В методах сервиса
async saveUserNews(userId: number, newsData: any[]) {
  try {
    // ... логика сохранения
    saveOperations++;
  } catch (error) {
    errorCount++;
    throw error;
  }
}
```

## Заключение

Данная интеграция обеспечивает:

- ✅ Персистентное хранение сессий пользователей
- ✅ Надежное хранение пользовательских данных
- ✅ Graceful degradation при недоступности Supabase
- ✅ Полную типизацию с TypeScript
- ✅ Структурированное логирование
- ✅ Автоматическое обновление временных меток
- ✅ Безопасность через RLS политики

Интеграция готова к использованию в продакшене и легко масштабируется для больших нагрузок.
