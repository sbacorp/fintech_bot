-- Создание таблицы channels для хранения каналов пользователей
CREATE TABLE IF NOT EXISTS channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id BIGINT NOT NULL, -- Telegram user ID
    name VARCHAR(255) NOT NULL, -- Название канала
    description TEXT, -- Описание канала
    sources TEXT[], -- Массив ссылок на источники новостей
    channel_username VARCHAR(255), -- Username канала (например, @mychannel)
    channel_id BIGINT, -- ID канала в Telegram
    is_admin_verified BOOLEAN DEFAULT FALSE, -- Проверка прав админа у бота в канале
    ai_prompt TEXT, -- Промпт для ИИ
    is_active BOOLEAN DEFAULT TRUE, -- Активен ли канал
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_channels_user_id ON channels(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_channel_id ON channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_channels_is_active ON channels(is_active);

-- Создание функции для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Создание триггера для автоматического обновления updated_at
CREATE TRIGGER update_channels_updated_at 
    BEFORE UPDATE ON channels 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Добавление комментариев к таблице и полям
COMMENT ON TABLE channels IS 'Таблица для хранения каналов пользователей и их настроек';
COMMENT ON COLUMN channels.user_id IS 'Telegram ID пользователя, который создал канал';
COMMENT ON COLUMN channels.name IS 'Название канала';
COMMENT ON COLUMN channels.description IS 'Описание канала и его тематики';
COMMENT ON COLUMN channels.sources IS 'Массив URL источников новостей для канала';
COMMENT ON COLUMN channels.channel_username IS 'Username канала в Telegram (например, @mychannel)';
COMMENT ON COLUMN channels.channel_id IS 'ID канала в Telegram';
COMMENT ON COLUMN channels.is_admin_verified IS 'Проверены ли права админа у бота в канале';
COMMENT ON COLUMN channels.ai_prompt IS 'Промпт для ИИ при генерации постов для этого канала';
COMMENT ON COLUMN channels.is_active IS 'Активен ли канал (можно отключить без удаления)';
