import { logger } from "../../../utils/logger.js";
import { MyContext } from "../../../types/context.js";
import { clearUserNews, clearUserProcessedPost, getUserNews, getUserProcessedPost } from "../../../services/webhook.js";

/**
 * Команда для очистки состояния pending запросов
 */
export async function clearStateCommand(ctx: MyContext) {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply('❌ Произошла ошибка: не удалось получить ID пользователя');
    return;
  }

  try {
    let stateCleared = false;
    let statusMessage = '🧹 <b> Статус очистки состояния: </b>\n\n';

    // Очищаем pending запрос из сессии
    if (ctx.session.pendingNewsRequest) {
      const pendingStatus = ctx.session.pendingNewsRequest.status;
      const startTime = ctx.session.pendingNewsRequest.startTime;
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      delete ctx.session.pendingNewsRequest;
      stateCleared = true;
      
      statusMessage += `✅ Удален pending запрос\n`;
      statusMessage += `   Status: ${pendingStatus}\n`;
      statusMessage += `   Duration: ${duration}s\n\n`;
    } else {
      statusMessage += `ℹ️ Pending запросов не найдено\n\n`;
    }

    // Очищаем новости пользователя
    const selectedChannel = ctx.session.selectedChannel;
    const channelId = selectedChannel?.id;

    const newsCleared = await clearUserNews(userId, channelId);
    console.log('newsCleared', newsCleared);
    const processedPostCleared = await clearUserProcessedPost(userId);
    console.log('processedPostCleared', processedPostCleared);
    
    if (newsCleared) {
      statusMessage += `✅ Очищены сохранённые новости\n`;
      stateCleared = true;
    } else {
      statusMessage += `✅ Сохранённых новостей не найдено\n`;
    }

    if (processedPostCleared) {
      statusMessage += `✅ Очищен обработанный пост\n\n`;
      stateCleared = true;
    } else {
      statusMessage += `Обработанных постов не найдено\n\n`;
    }

    if (stateCleared) {
      statusMessage += `<b> Состояние очищено! </b> \n Теперь можно выполнить /get_posts`;
    } else {
      statusMessage += `<b> Состояние было чистым </b> \n Всё готово для новых запросов`;
    }

    console.log('statusMessage', statusMessage);

    await ctx.reply(statusMessage, { parse_mode: "HTML" });

    logger.info({
      msg: 'State cleared by admin',
      userId,
      hadPendingRequest: !!ctx.session.pendingNewsRequest,
      hadSavedNews: newsCleared,
    });

  } catch (error) {
    logger.error({
      msg: 'Failed to clear state',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    await ctx.reply(
      `❌ Ошибка при очистке состояния:\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Команда для проверки текущего состояния
 */
export async function statusCommand(ctx: MyContext) {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply('❌ Произошла ошибка: не удалось получить ID пользователя');
    return;
  }

  try {
    let statusMessage = '📊 **Текущее состояние:**\n\n';

    // Проверяем pending запрос
    if (ctx.session.pendingNewsRequest) {
      const request = ctx.session.pendingNewsRequest;
      const duration = Math.round((Date.now() - request.startTime) / 1000);
      
      statusMessage += `🔄 **Активный запрос:**\n`;
      statusMessage += `   Status: ${request.status}\n`;
      statusMessage += `   Duration: ${duration}s\n`;
      statusMessage += `   Message ID: ${request.messageId || 'N/A'}\n\n`;
    } else {
      statusMessage += `✅ Активных запросов нет\n\n`;
    }

    // Проверяем сохранённые новости
    const savedNews = await getUserNews(userId);
    const processedPost = await getUserProcessedPost(userId);
    
    if (savedNews && savedNews.length > 0) {
      const totalNews = savedNews[0]?.news?.length || 0;
      statusMessage += `📰 **Сохранённые новости:**\n`;
      statusMessage += `   Количество: ${totalNews}\n`;
      statusMessage += `   Доступны для выбора\n\n`;
    } else {
      statusMessage += `📭 Сохранённых новостей нет\n\n`;
    }

    if (processedPost) {
      statusMessage += `📝 **Обработанный пост:**\n`;
      statusMessage += `   Заголовок: ${processedPost.trigger_title?.substring(0, 50) || 'Без заголовка'}...\n`;
      statusMessage += `   Доступны кнопки управления\n\n`;
    } else {
      statusMessage += `📝 Обработанных постов нет\n\n`;
    }

    statusMessage += `🎯 **Доступные действия:**\n`;
    if (!ctx.session.pendingNewsRequest) {
      statusMessage += `• /get_posts - получить новости\n`;
    }
    if (savedNews && savedNews.length > 0) {
      statusMessage += `• /view_posts - просмотреть сохраненные новости\n`;
      statusMessage += `• Кнопка "Выбрать пост" - обработать новость\n`;
    } else {
      statusMessage += `• /view_posts - просмотреть сохраненные новости\n`;
    }
    statusMessage += `• /clear_state - очистить состояние\n`;
    statusMessage += `• /status - проверить статус`;

    await ctx.reply(statusMessage, { parse_mode: "Markdown" });

    logger.info({
      msg: 'Status checked by admin',
      userId,
      hasPendingRequest: !!ctx.session.pendingNewsRequest,
      hasSavedNews: !!(savedNews && savedNews.length > 0),
    });

  } catch (error) {
    logger.error({
      msg: 'Failed to check status',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    await ctx.reply(
      `❌ Ошибка при проверке статуса:\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}
