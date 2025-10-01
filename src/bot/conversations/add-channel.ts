import { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { MyConversation } from "../../types/context.js";
import { logger } from "../../utils/logger.js";
import { supabaseService, Channel } from "../../services/supabase-service.js";

/**
 * Conversation для добавления нового канала
 */
export async function addChannelConversation(
  conversation: MyConversation,
  ctx: Context
) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Не удалось получить ID пользователя");
      return;
    }

    await ctx.reply(
      "📺 **Добавление нового канала**\n\n" +
        "Давайте создадим новый канал для публикации новостей!\n\n" +
        "✍️ Введите название канала:",
      { parse_mode: "Markdown" }
    );
    // Шаг 1: Название канала
    const name = await getChannelName(conversation, ctx);
    if (!name) return;

    // Шаг 2: Описание канала
    const description = await getChannelDescription(conversation, ctx);

    // Шаг 3: Username канала
    const channelUsername = await getChannelUsername(conversation, ctx);
    if (!channelUsername) return;

    // Шаг 4: ID канала
    const channelId = await getChannelId(conversation, ctx);
    if (!channelId) return;

    // Шаг 5: Источники новостей
    const sources = await getNewsSources(conversation, ctx);
    if (!sources) return;

    // Шаг 6: Промпт для ИИ
    const aiPrompt = await getAiPrompt(conversation, ctx);
    if (!aiPrompt) return;

    // Шаг 7: Проверка прав админа
    const isAdminVerified = await checkAdminRights(
      conversation,
      ctx,
      channelUsername
    );
    if (isAdminVerified === null) return;

    // Создаем объект канала
    const channelData: Omit<Channel, "id" | "created_at" | "updated_at"> = {
      user_id: userId,
      name,
      description: description || undefined,
      sources,
      channel_username: channelUsername,
      channel_id: channelId,
      is_admin_verified: isAdminVerified,
      ai_prompt: aiPrompt,
      is_active: true,
    };

    // Сохраняем канал в базу данных
    const savedChannel = await saveChannelToDatabase(channelData);

    // Показываем результат
    await displayChannelSummary(ctx, savedChannel);

    logger.info({
      msg: "Channel added successfully",
      userId,
      channelName: name,
      channelId: channelData.channel_id,
    });
  } catch (error) {
    logger.error({
      msg: "Error in add channel conversation",
      error: error instanceof Error ? error.message : String(error),
    });
    await ctx.reply(
      `❌ Произошла ошибка: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Сохраняет канал в базу данных
 */
async function saveChannelToDatabase(
  channelData: Omit<Channel, "id" | "created_at" | "updated_at">
): Promise<Channel> {
  const savedChannel = await supabaseService.saveChannel(channelData);

  if (!savedChannel) {
    throw new Error("Не удалось сохранить канал в базу данных");
  }

  return savedChannel;
}

/**
 * Отображает сводку созданного канала
 */
async function displayChannelSummary(
  ctx: Context,
  channel: Channel
): Promise<void> {
  let summary = "✅ **Канал успешно создан!**\n\n";

  summary += `📺 **Название:** ${channel.name}\n`;

  if (channel.description) {
    summary += `📝 **Описание:** ${channel.description}\n`;
  }

  if (channel.channel_username) {
    summary += `🔗 **Username:** @${channel.channel_username}\n`;
  }

  if (channel.channel_id) {
    summary += `🆔 **ID канала:** ${channel.channel_id}\n`;
  }

  if (channel.sources.length > 0) {
    summary += `📰 **Источники:** ${channel.sources.length} шт.\n`;
  }

  if (channel.ai_prompt) {
    summary += `🤖 **Промпт ИИ:** Настроен\n`;
  }

  summary += `🔐 **Права админа:** ${
    channel.is_admin_verified ? "✅ Проверены" : "⚠️ Не проверены"
  }\n`;
  summary += `📊 **Статус:** ${
    channel.is_active ? "🟢 Активен" : "🔴 Неактивен"
  }\n\n`;

  summary +=
    "🎉 Теперь вы можете использовать этот канал для публикации новостей!";

  const keyboard = new InlineKeyboard()
    .text("📋 Мои каналы", "my_channels")
    .row()
    .text("🏠 Главное меню", "main_menu");

  await ctx.reply(summary, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

/**
 * Получает название канала с ретраями
 */
async function getChannelName(
  conversation: MyConversation,
  ctx: Context
): Promise<string | null> {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const { message } = await conversation.waitFor("message:text");
      const name = message.text.trim();

      if (name && name.length >= 2) {
        return name;
      }

      attempts++;
      if (attempts < maxRetries) {
        await ctx.reply(
          `❌ Название канала должно содержать минимум 2 символа.\n` +
            `Попытка ${attempts + 1} из ${maxRetries}:\n\n` +
            `✍️ Введите название канала:`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("conversation")) {
        return null; // Пользователь отменил
      }
      attempts++;
    }
  }

  await ctx.reply(
    "❌ Превышено максимальное количество попыток. Создание канала отменено."
  );
  return null;
}

/**
 * Получает описание канала с ретраями
 */
async function getChannelDescription(
  conversation: MyConversation,
  ctx: Context
): Promise<string | null> {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await ctx.reply(
        "📝 **Описание канала**\n\n" +
          "Введите краткое описание канала и его тематики:\n" +
          "💡 Например: 'Новости о финтехе и криптовалютах'\n" +
          "❌ Для отмены отправьте /cancel",
        { parse_mode: "Markdown" }
      );

      const { message } = await conversation.waitFor("message:text");
      const description = message.text.trim();

      if (description && description.length >= 10) {
        return description;
      }

      attempts++;
      if (attempts < maxRetries) {
        await ctx.reply(
          `❌ Описание должно содержать минимум 10 символов.\n` +
            `Попытка ${attempts + 1} из ${maxRetries}:\n\n` +
            `📝 Введите описание канала:`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("conversation")) {
        return null; // Пользователь отменил
      }
      attempts++;
    }
  }

  await ctx.reply(
    "❌ Превышено максимальное количество попыток. Создание канала отменено."
  );
  return null;
}

/**
 * Получает username канала с ретраями
 */
async function getChannelUsername(
  conversation: MyConversation,
  ctx: Context
): Promise<string | undefined | null> {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await ctx.reply(
        "🔗 *Username канала*\n\n" +
          "Введите username канала в Telegram (например: @mychannel):\n" +
          "💡 Если у канала нет username, отправьте 'нет'\n" +
          "❌ Для отмены отправьте /cancel",
        { parse_mode: "Markdown" }
      );

      const { message } = await conversation.waitFor("message:text");
      let username = message.text.trim().toLowerCase();

      if (username === "нет" || username === "no" || username === "") {
        return undefined;
      }
      console.log(username, "username");

      // Проверяем формат username
      if (username && /^@[a-zA-Z0-9_]{5,32}$/.test(username)) {
        return username;
      }

      attempts++;
      if (attempts < maxRetries) {
        await ctx.reply(
          `❌ Username должен содержать 5-32 символа (буквы, цифры, подчеркивания).\n` +
            `Попытка ${attempts + 1} из ${maxRetries}:\n\n` +
            `🔗 Введите username канала или 'нет':`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("conversation")) {
        return null; // Пользователь отменил
      }
      attempts++;
    }
  }

  await ctx.reply(
    "❌ Превышено максимальное количество попыток. Создание канала отменено."
  );
  return null;
}

/**
 * Получает ID канала с ретраями
 */
async function getChannelId(
  conversation: MyConversation,
  ctx: Context
): Promise<number | null> {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await ctx.reply(
        "🆔 **ID канала**\n\n" +
          "Введите ID канала в Telegram (например: -1001234567890):\n" +
          "💡 ID канала можно получить, переслав сообщение из канала боту @userinfobot\n" +
          "❌ Для отмены отправьте /cancel",
        { parse_mode: "Markdown" }
      );

      const { message } = await conversation.waitFor("message:text");
      const channelIdText = message.text.trim();
      const channelId = parseInt(channelIdText, 10);

      if (!isNaN(channelId) && channelId < 0 && channelIdText.length >= 10) {
        return channelId;
      }

      attempts++;
      if (attempts < maxRetries) {
        await ctx.reply(
          `❌ ID канала должен быть отрицательным числом (минимум 10 цифр).\n` +
            `Попытка ${attempts + 1} из ${maxRetries}:\n\n` +
            `🆔 Введите ID канала:`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("conversation")) {
        return null; // Пользователь отменил
      }
      attempts++;
    }
  }

  await ctx.reply(
    "❌ Превышено максимальное количество попыток. Создание канала отменено."
  );
  return null;
}

/**
 * Получает источники новостей с ретраями
 */
async function getNewsSources(
  conversation: MyConversation,
  ctx: Context
): Promise<string[] | null> {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await ctx.reply(
        "📰 **Источники новостей**\n\n" +
          "Введите ссылки на источники новостей через запятую:\n" +
          "💡 Например: https://example1.com, https://example2.com\n" +
          "❌ Для отмены отправьте /cancel",
        { parse_mode: "Markdown" }
      );

      const { message } = await conversation.waitFor("message:text");
      const sourcesText = message.text.trim();
      const sources = sourcesText
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Проверяем, что все источники - валидные URL
      const validSources = sources.filter((source) => {
        try {
          new URL(source);
          return true;
        } catch {
          return false;
        }
      });

      if (validSources.length >= 1) {
        return validSources;
      }

      attempts++;
      if (attempts < maxRetries) {
        await ctx.reply(
          `❌ Нужно указать минимум 1 валидный URL источника новостей.\n` +
            `Попытка ${attempts + 1} из ${maxRetries}:\n\n` +
            `📰 Введите ссылки на источники:`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("conversation")) {
        return null; // Пользователь отменил
      }
      attempts++;
    }
  }

  await ctx.reply(
    "❌ Превышено максимальное количество попыток. Создание канала отменено."
  );
  return null;
}

/**
 * Получает промпт для ИИ с ретраями
 */
async function getAiPrompt(
  conversation: MyConversation,
  ctx: Context
): Promise<string | null> {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await ctx.reply(
        "🤖 **Промпт для ИИ**\n\n" +
          "Введите промпт для генерации постов ИИ:\n" +
          "💡 Например: 'Создавай посты в стиле новостного канала о финтехе'\n" +
          "❌ Для отмены отправьте /cancel",
        { parse_mode: "Markdown" }
      );

      const { message } = await conversation.waitFor("message:text");
      const aiPrompt = message.text.trim();

      if (aiPrompt && aiPrompt.length >= 20) {
        return aiPrompt;
      }

      attempts++;
      if (attempts < maxRetries) {
        await ctx.reply(
          `❌ Промпт должен содержать минимум 20 символов.\n` +
            `Попытка ${attempts + 1} из ${maxRetries}:\n\n` +
            `🤖 Введите промпт для ИИ:`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("conversation")) {
        return null; // Пользователь отменил
      }
      attempts++;
    }
  }

  await ctx.reply(
    "❌ Превышено максимальное количество попыток. Создание канала отменено."
  );
  return null;
}

/**
 * Проверяет права администратора с ретраями
 */
async function checkAdminRights(
  conversation: MyConversation,
  ctx: Context,
  channelUsername: string
): Promise<boolean | null> {
  const checkAdminKeyboard = new InlineKeyboard().text(
    "✅ Проверить права",
    "check_admin_rights"
  );
  const me = await ctx.api.getMe();

  logger.info({
    msg: "Starting admin rights check",
    channelUsername,
    botId: me.id,
  });

  await ctx.reply(
    "🔐 **Проверка прав админа**\n\n" +
      "Нужно проверить, есть ли у бота права администратора в канале.\n" +
      "Добавьте бота в канал как администратора и нажмите кнопку для проверки:\n" +
      "❌ Для отмены отправьте /cancel",
    { parse_mode: "Markdown", reply_markup: checkAdminKeyboard }
  );

  try {
    // Ждем нажатия кнопки или команды отмены
    await conversation.waitForCallbackQuery("check_admin_rights", {
      otherwise: (ctx) =>
        ctx.reply("попробуйте еще раз", {
          reply_markup: checkAdminKeyboard,
        }),
    });
    // Добавляем @ если его нет
    const chatIdentifier = channelUsername.startsWith("@")
      ? channelUsername
      : `@${channelUsername}`;
    const chatMember = await ctx.api.getChatMember(chatIdentifier, me.id);
    if (chatMember.status === "administrator") {
      await ctx.reply("✅ Права администратора проверены!", {
        parse_mode: "Markdown",
      });
      return true;
    }

    logger.info({
      msg: "callbackQuery",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("conversation")) {
      return null; // Пользователь отменил
    }

    // Логируем ошибку для отладки
    logger.error({
      msg: "Error checking admin rights",
      error: error instanceof Error ? error.message : String(error),
      channelUsername,
      chatIdentifier: channelUsername.startsWith("@")
        ? channelUsername
        : `@${channelUsername}`,
    });
  }

  return false;
}
