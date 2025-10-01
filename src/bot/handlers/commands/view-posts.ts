import { logger } from "../../../utils/logger.js";
import { MyContext } from "../../../types/context.js";
import { InlineKeyboard } from "grammy";
import { getUserNews } from "../../../services/webhook.js";

/**
 * Команда для просмотра уже запрошенных новостей
 */
export async function viewPostsCommand(ctx: MyContext) {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply('❌ Произошла ошибка: не удалось получить ID пользователя');
    return;
  }

  try {
    // Получаем выбранный канал
    const selectedChannel = ctx.session.selectedChannel;
    if (!selectedChannel) {
      await ctx.reply('❌ Не выбран канал для работы. Используйте /select_channel для выбора канала.');
      return;
    }

    logger.info({
      msg: 'Viewing posts for user',
      userId,
      channelId: selectedChannel.id,
      channelName: selectedChannel.name
    });

    // Получаем новости из хранилища
    const savedNews = await getUserNews(userId, selectedChannel.id);

    if (!savedNews || savedNews.length === 0) {
      await ctx.reply(
        "📭 **Нет сохраненных новостей**\n\n" +
        "Сначала выполните команду `/get_posts` для получения новостей.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Показываем информацию о найденных новостях
    const newsCount = savedNews.length;
    let infoMessage = `📰 **Найдено сохраненных новостей: ${newsCount}**\n\n`;
    infoMessage += `📢 **Канал:** ${selectedChannel.name}\n\n`;

    // Показываем список новостей
    savedNews.forEach((item, index) => {
      const title = item.title || 'Без заголовка';
      infoMessage += `**${index + 1}.** ${title}\n`;
      
      if (item.summary) {
        const shortDesc = item.summary.length > 100 
          ? item.summary.substring(0, 100) + "..." 
          : item.summary;
        infoMessage += `   ${shortDesc}\n`;
      }
      
      if (item.category) {
        infoMessage += `   📂 ${item.category}`;
        if (item.urgency) {
          const urgencyIcon = item.urgency === 'high' ? '🔥' : item.urgency === 'medium' ? '⚡' : '📋';
          infoMessage += ` ${urgencyIcon}${item.urgency}`;
        }
        infoMessage += "\n";
      }
      
      infoMessage += "\n";
    });

    // Создаем клавиатуру с кнопкой выбора поста
    const keyboard = new InlineKeyboard()
      .text("📝 Выбрать пост для обработки", "select_post_for_processing")
      .row()
      .text("🔄 Получить новые новости", "retry_news_processing")
      .row()

    infoMessage += "🎯 **Доступные действия:**\n";
    infoMessage += "• Выберите пост для обработки\n";
    infoMessage += "• Получите новые новости";

    await ctx.reply(infoMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });

    logger.info({
      msg: 'Posts displayed successfully',
      userId,
      channelId: selectedChannel.id,
      newsCount
    });

  } catch (error) {
    logger.error({
      msg: 'Error viewing posts',
      userId,
      error: error instanceof Error ? error.message : String(error)
    });

    await ctx.reply(
      `❌ Произошла ошибка при просмотре новостей:\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}
