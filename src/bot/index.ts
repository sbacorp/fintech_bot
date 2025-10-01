import { autoRetry } from "@grammyjs/auto-retry";
import { session, Bot as TelegramBot } from "grammy";
import { botAdminFeature, welcomeFeature } from "./features/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { getPostsCommand } from "./handlers/commands/get-posts.js";
import { viewPostsCommand } from "./handlers/commands/view-posts.js";
// import {
//   testPostCommand,
//   testPostWithImageCommand,
//   checkChannelCommand
// } from "./handlers/commands/test-post.js";
import {
  clearStateCommand,
  statusCommand,
} from "./handlers/commands/clear-state.js";
import {
  selectChannelCommand,
  handleChannelSelection,
} from "./handlers/commands/select-channel.js";
import { addChannelCommand } from "./handlers/commands/add-channel.js";
import { cronTestCommand } from "./handlers/commands/cron-test.js";
import { createSupabaseStorageAdapter } from "../services/supabase-storage-adapter.js";

import { MyContext, SessionData } from "../types/context.js";
import { conversations, createConversation } from "@grammyjs/conversations";
import { newsSelectionConversation } from "./conversations/news-selection.js";
import {
  editTitleConversation,
  editTextConversation,
  editHashtagsConversation,
} from "./conversations/manual-edit.js";
import { addChannelConversation } from "./conversations/add-channel.js";
import { selectChannelConversation } from "./conversations/select-channel.js";
import {
  regenerateTitleHandler,
  regenerateDescriptionHandler,
  publishPostHandler,
  cancelPostHandler,
  editHashtagsHandler,
} from "./handlers/callbacks/news-actions.js";
import {
  runCronNowHandler,
  cronStatusHandler,
  testNotificationHandler,
} from "./handlers/callbacks/cron-actions.js";

