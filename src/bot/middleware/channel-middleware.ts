
import { InlineKeyboard } from "grammy";
import { logger } from "../../utils/logger.js";
import { MyContext } from "../../types/context.js";
import { channelService } from "../../services/channel-service.js";
import { Channel } from "../../config/index.js";

/**
 * Миддлвар для проверки выбранного канала
 * Если канал не выбран, предлагает выбрать его
 */
export function requireSelectedChannel(): (ctx: MyContext, next: () => Promise<void>) => Promise<void> {
  return async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
    const userId = ctx.from?.id;

    if (!userId) {
      return next();
    }

    // Проверяем, выбран ли канал
    if (!ctx.session.selectedChannel) {
      const channels = channelService.getAllChannels();

      if (channels.length === 0) {
        await ctx.reply('❌ Нет доступных каналов для работы');
        return;
      }

      if (channels.length === 1) {
        // Автоматически выбираем единственный канал
        ctx.session.selectedChannel = channels[0] as Channel;
        logger.info({
          msg: 'Auto-selected single channel',
          userId,
          channelId: channels[0]?.id || ''
        });
      } else {
        // Предлагаем выбрать канал
        const keyboard = new InlineKeyboard();

        channels.forEach(channel => {
          keyboard.text(
            `📢 ${channel.name}`,
            `select_channel_${channel.id}`
          ).row();
        });

        const message = `🎯 **Необходимо выбрать канал**\n\n` +
          `Для работы с ботом нужно выбрать канал для модерации:\n\n` +
          channels.map((channel, index) =>
            `${index + 1}. **${channel.name}**\n   ${channel.description}`
          ).join('\n\n') +
          `\n\nВыберите канал для продолжения работы.`;

        await ctx.reply(message, {
          parse_mode: "Markdown",
          reply_markup: keyboard
        });
        return;
      }
    }

    // Проверяем, что выбранный канал все еще существует
    if (ctx.session.selectedChannel) {
      const currentChannel = channelService.getChannelById(ctx.session.selectedChannel.id);
      if (!currentChannel) {
        logger.warn({
          msg: 'Selected channel no longer exists',
          userId,
          channelId: ctx.session.selectedChannel.id
        });
        ctx.session.selectedChannel = null;

        // Рекурсивно вызываем миддлвар для выбора нового канала
        return requireSelectedChannel()(ctx, next);
      }
    }

    return next();
  };
}

/**
 * Миддлвар для логирования текущего канала
 */
export function logCurrentChannel() {
  return async (ctx: MyContext, next: () => Promise<void>) => {
    const userId = ctx.from?.id;
    const channel = ctx.session.selectedChannel;

    if (userId && channel) {
      logger.debug({
        msg: 'Request with selected channel',
        userId,
        channelId: channel.id,
        channelName: channel.name,
        command: ctx.message?.text || ctx.callbackQuery?.data
      });
    }

    return next();
  };
}

