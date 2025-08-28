import cron from 'node-cron';
import { BotInstance } from '../bot/index.js';
import { NewsService } from './news-service.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { channelService } from './channel-service.js';
import axios from 'axios';


export class SchedulerService {
  private bot: BotInstance | null = null;
  private newsService: NewsService;
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(bot?: BotInstance) {
    if (bot) {
      this.bot = bot;
    }
    // NewsService будет создаваться для каждого канала отдельно
    this.newsService = new NewsService('');
  }

  /**
   * Устанавливает bot после создания
   */
  setBot(bot: BotInstance): void {
    this.bot = bot;
  }

  /**
   * Запускает все запланированные задачи
   */
  start(): void {
    this.startDailyNewsTask();
    logger.info('scheduler service started');
  }

  /**
   * Останавливает все запланированные задачи
   */
  stop(): void {
    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info(`stopped scheduled task: ${name}`);
    }
    this.tasks.clear();
    logger.info('scheduler service stopped');
  }

  /**
   * Запускает ежедневную задачу получения новостей в 12:00
   */
  private startDailyNewsTask(): void {
    // каждый день в 1:50
    const cronExpression = '27 1 * * *';
    
    const task = cron.schedule(cronExpression, async () => {
      await this.handleDailyNews();
    }, {
      timezone: 'Europe/Moscow', // Можно изменить на нужную временную зону
    });

    this.tasks.set('daily-news', task);

    logger.info({
      msg: 'daily news task scheduled',
      cronExpression,
      timezone: 'Europe/Moscow',
    });
  }

  /**
   * Обработчик ежедневного получения новостей
   */
  private async handleDailyNews(): Promise<void> {
    try {
      logger.info('executing daily news task');

      // Получаем все доступные каналы
      const channels = channelService.getAllChannels();
      
      if (channels.length === 0) {
        logger.warn('no channels configured for daily news task');
        await this.notifyAdminsAboutError('Нет настроенных каналов для ежедневной рассылки');
        return;
      }

      const results = [];

      // Обрабатываем каждый канал
      for (const channel of channels) {
        try {
          logger.info({
            msg: 'processing channel for daily news',
            channelId: channel.id,
            channelName: channel.name
          });

          // Проверяем поддержку поиска для канала
          if (!channelService.supportsSearch(channel)) {
            logger.warn({
              msg: 'channel does not support search, skipping',
              channelId: channel.id,
              channelName: channel.name
            });
            continue;
          }

          // Получаем URL для поиска новостей
          const searchUrl = channelService.getSearchUrl(channel);
          if (!searchUrl) {
            logger.warn({
              msg: 'no search URL configured for channel, skipping',
              channelId: channel.id,
              channelName: channel.name
            });
            continue;
          }

          // Отправляем запрос на поиск новостей через n8n flow (как в /get_posts)
          const searchResponse = await axios.post(searchUrl, {
            channelId: channel.id,
            channelName: channel.name,
            userId: config.MAIN_CONTENT_CREATOR_ID, // Используем ID основного контент-мейкера
            action: 'search_news'
          }, {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'FintechBot/1.0'
            }
          });

          results.push({
            channelId: channel.id,
            channelName: channel.name,
            success: true,
            searchStatus: searchResponse.status
          });

          logger.info({
            msg: 'N8N search flow triggered successfully for channel',
            channelId: channel.id,
            channelName: channel.name,
            searchStatus: searchResponse.status,
            searchData: searchResponse.data,
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          results.push({
            channelId: channel.id,
            channelName: channel.name,
            error: errorMessage,
            success: false
          });

          logger.error({
            msg: 'channel processing exception',
            channelId: channel.id,
            channelName: channel.name,
            error: errorMessage
          });
        }
      }

      // Отправляем итоговое уведомление
      const successfulChannels = results.filter(r => r.success).length;
      
      if (successfulChannels > 0) {
        logger.info({
          msg: 'daily news search triggered successfully',
          channelsTriggered: successfulChannels,
          totalChannels: channels.length
        });

        await this.notifyAdminsAboutTask({
          totalNews: 0, // Новости придут позже через webhook
          totalMessages: 0,
          results
        });
      } else {
        logger.error({
          msg: 'daily news task failed - no channels triggered successfully',
          results
        });

        await this.notifyAdminsAboutError('Не удалось запустить поиск ни для одного канала');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        msg: 'daily news task exception',
        error: errorMessage,
      });

      await this.notifyAdminsAboutError(errorMessage);
    }
  }

  /**
   * Уведомляет админов и основного контент-мейкера об успешном выполнении задачи
   */
  private async notifyAdminsAboutTask(result: { 
    totalNews: number; 
    totalMessages: number; 
    results?: Array<{
      channelId: string;
      channelName: string;
      newsCount?: number;
      messagesCount?: number;
      error?: string | undefined;
      success: boolean;
    }>;
  }): Promise<void> {
    const mainCreatorId = config.MAIN_CONTENT_CREATOR_ID;

    let message = `🕛 Ежедневный поиск новостей запущен\n\n` +
                  `📡 Запущено поисков: ${result.results?.filter(r => r.success).length || 0}\n` +
                  `⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}\n\n` +
                  `⏳ Новости будут обработаны и сохранены автоматически`;

    // Добавляем информацию о каналах
    if (result.results && result.results.length > 0) {
      message += `\n\n📊 **Запущенные каналы:**\n`;
      
      for (const channelResult of result.results) {
        if (channelResult.success) {
          message += `✅ **${channelResult.channelName}**: поиск запущен\n`;
        } else {
          message += `❌ **${channelResult.channelName}**: ${channelResult.error || 'Ошибка'}\n`;
        }
      }
    }

    // Добавляем инструкции для пользователя
    message += `\n\n🎯 **Что делать дальше:**\n`;
    message += `1️⃣ Выберите нужный канал: /select_channel\n`;
    message += `2️⃣ Посмотрите сохраненные посты: /view_posts\n`;
    message += `3️⃣ Обработайте посты для публикации\n\n`;
    message += `💡 Посты сохраняются отдельно для каждого канала!`;

    // Отправляем сообщение основному контент-мейкеру
    if (mainCreatorId) {
      try {
        await this.bot?.api.sendMessage(mainCreatorId, message, {
          parse_mode: 'HTML',
        });
        logger.info({
          msg: 'notified main content creator about task completion',
          mainCreatorId,
        });
      } catch (error) {
        logger.error({
          msg: 'failed to notify main content creator about task completion',
          mainCreatorId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Уведомляет админов и основного контент-мейкера об ошибке в задаче
   */
  private async notifyAdminsAboutError(error: string): Promise<void> {
    const adminIds = config.BOT_ADMIN_USER_IDS;
    const mainCreatorId = config.MAIN_CONTENT_CREATOR_ID;

    const message = `❌ Ошибка в ежедневной рассылке новостей\n\n` +
                   `🚨 Ошибка: ${error}\n` +
                   `⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}\n\n` +
                   `🔧 **Возможные решения:**\n` +
                   `• Проверьте настройки n8n webhook\n` +
                   `• Убедитесь, что каналы настроены правильно\n` +
                   `• Попробуйте запустить задачу вручную: /cron_test`;

    // Отправляем сообщение основному контент-мейкеру
    if (mainCreatorId && this.bot) {
      try {
        await this.bot.api.sendMessage(mainCreatorId, message, {
          parse_mode: 'HTML',
        });
        logger.info({
          msg: 'notified main content creator about task error',
          mainCreatorId,
        });
      } catch (error) {
        logger.error({
          msg: 'failed to notify main content creator about task error',
          mainCreatorId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Отправляем сообщения админам
    if (!adminIds || adminIds.length === 0) {
      return;
    }

    for (const adminId of adminIds) {
      try {
        if (this.bot) {
          await this.bot.api.sendMessage(adminId, message, {
            parse_mode: 'HTML',
          });
        }
      } catch (error) {
        logger.error({
          msg: 'failed to notify admin about task error',
          adminId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Получает информацию о запланированных задачах
   */
  getTasksInfo(): Array<{ name: string; running: boolean; nextRun: string | null }> {
    const tasksInfo = [];

    for (const [name, task] of this.tasks) {
      tasksInfo.push({
        name,
        running: true, // Считаем что задача активна если она в списке
        nextRun: new Date().toISOString(), // Упрощенная версия
      });
    }

    return tasksInfo;
  }

  /**
   * Принудительно запускает задачу получения новостей
   */
  async runNewsTaskNow(): Promise<{ 
    success: boolean; 
    totalNews: number; 
    totalMessages: number; 
    error?: string;
    results?: Array<{
      channelId: string;
      channelName: string;
      newsCount?: number;
      messagesCount?: number;
      error?: string | undefined;
      success: boolean;
    }>;
  }> {
    logger.info('manually triggering news task');
    
    // Получаем все доступные каналы
    const channels = channelService.getAllChannels();
    
    if (channels.length === 0) {
      return {
        success: false,
        totalNews: 0,
        totalMessages: 0,
        error: 'Нет настроенных каналов'
      };
    }

    let totalNews = 0;
    let totalMessages = 0;
    const results = [];

    // Обрабатываем каждый канал
    for (const channel of channels) {
      try {
        logger.info({
          msg: 'processing channel for manual news task',
          channelId: channel.id,
          channelName: channel.name
        });

        // Проверяем поддержку поиска для канала
        if (!channelService.supportsSearch(channel)) {
          logger.warn({
            msg: 'channel does not support search, skipping',
            channelId: channel.id,
            channelName: channel.name
          });
          continue;
        }

        // Получаем URL для поиска новостей
        const searchUrl = channelService.getSearchUrl(channel);
        if (!searchUrl) {
          logger.warn({
            msg: 'no search URL configured for channel, skipping',
            channelId: channel.id,
            channelName: channel.name
          });
          continue;
        }

        // Создаем временный NewsService для конкретного канала
        const channelNewsService = new NewsService(searchUrl);
        
        // Запускаем поиск новостей для канала
        const result = await channelNewsService.fetchAndProcessNews();

        if (result.success) {
          totalNews += result.totalNews;
          totalMessages += result.messages.length;
          
          results.push({
            channelId: channel.id,
            channelName: channel.name,
            newsCount: result.totalNews,
            messagesCount: result.messages.length,
            success: true
          });

          logger.info({
            msg: 'channel processed successfully',
            channelId: channel.id,
            channelName: channel.name,
            newsCount: result.totalNews,
            messagesCount: result.messages.length
          });
        } else {
          results.push({
            channelId: channel.id,
            channelName: channel.name,
            error: result.error,
            success: false
          });

          logger.error({
            msg: 'channel processing failed',
            channelId: channel.id,
            channelName: channel.name,
            error: result.error
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        results.push({
          channelId: channel.id,
          channelName: channel.name,
          error: errorMessage,
          success: false
        });

        logger.error({
          msg: 'channel processing exception',
          channelId: channel.id,
          channelName: channel.name,
          error: errorMessage
        });
      }
    }

    const success = totalNews > 0;
    
    return {
      success,
      totalNews,
      totalMessages,
      results,
      ...(!success && { error: 'Не удалось обработать новости ни для одного канала' })
    };
  }
}
