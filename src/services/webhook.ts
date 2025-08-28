import express from 'express';
import { BotInstance } from '../bot/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { InlineKeyboard } from 'grammy';
import { supabaseService } from './supabase-service.js';
import { channelService } from './channel-service.js';

interface NewsMessage {
  telegramMessage: string;
  messageNumber: number;
  totalMessages: number;
  newsCount: number;
}

interface PostRequest {
  channelId?: string;
  messages: NewsMessage[];
}

export function createWebhookServer(bot: BotInstance) {
  const app = express();
  
  // Middleware для парсинга JSON
  app.use(express.json({ limit: '10mb' }));
  
  // Middleware для логирования запросов
  app.use((req, res, next) => {
    logger.info({
      msg: 'incoming request',
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.method === 'POST' ? JSON.stringify(req.body).substring(0, 500) + '...' : undefined,
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      botInfo: bot.botInfo?.username || 'unknown'
    });
  });


  // Webhook endpoint для получения обработанных новостей от n8n по каналам
  app.post('/news-processed/:channelId', async (req, res): Promise<void> => {
    try {
      const { channelId } = req.params;

      logger.info({
        msg: 'Received processed news from n8n for specific channel',
        channelId,
        body: req.body,
        hasUserId: !!req.body.userId,
        userId: req.body.userId,
      });

      const { news, error, userId } = req.body;
      const newsData = { news }; 

      // Если передан userId, уведомляем конкретного пользователя
      if (userId) {
        await notifySpecificUser(bot, newsData, Number(userId), error, channelId);
      } else {
        // Уведомляем пользователей, работающих с конкретным каналом
        await notifyUsersForChannel(bot, newsData, channelId, error);
      }

      res.json({
        success: true,
        message: 'Channel news processed successfully',
        channelId
      });

    } catch (error) {
      logger.error({
        msg: 'Error processing channel news webhook',
        channelId: req.params.channelId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // Webhook endpoint для обработки ошибок workflow от n8n
  app.get('/news-process-error', async (req, res): Promise<void> => {
    try {
      logger.error({
        msg: 'Received workflow error from n8n',
        query: req.query,
        params: req.params,
      });
      
      const { userId, workflow, error, timestamp, retryCount, severity } = req.query;
      
      // Уведомляем пользователя об ошибке и предлагаем попробовать снова
      await notifyUserOfWorkflowError(bot, {
        userId: Number(userId),
        workflow: String(workflow),
        error: String(error),
        timestamp: String(timestamp),
        retryCount: Number(retryCount),
        severity: String(severity)
      });
      
      res.json({ 
        success: true,
        message: 'Workflow error processed successfully'
      });

    } catch (error) {
      logger.error({
        msg: 'Error processing workflow error webhook',
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // Webhook endpoint для постинга новостей
  app.post('/posts', async (req, res): Promise<void> => {
    try {
      logger.info({
        msg: 'received post request',
        body: req.body,
      });

      const { channelId, messages }: PostRequest = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({
          error: 'Invalid request: messages array is required'
        });
        return;
      }

      if (messages.length === 0) {
        res.status(400).json({
          error: 'Invalid request: messages array cannot be empty'
        });
        return;
      }

      // Используем channelId из запроса или из конфигурации
      const targetChannelId = channelId || config.CHANNEL_ID;
      
      if (!targetChannelId) {
        res.status(400).json({
          error: 'Channel ID is required'
        });
        return;
      }

      logger.info({
        msg: 'sending messages to channel',
        channelId: targetChannelId,
        messageCount: messages.length,
      });

      const results = [];
      
      // Отправляем сообщения по очереди с небольшой задержкой
      for (const [index, message] of messages.entries()) {
        try {
          const result = await bot.api.sendMessage(
            targetChannelId,
            message.telegramMessage,
            {
              parse_mode: 'HTML',
              link_preview_options: {
                is_disabled: false,
              }
            }
          );
          
          results.push({
            messageNumber: message.messageNumber,
            messageId: result.message_id,
            status: 'sent',
          });
          
          logger.info({
            msg: 'message sent successfully',
            messageNumber: message.messageNumber,
            messageId: result.message_id,
          });
          
          // Задержка между сообщениями, чтобы избежать rate limit
          if (index < messages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          logger.error({
            msg: 'failed to send message',
            messageNumber: message.messageNumber,
            error: error instanceof Error ? error.message : String(error),
          });
          
          results.push({
            messageNumber: message.messageNumber,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const successCount = results.filter(r => r.status === 'sent').length;
      const failureCount = results.filter(r => r.status === 'failed').length;

      res.json({
        success: true,
        channelId: targetChannelId,
        totalMessages: messages.length,
        successCount,
        failureCount,
        results,
      });

    } catch (error) {
      logger.error({
        msg: 'webhook error',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Endpoint для получения информации о боте
  app.get('/bot/info', async (req, res) => {
    try {
      const botInfo = await bot.api.getMe();
      res.json({
        success: true,
        bot: botInfo,
        config: {
          channelId: config.CHANNEL_ID,
          isDev: config.isDev,
          isProd: config.isProd,
        },
      });
    } catch (error) {
      logger.error({
        msg: 'failed to get bot info',
        error: error instanceof Error ? error.message : String(error),
      });
      
      res.status(500).json({
        error: 'Failed to get bot info',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });



  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      available_endpoints: [
        'GET /health',
        'POST /posts',
        'GET /bot/info',
        'POST /news-processed/:channelId',
      ],
    });
  });

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error({
      msg: 'express error',
      error: err.message,
      stack: err.stack,
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}

// Хранилище новостей пользователей (fallback для in-memory)
const userNewsStorage = new Map<string, any[]>();

// Хранилище обработанных постов (fallback для in-memory)
const userProcessedPostStorage = new Map<number, any>();

// Хранилище статистики постов (fallback для in-memory)
interface PostStats {
  id: string;
  title: string;
  original_title: string;
  publish_date: string;
  category?: string;
  hashtags: string[];
  user_id: number;
  processing_time?: number; // время обработки в секундах
  regeneration_count: {
    title: number;
    text: number;
  };
  status: 'published' | 'cancelled' | 'draft';
}

const postStatsStorage = new Map<string, PostStats>();

// Глобальное хранилище бота для доступа к сессиям
let botInstance: BotInstance | null = null;

/**
 * Сохраняет ссылку на бота для доступа к сессиям
 */
export function setBotInstance(bot: BotInstance) {
  botInstance = bot;
}

/**
 * Получает сессию пользователя
 * Сессии теперь управляются через Grammy framework
 */
export function getUserSession(userId: number): any | null {
  // Сессии управляются через Grammy framework в контексте запроса
  // Нет прямого доступа к сессиям других пользователей
  return null;
}

/**
 * Получает новости пользователя из хранилища
 */
export async function getUserNews(userId: number, channelId?: string): Promise<any[] | undefined> {
  // Создаем ключ для хранения новостей (userId + channelId)
  const storageKey = channelId ? `${userId}_${channelId}` : userId.toString();
  
  logger.info({
    msg: 'Getting user news',
    userId,
    channelId,
    storageKey,
    supabaseEnabled: supabaseService.isSupabaseEnabled(),
  });
  
  if (supabaseService.isSupabaseEnabled()) {
    try {
      logger.info({
        msg: 'Attempting to get news from Supabase',
        userId,
        channelId,
        storageKey,
      });
      
      const news = await supabaseService.getUserNews(userId, channelId);
      logger.info({
        msg: 'Retrieved news from Supabase',
        userId,
        newsCount: news?.length || 0,
        hasNews: !!news,
        newsType: typeof news,
        isArray: Array.isArray(news),
      });
      return news || undefined;
    } catch (error) {
      logger.error({
        msg: 'Failed to get news from Supabase',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback на in-memory storage
      const fallbackNews = userNewsStorage.get(storageKey);
      logger.info({
        msg: 'Using fallback in-memory storage',
        userId,
        channelId,
        storageKey,
        fallbackNewsCount: fallbackNews?.length || 0,
      });
      return fallbackNews;
    }
  }
  
  const inMemoryNews = userNewsStorage.get(storageKey);
  logger.info({
    msg: 'Retrieved news from in-memory storage',
    userId,
    channelId,
    storageKey,
    newsCount: inMemoryNews?.length || 0,
  });
  return inMemoryNews;
}

/**
 * Удаляет новости пользователя из хранилища
 */
export async function clearUserNews(userId: number, channelId?: string): Promise<boolean> {
  let cleared = false;
  
  // Создаем ключ для хранения новостей
  const storageKey = channelId ? `${userId}_${channelId}` : userId.toString();
  
  // Очищаем из in-memory хранилища
  const inMemoryCleared = userNewsStorage.delete(storageKey);
  if (inMemoryCleared) {
    cleared = true;
    logger.info({
      msg: 'Cleared news from in-memory storage',
      userId,
      channelId,
      storageKey
    });
  }
  
  // Очищаем из Supabase, если он включен
  if (supabaseService.isSupabaseEnabled()) {
            try {
          await supabaseService.deleteUserNews(userId, channelId);
          cleared = true;
      logger.info({
        msg: 'Cleared news from Supabase',
        userId,
        channelId
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to clear news from Supabase',
        userId,
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return cleared;
}

/**
 * Очищает pendingNewsRequest в сессии пользователя
 * Прямое удаление из Supabase grammy_sessions
 */
export async function clearPendingNewsRequest(userId: number): Promise<void> {
  if (supabaseService.isSupabaseEnabled()) {
    try {
      await supabaseService.clearPendingNewsRequest(userId);
      logger.info({
        msg: 'PendingNewsRequest cleared from Supabase',
        userId
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to clear pendingNewsRequest from Supabase',
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    logger.debug({
      msg: 'Supabase disabled, pendingNewsRequest will be cleared on next user interaction',
      userId
    });
  }
}

/**
 * Сохраняет обработанный пост пользователя
 */
export async function setUserProcessedPost(userId: number, processedPost: any): Promise<void> {
  if (supabaseService.isSupabaseEnabled()) {
    await supabaseService.saveProcessedPost(userId, processedPost);
  } else {
    userProcessedPostStorage.set(userId, processedPost);
  }
}

/**
 * Получает обработанный пост пользователя
 */
export async function getUserProcessedPost(userId: number): Promise<any | undefined> {
  if (supabaseService.isSupabaseEnabled()) {
    const post = await supabaseService.getProcessedPost(userId);
    return post || undefined;
  }
  return userProcessedPostStorage.get(userId);
}

/**
 * Удаляет обработанный пост пользователя
 */
export async function clearUserProcessedPost(userId: number): Promise<boolean> {
  if (supabaseService.isSupabaseEnabled()) {
    await supabaseService.deleteProcessedPost(userId);
    return true;
  }
  return userProcessedPostStorage.delete(userId);
}
/**
 * Обновляет счетчик регенераций для поста
 */
export async function incrementRegenerationCount(postId: string, type: 'title' | 'text'): Promise<void> {
  if (supabaseService.isSupabaseEnabled()) {
    await supabaseService.incrementRegenerationCount(postId, type);
  } else {
    const stats = postStatsStorage.get(postId);
    if (stats) {
      stats.regeneration_count[type]++;
      postStatsStorage.set(postId, stats);
    }
  }
}

/**
 * Уведомляет конкретного пользователя о готовности обработанных новостей
 */
async function notifySpecificUser(
  bot: BotInstance,
  newsData: any,
  userId: number,
  error?: string,
  channelId?: string
) {
  try {
    console.log(userId, 'notifySpecificUser')
    await notifyUserAboutProcessedNews(bot, userId, newsData, error, channelId);
  } catch (error) {
    logger.error({
      msg: 'Failed to notify specific user',
      userId,
      channelId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Уведомляет всех пользователей с активными запросами
 */
async function notifyAllActiveUsers(
  bot: BotInstance,
  newsData: any,
  error?: string
) {
  if (!botInstance) {
    logger.error({
      msg: 'Bot instance not available for session access'
    });
    return;
  }

  // Здесь нужно пройтись по всем активным сессиям
  // В упрощенной версии будем уведомлять всех админов
  const adminIds = config.BOT_ADMIN_USER_IDS;

  for (const userId of adminIds) {
    try {
      await notifyUserAboutProcessedNews(bot, userId, newsData, error);
    } catch (error) {
      logger.error({
        msg: 'Failed to notify admin user',
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Уведомляет пользователей с активными запросами для конкретного канала
 */
async function notifyUsersForChannel(
  bot: BotInstance,
  newsData: any,
  channelId: string,
  error?: string
) {
  if (!botInstance) {
    logger.error({
      msg: 'Bot instance not available for session access'
    });
    return;
  }

  // Находим пользователей, которые работают с этим каналом и имеют активные запросы
  const adminIds = config.BOT_ADMIN_USER_IDS;

  for (const userId of adminIds) {
    try {
      // В будущем здесь можно проверять сессию пользователя
      // и уведомлять только тех, кто работает с конкретным каналом
      await notifyUserAboutProcessedNews(bot, userId, newsData, error, channelId);
    } catch (error) {
      logger.error({
        msg: 'Failed to notify user for channel',
        userId,
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Уведомляет конкретного пользователя о готовности обработанных новостей
 */
async function notifyUserAboutProcessedNews(
  bot: BotInstance,
  userId: number,
  newsData: any,
  error?: string,
  channelId?: string
) {
  try {
    console.log(newsData, 'sadfasdfasdfasfas')
    // Извлекаем новости из структуры (как раньше в NewsService)
    let allNews = newsData || [];
    if(allNews instanceof Object) {
      allNews = allNews.news;
    }

    logger.info({
      msg: 'Notifying user about processed news',
      userId,
      channelId,
      hasNewsData: !!newsData,
      extractedNewsCount: allNews.length,
      hasError: !!error,
      notificationType: channelId ? 'channel-specific' : 'general'
    });

    if (error) {
      // Ошибка обработки
      const errorMessage = `❌ **Ошибка при обработке новостей:**\n\n\`${error}\``;
      
      await bot.api.sendMessage(userId, errorMessage, {
        parse_mode: "Markdown"
      });
      
      // Очищаем pendingNewsRequest при ошибке
      await clearPendingNewsRequest(userId);
    } else if (allNews && allNews.length > 0) {
      // Успешная обработка
      const keyboard = new InlineKeyboard()
        .text("📝 Выбрать пост для обработки", "select_post_for_processing");

      let successMessage = `✅ **Новости обработаны успешно!**\n\n📰 Получено: ${allNews.length} новостей\n\n🎯 Теперь можете выбрать пост для обработки и публикации!`;

      if (channelId) {
        // Получаем информацию о канале
        const channel = channelService.getChannelById(channelId);
        if (channel) {
          successMessage += `\n\n📢 **Канал:** ${channel.name}`;
        }
      }

      await bot.api.sendMessage(userId, successMessage, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });

      // Сохраняем новости в правильном формате для обработки
      const storageKey = channelId ? `${userId}_${channelId}` : userId.toString();
      userNewsStorage.set(storageKey, allNews);
      
      logger.info({
        msg: 'Saved news to in-memory storage',
        userId,
        channelId,
        newsCount: allNews.length,
      });
      
      // Также сохраняем в Supabase, если он включен
      if (supabaseService.isSupabaseEnabled()) {
        try {
          logger.info({
            msg: 'Attempting to save news to Supabase',
            userId,
            channelId,
            newsCount: allNews.length,
          });
          
          await supabaseService.saveUserNews(userId, allNews, channelId);
          logger.info({
            msg: 'Saved news to Supabase successfully',
            userId,
            channelId,
            newsCount: allNews.length,
          });
        } catch (error) {
          logger.error({
            msg: 'Failed to save news to Supabase',
            userId,
            channelId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      } else {
        logger.info({
          msg: 'Supabase disabled, using in-memory storage only',
          userId,
          channelId,
        });
      }
      
      logger.info({
        msg: 'Saved news to user storage',
        userId,
        channelId,
        newsCount: allNews.length,
      });
      
      // Очищаем pendingNewsRequest в сессии пользователя
      await clearPendingNewsRequest(userId);

    } else {
      // Нет новостей
      const noNewsMessage = `📭 **Новых новостей не найдено**`;
      
      await bot.api.sendMessage(userId, noNewsMessage, {
        parse_mode: "Markdown"
      });
      
      // Очищаем pendingNewsRequest при отсутствии новостей
      await clearPendingNewsRequest(userId);
    }

  } catch (error) {
    logger.error({
      msg: 'Failed to notify user about processed news',
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Уведомляет пользователя об ошибке workflow и предлагает попробовать снова
 */
async function notifyUserOfWorkflowError(
  bot: BotInstance,
  errorData: {
    userId: number;
    workflow: string;
    error: string;
    timestamp: string;
    retryCount: number;
    severity: string;
  }
) {
  try {
    const { userId, workflow, error, retryCount } = errorData;
    
    logger.error({
      msg: 'Notifying user about workflow error',
      userId,
      workflow,
      error,
      retryCount
    });

    // Очищаем состояние пользователя (сессии управляются в контексте запроса)
    // getUserSession возвращает null, так как нет прямого доступа к сессиям других пользователей
    logger.info({
      msg: 'Clearing user state for workflow error',
      userId
    });

    // Создаем клавиатуру с кнопкой "Попробовать снова"
    const keyboard = new InlineKeyboard()
      .text("🔄 Попробовать снова", "retry_news_processing");

    const errorMessage = `❌ **Ошибка при обработке новостей**\n\n` +
      `🔧 **Детали:**\n` +
      `├ Workflow: \`${workflow}\`\n` +
      `├ Попыток: \`${retryCount}\`\n` +
      `├ Время: \`${new Date(errorData.timestamp).toLocaleString('ru-RU')}\`\n` +
      `└ Ошибка: \`${error}\`\n\n` +
      `💡 **Решение:** Попробуйте запустить обработку заново`;

    await bot.api.sendMessage(userId, errorMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });

    logger.info({
      msg: 'User notified about workflow error',
      userId,
      workflow
    });

  } catch (error) {
    logger.error({
      msg: 'Failed to notify user about workflow error',
      userId: errorData.userId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export function startWebhookServer(bot: BotInstance) {
  // Сохраняем ссылку на бота для доступа к сессиям
  setBotInstance(bot);
  
  const app = createWebhookServer(bot);
  
  const server = app.listen(config.BOT_SERVER_PORT, config.BOT_SERVER_HOST, () => {
    logger.info({
      msg: 'webhook server started',
      host: config.BOT_SERVER_HOST,
      port: config.BOT_SERVER_PORT,
      endpoints: [
        `http://${config.BOT_SERVER_HOST}:${config.BOT_SERVER_PORT}/health`,
        `http://${config.BOT_SERVER_HOST}:${config.BOT_SERVER_PORT}/posts`,
        `http://${config.BOT_SERVER_HOST}:${config.BOT_SERVER_PORT}/bot/info`,
        `http://${config.BOT_SERVER_HOST}:${config.BOT_SERVER_PORT}/news-processed/:channelId`,
        `http://${config.BOT_SERVER_HOST}:${config.BOT_SERVER_PORT}/news-process-error`,
      ],
    });
  });

  return server;
}
