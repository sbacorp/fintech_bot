import { MyContext } from "../../../types/context.js";
import { logger } from "../../../utils/logger.js";

/**
 * Команда для очистки состояния бота
 */
export async function clearStateCommand(ctx: MyContext) {
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply("❌ Не удалось определить пользователя");
    return;
  }

  try {
    // Очищаем сессию пользователя
    ctx.session = {} as any;
    
    // Очищаем pendingNewsRequest если есть
    if (ctx.session.pendingNewsRequest) {
      delete ctx.session.pendingNewsRequest;
    }

    logger.info({
      msg: 'User state cleared',
      userId,
      command: 'clear_state'
    });

    await ctx.reply("✅ *Состояние бота очищено!*\n\nВсе сохраненные данные и настройки сброшены. Вы можете начать заново.", { parse_mode: "Markdown" });
    
  } catch (error) {
    logger.error({
      msg: 'Error clearing user state',
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    await ctx.reply("❌ Произошла ошибка при очистке состояния");
  }
}

/**
 * Команда для проверки текущего состояния
 */
export async function statusCommand(ctx: MyContext) {
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply("❌ Не удалось определить пользователя");
    return;
  }

  try {
    let statusMessage = "📊 **Текущее состояние бота:**\n\n";
    
    // Проверяем наличие pendingNewsRequest
    if (ctx.session.pendingNewsRequest) {
      const request = ctx.session.pendingNewsRequest;
      statusMessage += `🔄 **Ожидание новостей:**\n`;
      statusMessage += `• Статус: ${request.status}\n`;
      statusMessage += `• Время начала: ${new Date(request.startTime).toLocaleString()}\n`;
      statusMessage += `• ID сообщения: ${request.messageId}\n\n`;
    } else {
      statusMessage += `✅ **Нет активных запросов**\n\n`;
    }

    // Проверяем выбранный канал
    if (ctx.session.selectedChannel) {
      statusMessage += `📢 **Выбранный канал:**\n`;
      statusMessage += `• Username: ${ctx.session.selectedChannel.channel_username}\n`;
      statusMessage += `• Название: ${ctx.session.selectedChannel.name}\n\n`;
    } else {
      statusMessage += `⚠️ **Канал не выбран**\n\n`;
    }

    // Информация о доступных командах
    statusMessage += `🎯 **Доступные команды:**\n`;
    statusMessage += `• /get_posts - получить новости\n`;
    statusMessage += `• /view_posts - просмотреть сохраненные новости\n`;
    statusMessage += `• /select_channel - выбрать канал\n`;
    statusMessage += `• /clear_state - очистить состояние\n`;
    statusMessage += `• /status - проверить состояние\n`;

    await ctx.reply(statusMessage, { parse_mode: "Markdown" });
    
  } catch (error) {
    logger.error({
      msg: 'Error getting status',
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    await ctx.reply("❌ Произошла ошибка при получении статуса");
  }
}
