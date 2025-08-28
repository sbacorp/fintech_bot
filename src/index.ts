import { onShutdown } from "node-graceful-shutdown";
import { run, RunnerHandle } from "@grammyjs/runner";
import { createBot } from "./bot/index.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { startWebhookServer } from "./services/webhook.js";
import { SchedulerService } from "./services/scheduler.js";
import type { Server } from "http";

try {
  let runner: undefined | RunnerHandle;
  let webhookServer: undefined | Server;
  let scheduler: undefined | SchedulerService;

  // Создаем scheduler
  scheduler = new SchedulerService();
  
  // Создаем бота с scheduler
  const bot = createBot(config.BOT_TOKEN, scheduler);
  
  // Устанавливаем bot в scheduler
  scheduler.setBot(bot);

  // Graceful shutdown
  onShutdown(async () => {
    logger.info("shutdown initiated");
    
    // Останавливаем scheduler
    if (scheduler) {
      logger.info("stopping scheduler");
      scheduler.stop();
    }
    
    // Останавливаем webhook сервер
    if (webhookServer) {
      logger.info("stopping webhook server");
      webhookServer.close();
    }
    
    // Останавливаем runner если он используется
    if (runner) {
      logger.info("stopping bot runner");
      await runner.stop();
    }
    
    await bot.stop();
    logger.info("shutdown completed");
  });

  logger.info("Starting FINTECH Telegram Bot...");
  
  // Инициализируем бота
  await bot.init();
  logger.info({
    msg: "bot initialized",
    username: bot.botInfo.username,
  });

  // Запускаем webhook сервер для приема сообщений от n8n
  webhookServer = startWebhookServer(bot);
  
  // Запускаем scheduler для автоматических задач
  scheduler = new SchedulerService(bot);
  scheduler.start();
  
  if (config.isProd) {
    // В продакшене удаляем webhook и используем только long polling для команд
    // но оставляем webhook сервер для n8n
    await bot.api.deleteWebhook();
    
    logger.info({
      msg: "bot running in production with webhook server and scheduler",
      username: bot.botInfo.username,
    });
    
    runner = run(bot, {
      runner: {
        fetch: {
          allowed_updates: config.BOT_ALLOWED_UPDATES,
        },
      },
    });
  } else if (config.isDev) {
    logger.info("Starting bot in development mode with webhook server and scheduler...");
    
    // В разработке удаляем webhook и используем long polling для команд + webhook для n8n
    await bot.api.deleteWebhook();
    
    runner = run(bot, {
      runner: {
        fetch: {
          allowed_updates: config.BOT_ALLOWED_UPDATES,
        },
      },
    });
    
    logger.info({
      msg: "bot running in development with webhook server and scheduler",
      username: bot.botInfo.username,
      webhookPort: config.BOT_SERVER_PORT,
    });
  }
} catch (error) {
  logger.error("Failed to start bot:", error);
  process.exit(1);
}
