import { MyContext } from '../types/context.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// Простое in-memory хранилище для статистики (в продакшене использовать базу данных)
interface MessageStats {
  totalMessages: number;
  messagesLast24h: number;
  messagesLast7days: number;
  messagesLast30days: number;
  lastUpdated: number;
}

let messageStats: MessageStats = {
  totalMessages: 0,
  messagesLast24h: 0,
  messagesLast7days: 0,
  messagesLast30days: 0,
  lastUpdated: Date.now()
};

// Массив с временными метками сообщений (для подсчета за периоды)
const messageTimestamps: number[] = [];

/**
 * Middleware для отслеживания сообщений в канале
 */
export function messageTrackerMiddleware() {
  return async (ctx: MyContext, next: () => Promise<void>) => {
    // Проверяем, это ли сообщение из нашего канала
    if (ctx.channelPost && ctx.channelPost.chat.id.toString() === config.CHANNEL_ID) {
      try {
        const messageDate = ctx.channelPost.date * 1000; // Переводим в миллисекунды
        
        // Добавляем временную метку
        messageTimestamps.push(messageDate);
        
        // Очищаем старые записи (старше 30 дней)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentMessages = messageTimestamps.filter(timestamp => timestamp > thirtyDaysAgo);
        messageTimestamps.length = 0;
        messageTimestamps.push(...recentMessages);
        
        // Обновляем статистику
        updateMessageStats();
        
        logger.info({
          msg: 'Channel message tracked',
          channelId: config.CHANNEL_ID,
          messageId: ctx.channelPost.message_id,
          totalTracked: messageStats.totalMessages,
          last24h: messageStats.messagesLast24h
        });
        
      } catch (error) {
        logger.error({
          msg: 'Failed to track channel message',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    await next();
  };
}

/**
 * Обновляет статистику сообщений
 */
function updateMessageStats() {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  
  messageStats = {
    totalMessages: messageTimestamps.length,
    messagesLast24h: messageTimestamps.filter(timestamp => timestamp > oneDayAgo).length,
    messagesLast7days: messageTimestamps.filter(timestamp => timestamp > sevenDaysAgo).length,
    messagesLast30days: messageTimestamps.filter(timestamp => timestamp > thirtyDaysAgo).length,
    lastUpdated: now
  };
}

/**
 * Получает текущую статистику сообщений
 */
export function getTrackedMessageStats(): MessageStats {
  // Обновляем статистику перед возвратом
  updateMessageStats();
  return { ...messageStats };
}

/**
 * Очищает собранную статистику
 */
export function clearTrackedStats(): void {
  messageTimestamps.length = 0;
  messageStats = {
    totalMessages: 0,
    messagesLast24h: 0,
    messagesLast7days: 0,
    messagesLast30days: 0,
    lastUpdated: Date.now()
  };
  logger.info({ msg: 'Tracked message stats cleared' });
}

/**
 * Возвращает информацию о трекинге
 */
export function getTrackingInfo(): string {
  const stats = getTrackedMessageStats();
  const uptimeHours = Math.round((Date.now() - stats.lastUpdated) / (1000 * 60 * 60));
  
  return `📊 **Статистика трекинга сообщений:**

📈 **Собранные данные:**
├ Всего отслежено: ${stats.totalMessages}
├ За последние 24 часа: ${stats.messagesLast24h}
├ За последние 7 дней: ${stats.messagesLast7days}
└ За последние 30 дней: ${stats.messagesLast30days}

⏰ **Время сбора:** ${uptimeHours} часов

💡 **Примечание:** Данные собираются только с момента запуска бота.
Для полной статистики запустите бота и дождитесь новых постов в канале.`;
}
