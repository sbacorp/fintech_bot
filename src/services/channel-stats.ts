import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { MyContext } from '../types/context.js';
import { getTrackedMessageStats } from './message-tracker.js';

interface ChannelStats {
  basic_info: {
    id: string;
    title: string;
    username?: string | undefined;
    description?: string | undefined;
    member_count: number;
    type: string;
  };
  recent_posts: {
    total_posts: number;
    posts_today: number;
    posts_this_week: number;
    posts_this_month: number;
  };
  engagement: {
    avg_views_per_post: number;
    total_views: number;
    avg_reactions_per_post: number;
    total_reactions: number;
    reaction_types: Record<string, number>;
  };
  growth: {
    members_growth_today: number;
    members_growth_week: number;
    members_growth_month: number;
  };
  top_posts: Array<{
    message_id: number;
    text: string;
    views: number;
    reactions: number;
    date: string;
  }>;
  updated_at: string;
}

// Кеш для статистики (обновляется раз в час)
let cachedStats: ChannelStats | null = null;
let lastUpdateTime: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 час

/**
 * Получает полную статистику канала
 */
export async function getChannelStats(ctx: MyContext): Promise<ChannelStats | null> {
  try {
    const channelId = config.CHANNEL_ID;
    if (!channelId) {
      throw new Error('Channel ID not configured');
    }

    // Проверяем кеш
    const now = Date.now();
    if (cachedStats && (now - lastUpdateTime) < CACHE_DURATION) {
      logger.info({ msg: 'Returning cached channel stats' });
      return cachedStats;
    }

    logger.info({ msg: 'Fetching fresh channel stats', channelId });

    // Используем API из контекста
    const api = ctx.api;
    
    // Добавляем валидацию API
    if (!api || typeof api.getChat !== 'function') {
      throw new Error('Invalid context API object');
    }

    // Получаем базовую информацию о канале
    let chatInfo;
    let memberCount;
    
    try {
      // Пробуем получить информацию о чате
      chatInfo = await api.getChat(channelId);
      logger.info({ msg: 'Successfully fetched chat info', chatType: chatInfo.type });
    } catch (chatError) {
      logger.error({ 
        msg: 'Failed to get chat info', 
        channelId, 
        error: chatError instanceof Error ? chatError.message : String(chatError) 
      });
      throw new Error(`Не удалось получить информацию о канале ${channelId}. Проверьте: 1) Правильность ID канала, 2) Добавлен ли бот в канал как администратор, 3) Есть ли у бота права на чтение сообщений`);
    }

    try {
      memberCount = await api.getChatMemberCount(channelId);
      logger.info({ msg: 'Successfully fetched member count', memberCount });
    } catch (memberError) {
      logger.error({ 
        msg: 'Failed to get member count', 
        error: memberError instanceof Error ? memberError.message : String(memberError) 
      });
      // Если не можем получить количество участников, используем 0
      memberCount = 0;
    }

    // Проверяем статус бота в канале
    try {
      const botInfo = await api.getMe();
      const botMember = await api.getChatMember(channelId, botInfo.id);
      logger.info({ 
        msg: 'Bot status in channel', 
        status: botMember.status,
        canReadMessages: 'can_read_all_group_messages' in botMember ? botMember.can_read_all_group_messages : 'unknown'
      });
      
      if (botMember.status === 'left' || botMember.status === 'kicked') {
        throw new Error(`Бот не добавлен в канал или был исключен. Статус: ${botMember.status}`);
      }
    } catch (statusError) {
      logger.error({ 
        msg: 'Failed to check bot status in channel', 
        error: statusError instanceof Error ? statusError.message : String(statusError) 
      });
      // Не прерываем выполнение, если не можем проверить статус
    }

    // Получаем последние сообщения для анализа
    const recentMessages = await getRecentMessages(ctx, channelId);
    
    // Анализируем статистику постов (комбинируем API данные и tracked данные)
    const postStats = analyzePostStats(recentMessages);
    
    // Дополняем данными из message tracker
    const trackedStats = getTrackedMessageStats();
    const combinedPostStats = {
      total_posts: Math.max(postStats.total_posts, trackedStats.totalMessages),
      posts_today: Math.max(postStats.posts_today, trackedStats.messagesLast24h),
      posts_this_week: Math.max(postStats.posts_this_week, trackedStats.messagesLast7days),
      posts_this_month: Math.max(postStats.posts_this_month, trackedStats.messagesLast30days)
    };
    
    // Анализируем вовлеченность
    const engagementStats = analyzeEngagement(recentMessages);

    // Находим топ посты
    const topPosts = getTopPosts(recentMessages);

    const stats: ChannelStats = {
      basic_info: {
        id: chatInfo.id.toString(),
        title: chatInfo.title || 'Unknown Channel',
        username: 'username' in chatInfo ? chatInfo.username : undefined,
        description: 'description' in chatInfo ? chatInfo.description : undefined,
        member_count: memberCount,
        type: chatInfo.type
      },
      recent_posts: combinedPostStats,
      engagement: engagementStats,
      growth: {
        // Telegram API не предоставляет данные роста напрямую
        // Эти данные нужно собирать самостоятельно со временем
        members_growth_today: 0,
        members_growth_week: 0,
        members_growth_month: 0
      },
      top_posts: topPosts,
      updated_at: new Date().toISOString()
    };

    // Кешируем результат
    cachedStats = stats;
    lastUpdateTime = now;

    logger.info({ 
      msg: 'Channel stats collected successfully',
      total_posts: postStats.total_posts,
      member_count: memberCount
    });

    return stats;

  } catch (error) {
    logger.error({
      msg: 'Failed to get channel stats',
      channelId: config.CHANNEL_ID,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

/**
 * Получает последние сообщения из канала для анализа
 */
async function getRecentMessages(ctx: MyContext, channelId: string, limit: number = 100): Promise<any[]> {
  const messages: any[] = [];
  
  try {
    // Используем API из контекста
    const api = ctx.api;
    
    logger.info({ 
      msg: 'Attempting to get recent messages',
      channelId,
      limit,
      note: 'Bot API has limitations for message history access'
    });
    
    // Способ 1: Проверяем webhook info (если используется webhook, getUpdates не работает)
    try {
      const webhookInfo = await api.getWebhookInfo();
      if (webhookInfo.url) {
        logger.warn({ 
          msg: 'Bot is using webhook mode - getUpdates will not work',
          webhookUrl: webhookInfo.url,
          solution: 'Message statistics require real-time collection or Client API'
        });
      } else {
        logger.info({ msg: 'Bot is in polling mode - getUpdates should work' });
      }
    } catch (webhookError) {
      logger.debug({ 
        msg: 'Could not check webhook info', 
        error: webhookError instanceof Error ? webhookError.message : String(webhookError) 
      });
    }
    
    // Способ 2: НЕ используем getUpdates напрямую, так как это конфликтует с runner
    logger.warn({ 
      msg: 'Skipping manual getUpdates call',
      reason: 'Bot uses @grammyjs/runner which conflicts with manual getUpdates calls',
      explanation: 'Only one process can use getUpdates at a time'
    });
    
    // Способ 3: Проверяем, есть ли способ получить последнее сообщение через другие методы
    try {
      logger.info({ msg: 'Trying alternative methods to get recent activity...' });
      
      // Попробуем получить информацию о канале для дополнительной диагностики
      const chatInfo = await api.getChat(channelId);
      
      logger.info({ 
        msg: 'Chat info retrieved', 
        chatType: chatInfo.type,
        hasLinkedChat: 'linked_chat_id' in chatInfo,
        hasDescription: 'description' in chatInfo
      });
      
      // Если это канал с комментариями, можем попробовать получить linked_chat_id
      if ('linked_chat_id' in chatInfo && chatInfo.linked_chat_id) {
        logger.info({ 
          msg: 'Channel has linked discussion group', 
          linkedChatId: chatInfo.linked_chat_id 
        });
      }
      
    } catch (alternativeError) {
      logger.debug({ 
        msg: 'Alternative methods also failed', 
        error: alternativeError instanceof Error ? alternativeError.message : String(alternativeError) 
      });
    }
    
    // Если нет сообщений, объясняем почему и предлагаем решения
    if (messages.length === 0) {
      logger.warn({ 
        msg: 'No recent messages available via Bot API',
        reasons: [
          'Bot API cannot access message history',
          'getUpdates only works for new messages in polling mode',
          'Webhook mode prevents getUpdates usage',
          'Messages need to be collected in real-time as they arrive'
        ],
        solutions: [
          'Set up real-time message collection via webhook/polling',
          'Use Telegram Client API (not Bot API) for history access',
          'Implement message storage when bot receives new posts',
          'For now, statistics will show 0 until new messages arrive'
        ]
      });
    }
    
    return messages;
    
  } catch (error) {
    logger.error({
      msg: 'Failed to get recent messages',
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

/**
 * Анализирует статистику постов по времени
 */
function analyzePostStats(messages: any[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    total_posts: messages.length,
    posts_today: messages.filter(msg => new Date(msg.date * 1000) >= today).length,
    posts_this_week: messages.filter(msg => new Date(msg.date * 1000) >= weekAgo).length,
    posts_this_month: messages.filter(msg => new Date(msg.date * 1000) >= monthAgo).length
  };
}

/**
 * Анализирует вовлеченность (просмотры, реакции)
 */
function analyzeEngagement(messages: any[]) {
  const totalViews = messages.reduce((sum, msg) => sum + (msg.views || 0), 0);
  const totalReactions = messages.reduce((sum, msg) => {
    if (msg.reactions) {
      return sum + msg.reactions.reduce((reactionSum: number, reaction: any) => 
        reactionSum + reaction.total_count, 0);
    }
    return sum;
  }, 0);

  // Анализ типов реакций
  const reactionTypes: Record<string, number> = {};
  messages.forEach(msg => {
    if (msg.reactions) {
      msg.reactions.forEach((reaction: any) => {
        const emoji = reaction.type.emoji || reaction.type.custom_emoji_id || 'unknown';
        reactionTypes[emoji] = (reactionTypes[emoji] || 0) + reaction.total_count;
      });
    }
  });

  return {
    total_views: totalViews,
    avg_views_per_post: messages.length > 0 ? totalViews / messages.length : 0,
    total_reactions: totalReactions,
    avg_reactions_per_post: messages.length > 0 ? totalReactions / messages.length : 0,
    reaction_types: reactionTypes
  };
}

/**
 * Находит топ посты по просмотрам и реакциям
 */
function getTopPosts(messages: any[], limit: number = 5) {
  return messages
    .filter(msg => msg.text) // Только текстовые сообщения
    .map(msg => ({
      message_id: msg.message_id,
      text: msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : ''),
      views: msg.views || 0,
      reactions: msg.reactions ? 
        msg.reactions.reduce((sum: number, r: any) => sum + r.total_count, 0) : 0,
      date: new Date(msg.date * 1000).toISOString()
    }))
    .sort((a, b) => (b.views + b.reactions * 10) - (a.views + a.reactions * 10)) // Реакции весят больше
    .slice(0, limit);
}

/**
 * Форматирует статистику для красивого вывода в Telegram
 */
export function formatChannelStats(stats: ChannelStats): string {
  const { basic_info, recent_posts, engagement, top_posts } = stats;
  
  let message = `📊 **Статистика канала "${basic_info.title}"**\n\n`;
  
  // Базовая информация
  message += `👥 **Подписчики:** ${basic_info.member_count.toLocaleString()}\n`;
  if (basic_info.username) {
    message += `🔗 **Канал:** @${basic_info.username}\n`;
  }
  message += `🆔 **ID:** \`${basic_info.id}\`\n\n`;
  
  // Статистика постов с пояснением
  message += `📰 **Посты:**\n`;
  message += `├ Всего: ${recent_posts.total_posts}\n`;
  message += `├ За сегодня: ${recent_posts.posts_today}\n`;
  message += `├ За неделю: ${recent_posts.posts_this_week}\n`;
  message += `└ За месяц: ${recent_posts.posts_this_month}\n`;
  
  // Добавляем пояснение об источнике данных
  if (recent_posts.total_posts === 0) {
    message += `\n⚠️ **Примечание:** Bot API не может получить историю сообщений.\n`;
    message += `Статистика постов будет доступна после перезапуска для новых сообщений.\n\n`;
  } else {
    const trackedStats = getTrackedMessageStats();
    if (trackedStats.totalMessages > 0) {
      message += `\n📊 **Источник данных:** Отслеживание в реальном времени (${trackedStats.totalMessages} постов)\n\n`;
    } else {
      message += `\n`;
    }
  }
  
  // Статистика вовлеченности
  message += `📈 **Вовлеченность:**\n`;
  message += `├ Всего просмотров: ${engagement.total_views.toLocaleString()}\n`;
  message += `├ Среднее на пост: ${Math.round(engagement.avg_views_per_post).toLocaleString()}\n`;
  message += `├ Всего реакций: ${engagement.total_reactions.toLocaleString()}\n`;
  message += `└ Среднее реакций: ${Math.round(engagement.avg_reactions_per_post)}\n\n`;
  
  // Популярные реакции
  if (Object.keys(engagement.reaction_types).length > 0) {
    message += `😍 **Популярные реакции:**\n`;
    const topReactions = Object.entries(engagement.reaction_types)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    topReactions.forEach(([emoji, count]) => {
      message += `├ ${emoji}: ${count}\n`;
    });
    message += `\n`;
  }
  
  // Топ посты
  if (top_posts.length > 0) {
    message += `🏆 **Топ посты:**\n`;
    top_posts.forEach((post, index) => {
      const date = new Date(post.date).toLocaleDateString('ru-RU');
      message += `${index + 1}. **${post.views}** 👀 **${post.reactions}** ❤️ (${date})\n`;
      message += `   ${post.text}\n\n`;
    });
  }
  
  message += `🕐 **Обновлено:** ${new Date(stats.updated_at).toLocaleString('ru-RU')}`;
  
  return message;
}

/**
 * Принудительно очищает кеш статистики
 */
export function clearStatsCache(): void {
  cachedStats = null;
  lastUpdateTime = 0;
  logger.info({ msg: 'Channel stats cache cleared' });
}

/**
 * Диагностирует проблемы с получением статистики сообщений
 */
export async function diagnoseMessageRetrieval(ctx: MyContext): Promise<string> {
  try {
    const api = ctx.api;
    const channelId = config.CHANNEL_ID;
    
    if (!channelId) {
      return '❌ Channel ID не настроен в конфигурации';
    }
    
    let diagnosis = '🔍 **Диагностика получения сообщений:**\n\n';
    
    // Проверяем webhook режим
    try {
      const webhookInfo = await api.getWebhookInfo();
      if (webhookInfo.url) {
        diagnosis += '⚠️ **Бот работает в webhook режиме**\n';
        diagnosis += `URL: ${webhookInfo.url}\n`;
        diagnosis += 'Проблема: getUpdates не работает в webhook режиме\n\n';
      } else {
        diagnosis += '✅ **Бот работает в polling режиме**\n';
        diagnosis += '⚠️ Но использует @grammyjs/runner который блокирует ручные getUpdates\n';
        diagnosis += 'Решение: Собирать статистику через middleware обработчики\n\n';
      }
    } catch (error) {
      diagnosis += '❌ Не удалось проверить webhook статус\n\n';
    }
    
    // Проверяем статус бота в канале
    try {
      const botInfo = await api.getMe();
      const botMember = await api.getChatMember(channelId, botInfo.id);
      diagnosis += `🤖 **Статус бота в канале:** ${botMember.status}\n`;
      
      if (botMember.status === 'administrator') {
        diagnosis += '✅ Бот является администратором\n\n';
      } else if (botMember.status === 'member') {
        diagnosis += '⚠️ Бот простой участник (может не видеть всю историю)\n\n';
      } else {
        diagnosis += '❌ Бот не имеет доступа к каналу\n\n';
      }
    } catch (error) {
      diagnosis += '❌ Не удалось проверить статус бота в канале\n\n';
    }
    
    diagnosis += '💡 **Решения для получения статистики постов:**\n';
    diagnosis += '1. **Сбор в реальном времени**: Добавить middleware для обработки channel_post\n';
    diagnosis += '2. **Локальная база данных**: Сохранять статистику постов при получении\n';
    diagnosis += '3. **Telegram Client API**: Использовать вместо Bot API для доступа к истории\n';
    diagnosis += '4. **Webhook + database**: Собирать данные через webhook обработчики\n';
    diagnosis += '5. **Прекратить использование getUpdates**: Избегать конфликтов с runner\n';
    
    return diagnosis;
    
  } catch (error) {
    return `❌ Ошибка диагностики: ${error instanceof Error ? error.message : String(error)}`;
  }
}
