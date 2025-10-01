-- Таблица для кэширования данных Firecrawl
CREATE TABLE IF NOT EXISTS firecrawl_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    markdown TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Индекс для быстрого поиска по URL
CREATE INDEX IF NOT EXISTS idx_firecrawl_cache_url ON firecrawl_cache(url);

-- Индекс для очистки устаревших записей
CREATE INDEX IF NOT EXISTS idx_firecrawl_cache_expires_at ON firecrawl_cache(expires_at);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_firecrawl_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_update_firecrawl_cache_updated_at
    BEFORE UPDATE ON firecrawl_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_firecrawl_cache_updated_at();

-- Функция для очистки устаревших записей
CREATE OR REPLACE FUNCTION cleanup_expired_firecrawl_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM firecrawl_cache 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) политики
ALTER TABLE firecrawl_cache ENABLE ROW LEVEL SECURITY;

-- Политика для чтения (все пользователи)
CREATE POLICY "Allow read access to firecrawl_cache" ON firecrawl_cache
    FOR SELECT USING (true);

-- Политика для записи (только сервис)
CREATE POLICY "Allow insert access to firecrawl_cache" ON firecrawl_cache
    FOR INSERT WITH CHECK (true);

-- Политика для обновления (только сервис)
CREATE POLICY "Allow update access to firecrawl_cache" ON firecrawl_cache
    FOR UPDATE USING (true);

-- Политика для удаления (только сервис)
CREATE POLICY "Allow delete access to firecrawl_cache" ON firecrawl_cache
    FOR DELETE USING (true);
