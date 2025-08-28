import { logger } from "../../../utils/logger.js";
import { MyContext } from "../../../types/context.js";
import { clearUserNews } from "../../../services/webhook.js";

/**
 * Обработчик для кнопки "Очистить новости"
 */
export async function clearSavedNewsHandler(ctx: MyContext) {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.answerCallbackQuery("❌ Не удалось получить ID пользователя");
    return;
  }

  try {
    logger.info({
      msg: 'Starting news clearing process',
      userId
    });
    
    // Получаем выбранный канал из сессии
    const selectedChannel = ctx.session.selectedChannel;
    const channelId = selectedChannel?.id;
    
    // Очищаем новости из хранилища
    const cleared = await clearUserNews(userId, channelId);

    logger.info({
      msg: 'News clearing completed',
      userId,
      cleared
    });

    if (cleared) {
      await ctx.answerCallbackQuery("✅ Новости очищены");
      await ctx.editMessageText(
        "🗑️ **Сохраненные новости очищены**\n\n" +
        "Теперь можете получить новые новости командой `/get_posts`",
        { parse_mode: "Markdown" }
      );

      logger.info({
        msg: 'Saved news cleared by user',
        userId
      });
    } else {
      await ctx.answerCallbackQuery("ℹ️ Новостей для очистки не найдено");
      await ctx.editMessageText(
        "ℹ️ **Новостей для очистки не найдено**\n\n" +
        "Сохраненные новости уже были очищены или отсутствуют.",
        { parse_mode: "Markdown" }
      );
    }

  } catch (error) {
    logger.error({
      msg: 'Failed to clear saved news',
      userId,
      error: error instanceof Error ? error.message : String(error)
    });

    await ctx.answerCallbackQuery("❌ Ошибка при очистке новостей");
    await ctx.editMessageText(
      "❌ **Ошибка при очистке новостей**\n\n" +
      `Детали: ${error instanceof Error ? error.message : String(error)}`,
      { parse_mode: "Markdown" }
    );
  }
}
