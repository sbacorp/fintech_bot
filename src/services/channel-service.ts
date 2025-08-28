import { config, Channel } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { N8N_WEBHOOK_PATHES_BY_ID } from '../utils/n8n_pathes.js';

export class ChannelService {
  private channels: Channel[] = [];

  constructor() {
    this.loadChannels();
  }

  /**
   * Загружает каналы из конфигурации
   */
  private loadChannels(): void {
    this.channels = config.CHANNELS || [];

    // Добавляем канал по умолчанию для обратной совместимости
    if (config.CHANNEL_ID && config.DEFAULT_N8N_TRIGGER_URL) {
      const defaultChannel: Channel = {
        id: 'default',
        name: 'Основной канал',
        description: 'Основной канал для публикации новостей',
        channelId: config.CHANNEL_ID,
        n8nTriggerUrl: config.DEFAULT_N8N_TRIGGER_URL,
        n8nRegenerateUrl: config.DEFAULT_N8N_REGENERATE_URL,
      };
      this.channels.push(defaultChannel);
    }

    logger.info({
      msg: 'Channels loaded',
      channelCount: this.channels.length,
      channels: this.channels.map(ch => ({ id: ch.id, name: ch.name }))
    });
  }

  /**
   * Получает все доступные каналы
   */
  getAllChannels(): Channel[] {
    return this.channels;
  }

  /**
   * Получает канал по ID
   */
  getChannelById(channelId: string): Channel | undefined {
    return this.channels.find(channel => channel.id === channelId);
  }

  /**
   * Получает канал по умолчанию
   */
  getDefaultChannel(): Channel | undefined {
    return this.channels.find(channel => channel.id === 'default') || this.channels[0];
  }

  /**
   * Проверяет, существует ли канал
   */
  channelExists(channelId: string): boolean {
    return this.channels.some(channel => channel.id === channelId);
  }

  /**
   * Получает URL для поиска новостей n8n для конкретного канала
   */
  getSearchUrl(channel: Channel): string | undefined {
    // Сначала проверяем новые URL'ы из N8N_WEBHOOK_PATHES_BY_ID
    const channelPaths = N8N_WEBHOOK_PATHES_BY_ID[channel.id as keyof typeof N8N_WEBHOOK_PATHES_BY_ID];
    if (channelPaths?.search) {
      return channelPaths.search;
    }
    
    // Fallback на старые URL'ы из конфигурации
    return channel.n8nTriggerUrl;
  }

  /**
   * Получает URL для создания новостей n8n для конкретного канала
   */
  getCreateUrl(channel: Channel): string | undefined {
    // Сначала проверяем новые URL'ы из N8N_WEBHOOK_PATHES_BY_ID
    const channelPaths = N8N_WEBHOOK_PATHES_BY_ID[channel.id as keyof typeof N8N_WEBHOOK_PATHES_BY_ID];
    if (channelPaths?.create) {
      return channelPaths.create;
    }
    
    // Fallback на старые URL'ы из конфигурации
    return channel.n8nTriggerUrl;
  }

  /**
   * Получает URL для триггера n8n для конкретного канала (для обратной совместимости)
   */
  getTriggerUrl(channel: Channel): string {
    return this.getCreateUrl(channel) || channel.n8nTriggerUrl;
  }

  /**
   * Получает URL для регенерации n8n для конкретного канала
   */
  getRegenerateUrl(channel: Channel): string | undefined {
    // Сначала проверяем новые URL'ы из N8N_WEBHOOK_PATHES_BY_ID
    const channelPaths = N8N_WEBHOOK_PATHES_BY_ID[channel.id as keyof typeof N8N_WEBHOOK_PATHES_BY_ID];
    if (channelPaths?.regenerate_post) {
      return channelPaths.regenerate_post;
    }
    
    // Fallback на старые URL'ы из конфигурации
    return channel.n8nRegenerateUrl;
  }

  /**
   * Получает ID канала Telegram для публикации
   */
  getChannelId(channel: Channel): string {
    return channel.channelId;
  }

  /**
   * Получает токен webhook для канала
   */
  getWebhookToken(channel: Channel): string | undefined {
    return channel.webhookToken;
  }

  /**
   * Проверяет, поддерживает ли канал поиск новостей
   */
  supportsSearch(channel: Channel): boolean {
    const channelPaths = N8N_WEBHOOK_PATHES_BY_ID[channel.id as keyof typeof N8N_WEBHOOK_PATHES_BY_ID];
    return !!(channelPaths?.search);
  }

  /**
   * Проверяет, поддерживает ли канал создание новостей
   */
  supportsCreate(channel: Channel): boolean {
    const channelPaths = N8N_WEBHOOK_PATHES_BY_ID[channel.id as keyof typeof N8N_WEBHOOK_PATHES_BY_ID];
    return !!(channelPaths?.create);
  }

  /**
   * Проверяет, поддерживает ли канал регенерацию постов
   */
  supportsRegenerate(channel: Channel): boolean {
    const channelPaths = N8N_WEBHOOK_PATHES_BY_ID[channel.id as keyof typeof N8N_WEBHOOK_PATHES_BY_ID];
    return !!(channelPaths?.regenerate_post);
  }
}

// Создаем singleton экземпляр
export const channelService = new ChannelService();

