-- Supabase Schema для Telegram бота (упрощенная версия без RLS)
-- Создание таблиц для хранения данных пользователей, сессий и статистики

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

-- Таблица для Grammy sessions (для хранения сессий Grammy)
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

-- Создаем представления для удобного доступа к данным
CREATE OR REPLACE VIEW user_stats_summary AS
SELECT 
    user_id,
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE status = 'published') as published_posts,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_posts,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_posts,
    AVG(processing_time) as avg_processing_time,
    SUM((regeneration_count->>'title')::int) as total_title_regenerations,
    SUM((regeneration_count->>'text')::int) as total_text_regenerations
FROM post_stats
GROUP BY user_id;

-- Создаем представление для статистики по каналам
CREATE OR REPLACE VIEW channel_stats_summary AS
SELECT 
    channel_id,
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE status = 'published') as published_posts,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_posts,
    AVG(processing_time) as avg_processing_time,
    SUM((regeneration_count->>'title')::int) as total_title_regenerations,
    SUM((regeneration_count->>'text')::int) as total_text_regenerations
FROM post_stats
WHERE channel_id IS NOT NULL
GROUP BY channel_id;

-- Создаем функцию для очистки старых данных
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Удаляем старые сессии
    DELETE FROM user_sessions 
    WHERE updated_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Удаляем старые новости
    DELETE FROM user_news 
    WHERE updated_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    -- Удаляем старые обработанные посты
    DELETE FROM processed_posts 
    WHERE updated_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    -- Удаляем старые сессии Grammy
    DELETE FROM grammy_sessions 
    WHERE updated_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Создаем функцию для получения популярных хештегов
CREATE OR REPLACE FUNCTION get_popular_hashtags(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(hashtag TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        unnest(hashtags) as hashtag,
        COUNT(*) as count
    FROM post_stats
    WHERE hashtags IS NOT NULL AND array_length(hashtags, 1) > 0
    GROUP BY hashtag
    ORDER BY count DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Комментарии к таблицам
COMMENT ON TABLE user_sessions IS 'Хранение сессий пользователей бота';
COMMENT ON TABLE user_news IS 'Хранение новостей пользователей';
COMMENT ON TABLE processed_posts IS 'Хранение обработанных постов пользователей';
COMMENT ON TABLE post_stats IS 'Статистика постов с метаданными';
COMMENT ON TABLE grammy_sessions IS 'Сессии Grammy framework';

-- Комментарии к колонкам
COMMENT ON COLUMN user_sessions.session_data IS 'JSON данные сессии пользователя';
COMMENT ON COLUMN user_news.news_data IS 'JSON массив новостей пользователя';
COMMENT ON COLUMN processed_posts.post_data IS 'JSON данные обработанного поста';
COMMENT ON COLUMN post_stats.regeneration_count IS 'JSON счетчик регенераций {title: number, text: number}';
COMMENT ON COLUMN post_stats.hashtags IS 'Массив хештегов поста';
COMMENT ON COLUMN post_stats.channel_id IS 'ID канала для публикации';
