import { logger } from "../../../utils/logger.js";
import { MyContext } from "../../../types/context.js";
import { channelService } from "../../../services/channel-service.js";
import axios from "axios";
import { N8N_WEBHOOK_PATHES } from "../../../utils/n8n_pathes.js";

export async function getPostsCommand(ctx: MyContext) {
  const userId = ctx.from?.id;

  if(!userId) {
    await ctx.reply('❌ Произошла ошибка при получении новостей:\nНе удалось получить ID пользователя');
    return;
  }

  try {
    // Получаем выбранный канал
    const selectedChannel = ctx.session.selectedChannel;
    if (!selectedChannel) {
      await ctx.reply('❌ Не выбран канал для работы. Используйте /select_channel для выбора канала.');
      return;
    }

    // Проверяем, есть ли уже активный запрос
    if (ctx.session.pendingNewsRequest?.status === 'pending' || ctx.session.pendingNewsRequest?.status === 'processing') {
      await ctx.reply('⏳ У вас уже есть активный запрос на получение новостей. Дождитесь его завершения.');
      return;
    }


    // Получаем URL для поиска новостей n8n для выбранного канала
    const n8nSearchUrl = N8N_WEBHOOK_PATHES.SEARCH

    // Отправляем начальное сообщение
    const loadingMessage = await ctx.reply(
      `🔍 Запускаю поиск новостей для канала **${selectedChannel.name}**...\n\n⏳ Это может занять некоторое время, я уведомлю вас о готовности.`
    );

    // Сохраняем информацию о запросе в сессии
    ctx.session.pendingNewsRequest = {
      requestId: `search_${userId}_${selectedChannel.id}`,
      userId,
      startTime: Date.now(),
      status: 'pending',
      messageId: loadingMessage.message_id
    };

    logger.info({
      msg: 'Starting news search for channel',
      userId,
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      messageId: loadingMessage.message_id,
      searchUrl: n8nSearchUrl
    });

    // Получаем список URLs для поиска новостей
    const newsUrls = selectedChannel.sources;
    
    logger.info({
      msg: 'Using news URLs for search',
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      newsUrlsCount: newsUrls.length,
      newsUrls: newsUrls
    });
    
    const searchResponse = await axios.post(n8nSearchUrl, {
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      userId: userId,
      action: 'search_news',
      newsUrls: newsUrls
    }, {
      timeout: 30000, // 30 секунд таймаут
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FintechBot/1.0'
      }
    });

    // Обновляем статус
    ctx.session.pendingNewsRequest.status = 'processing';

    logger.info({
      msg: 'N8N search flow triggered successfully for channel',
      userId,
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      searchStatus: searchResponse.status,
      searchData: searchResponse.data,
    });

    // Обновляем сообщение о том, что поиск запущен
    await ctx.api.editMessageText(
      userId,
      loadingMessage.message_id,
      `🔍 **Поиск новостей запущен для канала ${selectedChannel.name}!**\n\n⏳ N8N выполняет поиск и анализ новостей\n🔔 Вы получите уведомление, когда всё будет готово\n\n⏱️ Обычно это занимает 1-3 минуты`,
      { parse_mode: "Markdown" }
    );

  } catch (error) {
    // Очищаем состояние при ошибке
    if (ctx.session.pendingNewsRequest) {
      delete ctx.session.pendingNewsRequest;
    }

    logger.error({
      msg: 'get_posts command error',
      userId,
      channelId: ctx.session.selectedChannel?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    await ctx.reply(
      `❌ Произошла ошибка при запуске поиска новостей:\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}



/**
 * Отправляет сообщения пользователю
 */
async function sendMessagesToUser(ctx: MyContext, messages: any[]) {
  for (const [index, message] of messages.entries()) {
    try {
      await ctx.reply(message.telegramMessage, {
        parse_mode: 'HTML',
        link_preview_options: {
          is_disabled: false,
        }
      });

      // Задержка между сообщениями
      if (index < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      logger.error({
        msg: 'failed to send message to user',
        userId: ctx.from?.id,
        messageNumber: message.messageNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