export function createBot(token: string, scheduler?: any) {
  const bot = new TelegramBot<MyContext>(token);

  // Добавляем scheduler в контекст бота
  if (scheduler) {
    bot.use((ctx, next) => {
      (ctx as any).scheduler = scheduler;
      return next();
    });
  }

  // Создаем storage адаптер для Supabase
  const storage = createSupabaseStorageAdapter("grammy_sessions");

  // Создаем конфигурацию сессии с Supabase storage
  const sessionConfig = {
    initial: (): SessionData => ({
      isAdmin: true,
    }),
    storage,
  };

  bot.use(session(sessionConfig));

  // Настройка conversations
  bot.use(conversations());

  // Регистрируем conversations
  bot.use(createConversation(newsSelectionConversation, "news-selection"));
  bot.use(createConversation(editTitleConversation, "edit-title"));
  bot.use(createConversation(editTextConversation, "edit-text"));
  bot.use(createConversation(editHashtagsConversation, "edit-hashtags"));
  bot.use(createConversation(addChannelConversation, "add-channel"));
  bot.use(createConversation(selectChannelConversation, "select-channel"));

  // API Middlewares
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 1,
      maxDelaySeconds: 5,
    })
  );
  bot.on("message", (ctx, next) => {
    logger.info({
      msg: "message received",
      message: ctx.message,
    });
    return next();
  });

  // Logging middleware for development
  if (config.isDev) {
    bot.use((ctx, next) => {
      logger.info({
        msg: "update received",
        update_id: ctx.update.update_id,
      });
      return next();
    });
  }

  // Channel selection callbacks
  bot.callbackQuery(/^select_channel_(.+)$/, handleChannelSelection);

  bot.command("select_channel", selectChannelCommand);
  bot.command("add_channel", addChannelCommand);

  // Channel management callbacks
  bot.callbackQuery("add_new_channel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("add-channel");
  });

  // Admin commands
  bot.command("get_posts", getPostsCommand);
  bot.command("view_posts", viewPostsCommand);

  // State management commands
  bot.command("clear_state", clearStateCommand);
  bot.command("status", statusCommand);

  // Cron management commands
  bot.command("cron_test", cronTestCommand);

  // Callback handlers для кнопок
  bot.callbackQuery("select_post_for_processing", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("news-selection");
  });

  bot.callbackQuery("regenerate_title", regenerateTitleHandler);
  bot.callbackQuery("regenerate_description", regenerateDescriptionHandler);
  bot.callbackQuery("publish_post", publishPostHandler);
  bot.callbackQuery("cancel_post", cancelPostHandler);
  bot.callbackQuery("edit_hashtags", editHashtagsHandler);

  // Обработчики ручного редактирования
  bot.callbackQuery("edit_title", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("edit-title");
  });

  bot.callbackQuery("edit_text", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("edit-text");
  });

  // Обработчик для повторной попытки обработки новостей
  bot.callbackQuery("retry_news_processing", async (ctx) => {
    await ctx.answerCallbackQuery("🔄 Запускаю обработку заново...");

    // Очищаем pendingNewsRequest перед повторной попыткой
    if (ctx.session.pendingNewsRequest) {
      delete ctx.session.pendingNewsRequest;
      logger.info({
        msg: "Cleared pendingNewsRequest before retry",
        userId: ctx.from?.id,
      });
    }

    await getPostsCommand(ctx);
  });

  // Обработчик для отмены обработки новости
  bot.callbackQuery("cancel_news_processing", async (ctx) => {
    await ctx.answerCallbackQuery("❌ Обработка отменена");

    // Очищаем pendingNewsRequest при отмене
    if (ctx.session.pendingNewsRequest) {
      delete ctx.session.pendingNewsRequest;
      logger.info({
        msg: "Cleared pendingNewsRequest after user cancellation",
        userId: ctx.from?.id,
      });
    }

    await ctx.editMessageText(
      "❌ **Обработка новости отменена**\n\nВы можете выбрать другую новость или запустить поиск заново.",
      {
        parse_mode: "Markdown",
      }
    );
  });

  // Обработчик для повторной попытки обработки конкретной новости
  bot.callbackQuery("retry_single_news_processing", async (ctx) => {
    await ctx.answerCallbackQuery("🔄 Повторяю обработку новости...");
    await ctx.conversation.enter("news-selection");
  });

  // Cron management callbacks
  bot.callbackQuery("run_cron_now", runCronNowHandler);
  bot.callbackQuery("cron_status", cronStatusHandler);
  bot.callbackQuery("test_notification", testNotificationHandler);

  bot.callbackQuery("select_another_channel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("select-channel");
  });

  bot.callbackQuery("my_channels", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("select-channel");
  });

  bot.callbackQuery("refresh_channels", async (ctx) => {
    await ctx.answerCallbackQuery("🔄 Обновляю список каналов...");
    await ctx.conversation.enter("select-channel");
  });

  bot.callbackQuery("cancel_channel_selection", async (ctx) => {
    // await ctx.answerCallbackQuery("❌ Выбор канала отменен");
    await ctx.editMessageText(
      "❌ **Выбор канала отменен**\n\nИспользуйте /select_channel для выбора канала позже.",
      {
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("main_menu", async (ctx) => {
    await ctx.answerCallbackQuery("🏠 Возвращаемся в главное меню");
    await ctx.editMessageText(
      "🏠 <b>Главное меню</b>\n\n" +
        "📺 /add_channel - Добавить новый канал\n" +
        "📋 /select_channel - Выбрать канал\n" +
        "📰 /get_posts - Получить новости\n" +
        "👀 /view_posts - Просмотреть посты\n" +
        "⚙️ /status - Статус системы",
      { parse_mode: "HTML" }
    );
  });

  // Features
  bot.use(botAdminFeature);
  bot.use(welcomeFeature);

  // Error handler
  bot.catch((err) => {
    const { ctx } = err;
    logger.error({
      msg: "Bot error occurred",
      error: err.error,
      stack: err.error instanceof Error ? err.error.stack : undefined,
      update: ctx.update,
    });
  });

  return bot;
}

export type BotInstance = ReturnType<typeof createBot>;
