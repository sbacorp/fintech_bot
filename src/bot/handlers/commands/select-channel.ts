import { MyContext } from "../../../types/context.js";
import { logger } from "../../../utils/logger.js";
import { selectChannelConversation } from "../../conversations/select-channel.js";
import { supabaseService } from "../../../services/supabase-service.js";
import { InlineKeyboard } from "grammy";

export async function selectChannelCommand(ctx: MyContext) {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply('❌ Произошла ошибка при получении ID пользователя');
    return;
  }

  try {
    logger.info({
      msg: 'Select channel command started',
      userId
    });

    // Запускаем conversation для выбора канала
    await ctx.conversation.enter("select-channel");

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
    const channel = await supabaseService.getChannelById(channelId);

    if (!channel || !channel.is_active) {
      await ctx.answerCallbackQuery('❌ Канал не найден или неактивен');
      return;
    }

    // Проверяем, что канал принадлежит пользователю
    if (channel.user_id !== userId) {
      await ctx.answerCallbackQuery('❌ У вас нет доступа к этому каналу');
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
    const channels = await supabaseService.getUserChannels(userId);
    const keyboard = new InlineKeyboard();

    channels.forEach(ch => {
      const isSelected = ch.id === channel.id;
      keyboard.text(
        `${isSelected ? '✅' : '📢'} ${ch.name}`,
        `select_channel_${ch.id}`
      ).row();
    });

    keyboard
      .text("➕ Добавить канал", "add_new_channel")
      .row()
      .text("🏠 Главное меню", "main_menu");

    const message = `🎯 **Канал выбран!**\n\n` +
      `📢 **${channel.name}**\n` +
      `${channel.description || 'Без описания'}\n\n` +
      `Теперь все команды будут работать с этим каналом.\n` +
      `Вы можете выбрать другой канал в любое время.`;

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
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

