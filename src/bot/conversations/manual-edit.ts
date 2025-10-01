import { Context } from "grammy";
import { MyConversation } from "../../types/context.js";
import { logger } from "../../utils/logger.js";
import { InlineKeyboard } from "grammy";
import { getUserProcessedPost, setUserProcessedPost } from "../../services/webhook.js";
import { displayPost } from "../../utils/post-display.js";

/**
 * Conversation для ручного редактирования заголовка поста
 */
export async function editTitleConversation(
  conversation: MyConversation,
  ctx: Context
) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Не удалось получить ID пользователя");
      return;
    }

    // Получаем текущий пост
    const processedPost = await getUserProcessedPost(userId);
    
    if (!processedPost) {
      await ctx.reply("❌ Нет данных для редактирования");
      return;
    }

    // Показываем текущий заголовок
    await ctx.reply(
      `✏️ **Редактирование заголовка**\n\n` +
      `📰 **Текущий заголовок:**\n${processedPost.generated_title || processedPost.original_title}\n\n` +
      `✍️ Напишите новый заголовок:`,
      { parse_mode: "Markdown" }
    );

    // Ждем ввода нового заголовка
    const { message } = await conversation.waitFor("message:text");
    const newTitle = message.text.trim();

    if (!newTitle) {
      await ctx.reply("❌ Заголовок не может быть пустым. Попробуйте еще раз.");
      return;
    }

    // Обновляем заголовок
    processedPost.generated_title = newTitle;
    await setUserProcessedPost(userId, processedPost);

    logger.info({
      msg: 'Title manually edited',
      userId,
      newTitle: newTitle.substring(0, 100)
    });

    // Показываем обновленный пост
    await displayUpdatedPost(ctx, processedPost, "заголовок");

  } catch (error) {
    logger.error({
      msg: 'Error in edit title conversation',
      error: error instanceof Error ? error.message : String(error)
    });
    await ctx.reply(`❌ Произошла ошибка: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Conversation для ручного редактирования текста поста
 */
export async function editTextConversation(
  conversation: MyConversation,
  ctx: Context
) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Не удалось получить ID пользователя");
      return;
    }

    // Получаем текущий пост
    const processedPost = await getUserProcessedPost(userId);
    
    if (!processedPost) {
      await ctx.reply("❌ Нет данных для редактирования");
      return;
    }

    // Показываем текущий текст
    await ctx.reply(
      `📝 **Редактирование текста поста**\n\n` +
      `📄 **Текущий текст:**\n${processedPost.generated_post_text}\n\n` +
      `✍️ Напишите новый текст поста:`,
      { parse_mode: "Markdown" }
    );

    // Ждем ввода нового текста
    const { message } = await conversation.waitFor("message:text");
    const newText = message.text.trim();

    if (!newText) {
      await ctx.reply("❌ Текст поста не может быть пустым. Попробуйте еще раз.");
      return;
    }

    // Обновляем текст
    processedPost.generated_post_text = newText;
    await setUserProcessedPost(userId, processedPost);

    logger.info({
      msg: 'Text manually edited',
      userId,
      newText: newText.substring(0, 100) + '...'
    });

    // Показываем обновленный пост
    await displayUpdatedPost(ctx, processedPost, "текст");

  } catch (error) {
    logger.error({
      msg: 'Error in edit text conversation',
      error: error instanceof Error ? error.message : String(error)
    });
    await ctx.reply(`❌ Произошла ошибка: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Conversation для ручного редактирования хэштегов поста
 */
export async function editHashtagsConversation(
  conversation: MyConversation,
  ctx: Context
) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Не удалось получить ID пользователя");
      return;
    }

    // Получаем текущий пост
    const processedPost = await getUserProcessedPost(userId);
    
    if (!processedPost) {
      await ctx.reply("❌ Нет данных для редактирования");
      return;
    }

    // Показываем текущие хэштеги
    const currentHashtags = processedPost.hashtags && processedPost.hashtags.length > 0 
      ? processedPost.hashtags.split(' ').join(', ')
      : 'нет хэштегов';

    await ctx.reply(
      `🏷️ **Редактирование хэштегов**\n\n` +
      `📝 **Текущие хэштеги:** ${currentHashtags}\n\n` +
      `✍️ Введите новые хэштеги через запятую или пробел\n` +
      `💡 Пример: #fintech #payments #crypto\n\n` +
      `❌ Для отмены отправьте /cancel`,
      { parse_mode: "Markdown" }
    );

    // Ждем ввода новых хэштегов
    const { message } = await conversation.waitFor("message:text");
    const newHashtagsText = message.text.trim();

    if (!newHashtagsText) {
      await ctx.reply("❌ Хэштеги не могут быть пустыми. Попробуйте еще раз.");
      return;
    }

    // Парсим хэштеги из текста
    const hashtags = parseHashtags(newHashtagsText);

    // Обновляем хэштеги
    processedPost.hashtags = hashtags.join()
    await setUserProcessedPost(userId, processedPost);

    logger.info({
      msg: 'Hashtags manually edited',
      userId,
      newHashtags: hashtags
    });

    // Показываем обновленный пост
    await displayUpdatedPost(ctx, processedPost, "хэштеги");

  } catch (error) {
    logger.error({
      msg: 'Error in edit hashtags conversation',
      error: error instanceof Error ? error.message : String(error)
    });
    await ctx.reply(`❌ Произошла ошибка: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Парсит хэштеги из текста
 */
function parseHashtags(text: string): string[] {
  // Удаляем лишние пробелы и разделяем по запятой или пробелу
  const hashtags = text
    .split(/[,\s]+/)
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .map(tag => {
      // Добавляем # если его нет
      if (!tag.startsWith('#')) {
        return `#${tag}`;
      }
      return tag;
    })
    .filter((tag, index, array) => array.indexOf(tag) === index); // Убираем дубликаты

  return hashtags;
}

/**
 * Отображает обновленный пост после ручного редактирования
 */
async function displayUpdatedPost(ctx: Context, processedPost: any, editedPart: string) {
  // Добавляем сообщение об обновлении
  await ctx.reply(`✅ **${editedPart.charAt(0).toUpperCase() + editedPart.slice(1)} обновлен!**`);
  
  // Отображаем пост с помощью общей функции
  await displayPost(ctx, processedPost);
}
