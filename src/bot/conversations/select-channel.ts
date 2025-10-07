import { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { MyConversation } from "../../types/context.js";
import { logger } from "../../utils/logger.js";
import { supabaseService, Channel } from "../../services/supabase-service.js";

/**
 * Conversation для выбора канала из списка каналов пользователя
 */
export async function selectChannelConversation(
  conversation: MyConversation,
  ctx: Context
) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Не удалось получить ID пользователя");
      return;
    }

    // Получаем каналы пользователя из базы данных
    const userChannels = await getUserChannels(userId);
    logger.info({
      msg: 'User channels retrieved',
      userId,
      channelsCount: userChannels?.length || 0
    });

    if (!userChannels || userChannels.length === 0) {
      await ctx.reply(
        "📺 <b>У вас пока нет каналов</b>\n\n" +
        "Создайте свой первый канал, чтобы начать публиковать новости\n" +
        "💡 Используйте команду /add_channel для создания нового канала",
        { parse_mode: "HTML" }
      );
      return;
    }

    // Показываем список каналов
    await displayChannelsList(ctx, userChannels);

    // Создаем клавиатуру с каналами
    const channelsKeyboard = createChannelsKeyboard(userChannels);

    await ctx.reply(
      "📺 **Выберите канал для работы:**\n\n" +
      "Нажмите на кнопку с названием канала, который хотите использовать:",
      { 
        parse_mode: "Markdown",
        reply_markup: channelsKeyboard
      }
    );
    return;

  } catch (error) {
    logger.error({
      msg: 'Error in select channel conversation',
      error: error instanceof Error ? error.message : String(error)
    });
    await ctx.reply(`❌ Произошла ошибка: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Получает каналы пользователя из базы данных
 */
async function getUserChannels(userId: number): Promise<Channel[] | null> {
  const channels = await supabaseService.getUserChannels(userId);
  return channels;
}

/**
 * Отображает список каналов пользователя
 */
async function displayChannelsList(ctx: Context, channels: Channel[]): Promise<void> {
  let channelsList = "📺 **Ваши каналы:**\n\n";

  channels.forEach((channel, index) => {
    channelsList += `**${index + 1}.** ${channel.name}\n`;
    
    if (channel.description) {
      const shortDesc = channel.description.length > 100 
        ? channel.description.substring(0, 100) + "..."
        : channel.description;
      channelsList += `   📝 ${shortDesc}\n`;
    }
    
    if (channel.channel_username) {
      channelsList += `   🔗 ${channel.channel_username}\n`;
    }
    
    channelsList += `   🔐 Админ: ${channel.is_admin_verified ? '✅' : '⚠️'}\n`;
    channelsList += `   📊 Статус: ${channel.is_active ? '🟢 Активен' : '🔴 Неактивен'}\n\n`;
  });

  await ctx.reply(channelsList, { parse_mode: "Markdown" });
}

/**
 * Создает клавиатуру с каналами
 */
function createChannelsKeyboard(channels: Channel[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  channels.forEach((channel, index) => {
    const buttonText = `${index + 1}. ${channel.name}`;
    const callbackData = `select_channel_${channel.id}`;
    
    keyboard.text(buttonText, callbackData).row();
  });

  // Добавляем кнопки управления
  keyboard
    .text("➕ Добавить канал", "add_new_channel")
    .row()
    .text("❌ Отменить", "cancel_channel_selection");

  return keyboard;
}

/**
 * Отображает информацию о выбранном канале
 */
async function displaySelectedChannel(ctx: Context, channel: Channel): Promise<void> {
  let channelInfo = "✅ **Канал выбран!**\n\n";
  
  channelInfo += `📺 **Название:** ${channel.name}\n`;
  
  if (channel.description) {
    channelInfo += `📝 **Описание:** ${channel.description}\n`;
  }
  
  if (channel.channel_username) {
    channelInfo += `🔗 **Username:** ${channel.channel_username}\n`;
  }
  
  if (channel.channel_id) {
    channelInfo += `🆔 **ID канала:** ${channel.channel_id}\n`;
  }
  
  if (channel.sources && channel.sources.length > 0) {
    channelInfo += `📰 **Источники:** ${channel.sources.length} шт.\n`;
  }
  
  if (channel.ai_prompt) {
    channelInfo += `🤖 **Промпт ИИ:** Настроен\n`;
  }
  
  channelInfo += `🔐 **Права админа:** ${channel.is_admin_verified ? '✅ Проверены' : '⚠️ Не проверены'}\n`;
  channelInfo += `📊 **Статус:** ${channel.is_active ? '🟢 Активен' : '🔴 Неактивен'}\n\n`;
  
  channelInfo += "🎉 Теперь вы можете работать с этим каналом!";

  const keyboard = new InlineKeyboard()
    .text("🏠 Главное меню", "main_menu");

  await ctx.reply(channelInfo, { 
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
}

/**
 * Conversation для управления каналами (просмотр, редактирование, удаление)
 */
export async function manageChannelsConversation(
  conversation: MyConversation,
  ctx: Context
) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Не удалось получить ID пользователя");
      return;
    }

    // Получаем каналы пользователя
    const userChannels = await getUserChannels(userId);

    if (!userChannels || userChannels.length === 0) {
      await ctx.reply(
        "📺 **У вас пока нет каналов**\n\n" +
        "Создайте свой первый канал, чтобы начать публиковать новости!",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Показываем список каналов с кнопками управления
    await displayChannelsList(ctx, userChannels);

    const manageKeyboard = new InlineKeyboard()
      .text("➕ Добавить канал", "add_new_channel")
      .row()
      .text("✏️ Редактировать канал", "edit_channel")
      .row()
      .text("🗑️ Удалить канал", "delete_channel")
      .row()
      .text("🏠 Главное меню", "main_menu");

    await ctx.reply(
      "⚙️ **Управление каналами**\n\n" +
      "Выберите действие:",
      { 
        parse_mode: "Markdown",
        reply_markup: manageKeyboard
      }
    );

  } catch (error) {
    logger.error({
      msg: 'Error in manage channels conversation',
      error: error instanceof Error ? error.message : String(error)
    });
    await ctx.reply(`❌ Произошла ошибка: ${error instanceof Error ? error.message : String(error)}`);
  }
}
