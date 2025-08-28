import { InlineKeyboard } from "grammy";
import axios from "axios";
import { logger } from "../../../utils/logger.js";
import { MyContext } from "../../../types/context.js";
import { channelService } from "../../../services/channel-service.js";
import { 
  getUserProcessedPost, 
  setUserProcessedPost, 
  clearUserProcessedPost 
} from "../../../services/webhook.js";
import { updatePostMessage } from "../../../utils/post-display.js";

/**
 * Обработчик для кнопки "Перегенерировать заголовок"
 */
export async function regenerateTitleHandler(ctx: MyContext) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery("❌ Не удалось получить ID пользователя");
      return;
    }
    const processedPost = await getUserProcessedPost(userId);

    if (!processedPost) {
      await ctx.answerCallbackQuery("❌ Нет данных для перегенерации");
      return;
    }

    // Получаем выбранный канал
    const selectedChannel = ctx.session.selectedChannel;
    if (!selectedChannel) {
      await ctx.answerCallbackQuery("❌ Не выбран канал для работы");
      return;
    }

    // Проверяем поддержку регенерации для канала
    if (!channelService.supportsRegenerate(selectedChannel)) {
      await ctx.answerCallbackQuery("❌ Канал не поддерживает регенерацию постов");
      return;
    }

    const regenerateUrl = channelService.getRegenerateUrl(selectedChannel);
    if (!regenerateUrl) {
      await ctx.answerCallbackQuery("❌ URL для регенерации не настроен для этого канала");
      return;
    }

    await ctx.answerCallbackQuery("🔄 Перегенерирую заголовок...");

    // Запрос на перегенерацию заголовка через N8N флоу выбранного канала
    const response = await axios.post(
      regenerateUrl,
      {
        action: 'regenerate_title',
        link: processedPost.original_link || '#',
        current_title: processedPost.trigger_title || processedPost.original_title,
        current_text: processedPost.post_text,
        channelId: selectedChannel.id,
        channelName: selectedChannel.name
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log(response.data, 'N8N Response');
    
    // Парсим ответ от N8N (format: {"output": "{\"new_title\": \"...\"}", "isValidJson": true})
    let parsedData = null;
    if (response.data && response.data.output) {
      try {
        parsedData = JSON.parse(response.data.output);
        console.log(parsedData, 'Parsed N8N Data');
      } catch (error) {
        console.error('Failed to parse N8N output:', error);
      }
    }
    
    if (parsedData && parsedData.new_title) {
      // Увеличиваем счетчик регенераций для заголовка
      if (!processedPost._regeneration_count) {
        processedPost._regeneration_count = { title: 0, text: 0 };
      }
      processedPost._regeneration_count.title++;

      // Обновляем заголовок в глобальном хранилище
      processedPost.trigger_title = parsedData.new_title;
      await setUserProcessedPost(userId, processedPost);
      
      // Обновляем сообщение с новым заголовком
      await updatePostMessageLocal(ctx, processedPost);
      
      logger.info({
        msg: 'Title regenerated successfully',
        new_title: parsedData.new_title,
        regeneration_count: processedPost._regeneration_count.title
      });
    } else {
      await ctx.reply("❌ Не удалось перегенерировать заголовок");
    }
    
  } catch (error) {
    logger.error({
      msg: 'Failed to regenerate title',
      error: error instanceof Error ? error.message : String(error)
    });
    
    await ctx.reply(`❌ Ошибка при перегенерации заголовка: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Обработчик для кнопки "Перегенерировать описание"
 */
export async function regenerateDescriptionHandler(ctx: MyContext) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery("❌ Не удалось получить ID пользователя");
      return;
    }

    const processedPost = await getUserProcessedPost(userId);

    if (!processedPost) {
      await ctx.answerCallbackQuery("❌ Нет данных для перегенерации");
      return;
    }

    // Получаем выбранный канал
    const selectedChannel = ctx.session.selectedChannel;
    if (!selectedChannel) {
      await ctx.answerCallbackQuery("❌ Не выбран канал для работы");
      return;
    }

    // Проверяем поддержку регенерации для канала
    if (!channelService.supportsRegenerate(selectedChannel)) {
      await ctx.answerCallbackQuery("❌ Канал не поддерживает регенерацию постов");
      return;
    }

    const regenerateUrl = channelService.getRegenerateUrl(selectedChannel);
    if (!regenerateUrl) {
      await ctx.answerCallbackQuery("❌ URL для регенерации не настроен для этого канала");
      return;
    }

    await ctx.answerCallbackQuery("🔄 Перегенерирую описание...");

    // Запрос на перегенерацию описания через N8N флоу выбранного канала
    const response = await axios.post(
      regenerateUrl,
      {
        action: 'regenerate_text',
        link: processedPost.original_link || '#',
        current_title: processedPost.trigger_title || processedPost.original_title,
        current_text: processedPost.post_text,
        channelId: selectedChannel.id,
        channelName: selectedChannel.name
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log(response.data, 'N8N Response for text');
    
    // Парсим ответ от N8N (format: {"output": "{\"new_text\": \"...\"}", "isValidJson": true})
    let parsedData = null;
    if (response.data && response.data.output) {
      try {
        parsedData = JSON.parse(response.data.output);
        console.log(parsedData, 'Parsed N8N Text Data');
      } catch (error) {
        console.error('Failed to parse N8N output for text:', error);
      }
    }

    if (parsedData && parsedData.new_text) {
      // Увеличиваем счетчик регенераций для текста
      if (!processedPost._regeneration_count) {
        processedPost._regeneration_count = { title: 0, text: 0 };
      }
      processedPost._regeneration_count.text++;

      // Обновляем описание в глобальном хранилище
      processedPost.post_text = parsedData.new_text;
      setUserProcessedPost(userId, processedPost);
      
      // Обновляем сообщение с новым описанием
      await updatePostMessageLocal(ctx, processedPost);
      
      logger.info({
        msg: 'Description regenerated successfully',
        new_description: parsedData.new_text.substring(0, 100) + '...',
        regeneration_count: processedPost._regeneration_count.text
      });
    } else {
      await ctx.reply("❌ Не удалось перегенерировать описание");
    }
    
  } catch (error) {
    logger.error({
      msg: 'Failed to regenerate description',
      error: error instanceof Error ? error.message : String(error)
    });
    
    await ctx.reply(`❌ Ошибка при перегенерации описания: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Обработчик для кнопки "Опубликовать"
 */
export async function publishPostHandler(ctx: MyContext) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery("❌ Не удалось получить ID пользователя");
      return;
    }

    const processedPost = await getUserProcessedPost(userId);
    
    if (!processedPost) {
      await ctx.answerCallbackQuery("❌ Нет данных для публикации");
      return;
    }

    await ctx.answerCallbackQuery("📤 Публикую пост...");

    // Публикуем пост напрямую через бота в канал
    const success = await publishPostToChannel(ctx, processedPost);

    if (success) {
      await ctx.editMessageText(
        "✅ **Пост успешно опубликован!**\n\n" +
        `📰 **Заголовок:** ${processedPost.trigger_title}\n` +
        `📢 **Канал:** ${ctx.session.selectedChannel?.name}\n\n` +
        "🎉 Новость отправлена в канал!",
        { parse_mode: "Markdown" }
      );
      
      // Очищаем данные из глобального хранилища
      await clearUserProcessedPost(userId);
      
      // Очищаем pendingNewsRequest после успешной публикации
      if (ctx.session.pendingNewsRequest) {
        delete ctx.session.pendingNewsRequest;
        logger.info({
          msg: 'Cleared pendingNewsRequest after successful publication',
          userId
        });
      }
      
      logger.info({
        msg: 'Post published successfully to channel',
        title: processedPost.trigger_title,
      });
    } else {
      await ctx.reply("❌ Не удалось опубликовать пост в канал");
    }
    
  } catch (error) {
    logger.error({
      msg: 'Failed to publish post to channel',
      error: error instanceof Error ? error.message : String(error)
    });
    
    await ctx.reply(`❌ Ошибка при публикации поста: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Обработчик для кнопки "Отменить"
 */
export async function cancelPostHandler(ctx: MyContext) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery("❌ Не удалось получить ID пользователя");
      return;
    }
    
    // Получаем данные поста перед удалением для сбора статистики
    const processedPost = await getUserProcessedPost(userId);
    
    if (processedPost) {
      logger.info({
        msg: 'Post processing cancelled',
        userId: userId,
      });
    }
    
    await ctx.answerCallbackQuery("❌ Пост отменен");
    
    await ctx.editMessageText(
      "❌ **Обработка поста отменена**\n\n" +
      "Данные удалены из хранилища.",
      { parse_mode: "Markdown" }
    );
    
    // Очищаем данные из глобального хранилища
    await clearUserProcessedPost(userId);
    
    // Очищаем pendingNewsRequest после отмены
    if (ctx.session.pendingNewsRequest) {
      delete ctx.session.pendingNewsRequest;
      logger.info({
        msg: 'Cleared pendingNewsRequest after cancellation',
        userId
      });
    }
    
  } catch (error) {
    logger.error({
      msg: 'Failed to cancel post',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Обновляет сообщение с постом (локальная функция для совместимости)
 */
async function updatePostMessageLocal(ctx: MyContext, processedPost: any) {
  await updatePostMessage(ctx, processedPost);
}

/**
 * Публикует пост в канал напрямую через бота
 */
async function publishPostToChannel(ctx: MyContext, processedPost: any): Promise<boolean> {
  try {
    // Получаем выбранный канал
    const selectedChannel = ctx.session.selectedChannel;
    if (!selectedChannel) {
      logger.error({
        msg: 'No channel selected for publishing',
        userId: ctx.from?.id
      });
      return false;
    }

    const channelId = channelService.getChannelId(selectedChannel);

    const {
      trigger_title,
      post_text,
      hashtags,
      main_post_image
    } = processedPost;

    // Формируем финальный текст поста
    let finalPostText = `${trigger_title}\n\n${post_text}`;
    
    if (hashtags && hashtags.length > 0) {
      finalPostText += `\n\n${hashtags.join(' ')}`;
    }

    // Отправляем пост в канал
    if (main_post_image) {
      try {
        // Если есть изображение, отправляем как фото с подписью
        await ctx.api.sendPhoto(channelId, main_post_image, {
          caption: finalPostText,
          parse_mode: "HTML"
        });
        
        logger.info({
          msg: 'Post published with image successfully',
          channelId,
          channelName: selectedChannel.name,
          title: trigger_title,
          imageUrl: main_post_image
        });
        
      } catch (photoError) {
        logger.warn({
          msg: 'Failed to send post with image, trying without image',
          channelId,
          channelName: selectedChannel.name,
          title: trigger_title,
          imageUrl: main_post_image,
          error: photoError instanceof Error ? photoError.message : String(photoError)
        });
        
        // Fallback: отправляем без изображения
        await ctx.api.sendMessage(channelId, finalPostText, {
          parse_mode: "HTML",
          link_preview_options: {
            is_disabled: false
          }
        });
        
        logger.info({
          msg: 'Post published without image (fallback)',
          channelId,
          channelName: selectedChannel.name,
          title: trigger_title
        });
      }
    } else {
      // Если нет изображения, отправляем как обычное сообщение
      await ctx.api.sendMessage(channelId, finalPostText, {
        parse_mode: "HTML",
        link_preview_options: {
          is_disabled: false
        }
      });
      
      logger.info({
        msg: 'Post published without image',
        channelId,
        channelName: selectedChannel.name,
        title: trigger_title
      });
    }

    logger.info({
      msg: 'Post published to channel successfully',
      channelId,
      channelName: selectedChannel.name,
      title: trigger_title
    });

    return true;

  } catch (error) {
    logger.error({
      msg: 'Failed to publish post to channel',
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Обработчик для кнопки "Изменить хэштеги"
 */
export async function editHashtagsHandler(ctx: MyContext) {
  try {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("edit-hashtags");
  } catch (error) {
    logger.error({
      msg: 'Error in editHashtagsHandler',
      userId: ctx.from?.id,
      error: error instanceof Error ? error.message : String(error)
    });

    await ctx.answerCallbackQuery("❌ Произошла ошибка при редактировании хэштегов");
  }
}
