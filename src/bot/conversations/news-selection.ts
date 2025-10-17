import { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import axios from "axios";
import { logger } from "../../utils/logger.js";
import { channelService } from "../../services/channel-service.js";
import { MyConversation } from "../../types/context.js";
import { getUserNews, setUserProcessedPost } from "../../services/webhook.js";
import { displayPost } from "../../utils/post-display.js";
import { N8N_WEBHOOK_PATHES } from "../../utils/n8n_pathes.js";

export interface ProcessedPost {
  main_post_image: string;
  original_title: string;
  generated_title: string;
  generated_post_text: string;
  hashtags: string;
  original_link: string;
  channelId: string;
  channelName: string;
}
/**
 * Conversation для выбора и обработки новостей админом
 */
export async function newsSelectionConversation(
  conversation: MyConversation,
  ctx: Context
) {
  try {
    const session = await conversation.external((ctx) => ctx.session);
    // Получаем userId напрямую из conversation context
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Не удалось получить ID пользователя");
      return;
    }

    // Получаем выбранный канал из сессии
    const selectedChannel = session.selectedChannel;
    if (!selectedChannel) {
      await ctx.reply("❌ Не выбран канал для работы");
      return;
    }

    // Получаем новости из глобального хранилища (без external)
    const selectedNews = (await getUserNews(userId, selectedChannel.id)) || [];

    if (!selectedNews || selectedNews.length === 0) {
      await ctx.reply(
        "❌ Нет новостей для обработки. Сначала выполните команду /get_posts и дождитесь завершения обработки."
      );
      return;
    }

    logger.info({
      msg: "Found news for processing in conversation",
      userId,
      newsCount: selectedNews.length,
    });

    // Показываем список новостей для выбора
    await displayNewsList(ctx, selectedNews);

    // Новости уже в правильном формате после исправления webhook
    const allNews = selectedNews;

    logger.debug({
      msg: "Extracted news for selection",
      totalNews: allNews.length,
      originalStructureLength: selectedNews.length,
    });

    // Ждем ввода номера поста
    await ctx.reply("📝 Введите номер поста для обработки:");

    const { message } = await conversation.waitFor("message:text");
    const postIndex = parseInt(message.text.trim(), 10) - 1;

    if (isNaN(postIndex) || postIndex < 0 || postIndex >= allNews.length) {
      await ctx.reply(
        `❌ Неверный номер поста. Доступны посты от 1 до ${allNews.length}. Попробуйте еще раз.`
      );
      return;
    }

    // Сохраняем выбранный пост (не используем external для простых операций)

    const selectedPost = allNews[postIndex];

    logger.info({
      msg: "Post selected for processing",
      postIndex: postIndex + 1,
      title: selectedPost.title?.substring(0, 100) || "no title",
      category: selectedPost.category,
      urgency: selectedPost.urgency,
    });

    // Отправляем новость на обработку в n8n
    await ctx.reply("🔄 Обрабатываю новость...");

    const processedPost = await processNewsWithN8n(
      selectedPost,
      selectedChannel,
      userId
    );

    if (!processedPost) {
      // Создаем клавиатуру с кнопкой повторной попытки
      const retryKeyboard = new InlineKeyboard()
        .text("🔄 Попробовать снова", "retry_single_news_processing")
        .row()
        .text("❌ Отменить", "cancel_news_processing");

      // Очищаем pendingNewsRequest при ошибке обработки
      if (session.pendingNewsRequest) {
        delete session.pendingNewsRequest;
        logger.info({
          msg: "Cleared pendingNewsRequest after processing error",
          userId,
        });
      }

      await ctx.reply(
        "❌ **Ошибка при обработке новости в n8n**\n\n" +
          "Возможные причины:\n" +
          "• Временная недоступность n8n\n" +
          "• Ошибка в workflow\n" +
          "• Проблемы с сетью\n\n" +
          "Попробуйте повторить попытку или отмените обработку.",
        {
          parse_mode: "Markdown",
          reply_markup: retryKeyboard,
        }
      );
      return;
    }

    // Сохраняем обработанный пост в глобальном хранилище
    await setUserProcessedPost(userId, processedPost);

    // Очищаем pendingNewsRequest после успешной обработки
    if (session.pendingNewsRequest) {
      delete session.pendingNewsRequest;
      logger.info({
        msg: "Cleared pendingNewsRequest after successful news processing",
        userId,
      });
    }

    // Показываем результат обработки с кнопками
    await displayProcessedPost(ctx, processedPost);
  } catch (error) {
    logger.error({
      msg: "Error in news selection conversation",
      error: error instanceof Error ? error.message : String(error),
    });

    // Очищаем pendingNewsRequest при общей ошибке
    try {
      const session = await conversation.external((ctx) => ctx.session);
      const userId = ctx.from?.id;

      if (session.pendingNewsRequest && userId) {
        delete session.pendingNewsRequest;
        logger.info({
          msg: "Cleared pendingNewsRequest after conversation error",
          userId,
        });
      }
    } catch (sessionError) {
      logger.warn({
        msg: "Failed to clear pendingNewsRequest in error handler",
        error:
          sessionError instanceof Error
            ? sessionError.message
            : String(sessionError),
      });
    }

    await ctx.reply(
      `❌ Произошла ошибка: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Отображает список новостей для выбора
 */
async function displayNewsList(ctx: Context, news: any[]) {
  let newsListText = "📰 **Доступные новости для обработки:**\n\n";

  logger.debug({
    msg: "Displaying news list",
    newsCount: news.length,
    sampleTitles: news
      .slice(0, 3)
      .map((item) => item.title?.substring(0, 50) || "no title"),
  });

  if (news.length === 0) {
    newsListText += "❌ Новости не найдены\n";
  } else {
    news.forEach((item, index) => {
      const title = item.title || "Без заголовка";
      newsListText += `**${index + 1}.** ${title}\n`;

      if (item.summary) {
        const shortDesc =
          item.summary.length > 100
            ? item.summary.substring(0, 100) + "..."
            : item.summary;
        newsListText += `   ${shortDesc}\n`;
      }

      if (item.category) {
        newsListText += `   📂 ${item.category}`;
        if (item.urgency) {
          const urgencyIcon =
            item.urgency === "high"
              ? "🔥"
              : item.urgency === "medium"
              ? "⚡"
              : "📋";
          newsListText += ` ${urgencyIcon}${item.urgency}`;
        }
        newsListText += "\n";
      }

      newsListText += "\n";
    });
  }

  await ctx.reply(newsListText, { parse_mode: "Markdown" });
}

/**
 * Отправляет новость на обработку в n8n
 */
async function processNewsWithN8n(
  post: any,
  selectedChannel?: any,
  userId?: number,
  retryCount: number = 0
) {
  const maxRetries = 0; // Максимум 2 повторные попытки

  try {
    // Получаем выбранный канал из контекста или используем переданный
    let channel = selectedChannel;
    if (!channel) {
      // Если канал не передан, используем канал по умолчанию
      channel = channelService.getDefaultChannel();
    }

    if (!channel) {
      logger.error({
        msg: "No channel available for news processing",
        postTitle: post.title,
      });
      return null;
    }

    const createUrl = N8N_WEBHOOK_PATHES.CREATE
    if (!createUrl) {
      logger.error({
        msg: "Create URL not configured for channel",
        channelId: channel.id,
        channelName: channel.name,
        postTitle: post.title,
      });
      return null;
    }

    logger.info({
      msg: "Processing news with n8n",
      channelId: channel.id,
      channelName: channel.name,
      createUrl: createUrl,
      postTitle: post.title,
    });

    const requestData = {
      // Данные поста
      title: post.title,
      description: post.summary || post.description,
      link: post.url || post.link,

      // Метаданные канала
      channelId: channel.id,
      channelName: channel.name,
      channelDescription: channel.description,

      // Пользователь
      userId: userId,

      // AI промпт для генерации поста
      aiPrompt: channelService.getAiPrompt(channel),
    };

    const response = await axios.post(createUrl, requestData, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 120000, // 120 секунд таймаут
    });

    logger.info({
      msg: "News processed by n8n",
      channelId: channel.id,
      channelName: channel.name,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
    });

    // Проверяем валидность ответа
    if (!response.data) {
      logger.error({
        msg: "Empty response from n8n",
        channelId: channel.id,
        channelName: channel.name,
        postTitle: post.title,
        status: response.status,
      });
      throw new Error("Empty response from n8n");
    }

    // Добавляем ссылку на оригинальную статью к обработанному посту
    const processedPost = response.data as ProcessedPost;
    if (processedPost) {
      processedPost.original_link = post.url || post.link;
      processedPost.channelId = channel.id;
      processedPost.channelName = channel.name;
    }

    logger.info({
      msg: "Successfully processed news",
      channelId: channel.id,
      channelName: channel.name,
      postTitle: post.title,
      hasProcessedPost: !!processedPost,
    });

    return processedPost;
  } catch (error) {
    logger.error({
      msg: "Failed to process news with n8n",
      channelId: selectedChannel?.id,
      channelName: selectedChannel?.name,
      postTitle: post.title,
      retryCount,
      error: error instanceof Error ? error.message : String(error),
    });

    // Если есть еще попытки, пробуем снова
    if (retryCount < maxRetries) {
      logger.info({
        msg: "Retrying news processing",
        channelId: selectedChannel?.id,
        channelName: selectedChannel?.name,
        postTitle: post.title,
        retryCount: retryCount + 1,
        maxRetries,
      });

      // Ждем немного перед повторной попыткой
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return processNewsWithN8n(post, selectedChannel, userId, retryCount + 1);
    }

    return null;
  }
}

/**
 * Отображает обработанный пост с интерактивными кнопками
 */
async function displayProcessedPost(ctx: Context, processedPost: ProcessedPost) {
  await displayPost(ctx, processedPost);

  // Если есть изображение, отправляем его отдельно
  if (processedPost.main_post_image) {
    try {
      await ctx.replyWithPhoto(processedPost.main_post_image, {
        caption: "🖼️ Изображение для поста",
      });
    } catch (error) {
      logger.error({
        msg: "Failed to send post image",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
