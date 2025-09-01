import { MyContext } from "../../../types/context.js";
import { InlineKeyboard } from "grammy";
import { channelService } from "../../../services/channel-service.js";
import { logger } from "../../../utils/logger.js";
import { Channel } from "../../../config/index.js";

export async function selectChannelCommand(ctx: MyContext) {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply('❌ Произошла ошибка при получении ID пользователя');
    return;
  }

  try {
    const channels = channelService.getAllChannels();

    if (channels.length === 0) {
      await ctx.reply('❌ Нет доступных каналов для выбора');
      return;
    }

    if (channels.length === 1) {
      // Если только один канал, автоматически выбираем его
      const channel = channels[0];
      ctx.session.selectedChannel = channel as Channel;

      await ctx.reply(
        `✅ Канал выбран автоматически:\n\n` +
        `📢 **${channel?.name}**\n` +
        `${channel?.description}\n\n` +
        `Теперь вы можете использовать другие команды для работы с этим каналом.`
      );
      return;
    }

    // Создаем клавиатуру с каналами
    const keyboard = new InlineKeyboard();

    channels.forEach(channel => {
      keyboard.text(
        `📢 ${channel.name}`,
        `select_channel_${channel.id}`
      ).row();
    });

    const currentChannel = ctx.session.selectedChannel;
    const currentChannelText = currentChannel
      ? `Текущий канал: **${currentChannel.name}**`
      : 'Канал не выбран';

    const message = `🎯 **Выбор канала для модерации**\n\n` +
      `${currentChannelText}\n\n` +
      `Выберите канал, с которым вы хотите работать:\n\n` +
      channels.map((channel, index) =>
        `${index + 1}. **${channel.name}**\n   ${channel.description}`
      ).join('\n\n');

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });

  } catch (error) {
    logger.error({
      msg: 'select_channel command error',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    await ctx.reply(
      `❌ Произошла ошибка при выборе канала:\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleChannelSelection(ctx: MyContext) {
  const userId = ctx.from?.id;
  const callbackData = ctx.callbackQuery?.data;

  if (!userId || !callbackData) {
    await ctx.answerCallbackQuery('❌ Произошла ошибка');
    return;
  }

  try {
    // Извлекаем ID канала из callback data
    const channelId = callbackData.replace('select_channel_', '');
    const channel = channelService.getChannelById(channelId);

    if (!channel) {
      await ctx.answerCallbackQuery('❌ Канал не найден');
      return;
    }

    // Сохраняем выбранный канал в сессии
    ctx.session.selectedChannel = channel;

    logger.info({
      msg: 'Channel selected by user',
      userId,
      channelId: channel.id,
      channelName: channel.name
    });

    // Обновляем сообщение
    const channels = channelService.getAllChannels();
    const keyboard = new InlineKeyboard();

    channels.forEach(ch => {
      const isSelected = ch.id === channel.id;
      keyboard.text(
        `${isSelected ? '✅' : '📢'} ${ch.name}`,
        `select_channel_${ch.id}`
      ).row();
    });

    const message = `🎯 **Канал выбран!**\n\n` +
      `📢 **${channel.name}**\n` +
      `${channel.description}\n\n` +
      `Теперь все команды будут работать с этим каналом.\n` +
      `Вы можете выбрать другой канал в любое время.`;

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
    });

    await ctx.answerCallbackQuery(`✅ Выбран канал: ${channel.name}`);

  } catch (error) {
    logger.error({
      msg: 'Channel selection callback error',
      userId,
      callbackData,
      error: error instanceof Error ? error.message : String(error),
    });

    await ctx.answerCallbackQuery('❌ Произошла ошибка при выборе канала');
  }
}

