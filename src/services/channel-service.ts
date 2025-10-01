import { config, Channel } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { N8N_WEBHOOK_PATHES_BY_ID } from "../utils/n8n_pathes.js";

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

    logger.info({
      msg: "Channels loaded",
      channelCount: this.channels.length,
      channels: this.channels.map((ch) => ({ id: ch.id, name: ch.name })),
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
    return this.channels.find((channel) => channel.id === channelId);
  }

  /**
   * Получает канал по умолчанию
   */
  getDefaultChannel(): Channel | undefined {
    return (
      this.channels.find((channel) => channel.id === "default") ||
      this.channels[0]
    );
  }

  /**
   * Проверяет, существует ли канал
   */
  channelExists(channelId: string): boolean {
    return this.channels.some((channel) => channel.id === channelId);
  }

  /**
   * Получает URL для поиска новостей n8n для конкретного канала
   */
  getSearchUrl(channel: Channel): string | undefined {
    const channelPaths =
      N8N_WEBHOOK_PATHES_BY_ID[
        channel.id as keyof typeof N8N_WEBHOOK_PATHES_BY_ID
      ];
    return channelPaths?.search;
  }

  /**
   * Получает URL для создания новостей n8n для конкретного канала
   */
  getCreateUrl(channel: Channel): string | undefined {
    const channelPaths =
      N8N_WEBHOOK_PATHES_BY_ID[
        channel.id as keyof typeof N8N_WEBHOOK_PATHES_BY_ID
      ];
    return channelPaths?.create;
  }

  /**
   * Получает URL для регенерации n8n для конкретного канала
   */
  getRegenerateUrl(channel: Channel): string | undefined {
    const channelPaths =
      N8N_WEBHOOK_PATHES_BY_ID[
        channel.id as keyof typeof N8N_WEBHOOK_PATHES_BY_ID
      ];
    return channelPaths?.regenerate_post;
  }

  /**
   * Получает ID канала Telegram для публикации
   */
  getChannelId(channel: Channel): string {
    return channel.channelId;
  }

  /**
   * Получает список URLs для поиска новостей для канала
   */
  getNewsUrls(channel: Channel): string[] {
    // Сначала проверяем URLs канала
    if (channel.newsUrls && channel.newsUrls.length > 0) {
      return channel.newsUrls;
    }

    // Fallback на глобальные URLs по умолчанию
    return [];
  }

  /**
   * Получает AI промпт для канала
   */
  getAiPrompt(channel: Channel): string {
    // Сначала проверяем промпт канала
    if (channel.aiPrompt && channel.aiPrompt.trim()) {
      return channel.aiPrompt;
    }
    return "";
  }
}

// Создаем singleton экземпляр
export const channelService = new ChannelService();
