import { logger } from "../../../utils/logger.js";
import { MyContext } from "../../../types/context.js";
import { config } from "../../../config/index.js";

/**
 * Обработчик для кнопки "Запустить задачу сейчас"
 */
export async function runCronNowHandler(ctx: MyContext) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery("❌ Не удалось получить ID пользователя");
      return;
    }

    // Проверяем права
    const isAdmin = config.BOT_ADMIN_USER_IDS.includes(userId);
    const isMainCreator = config.MAIN_CONTENT_CREATOR_ID === userId;

    if (!isAdmin && !isMainCreator) {
      await ctx.answerCallbackQuery("❌ У вас нет прав для выполнения этой команды");
      return;
    }

    await ctx.answerCallbackQuery("🔄 Запускаю задачу получения новостей...");

    // Получаем scheduler из контекста
    const scheduler = (ctx as any).scheduler;
    
    if (!scheduler) {
      await ctx.reply("❌ Scheduler не найден в контексте");
      return;
    }

    // Запускаем задачу
    const result = await scheduler.runNewsTaskNow();

    if (result.success) {
      let message = `✅ **Задача выполнена успешно!**\n\n` +
                   `📰 Получено новостей: ${result.totalNews}\n` +
                   `📨 Отправлено сообщений: ${result.totalMessages}\n` +
                   `⏰ Время выполнения: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

      // Добавляем информацию о каналах
      if (result.results && result.results.length > 0) {
        message += `\n\n📊 **Результаты по каналам:**\n`;
        
        for (const channelResult of result.results) {
          if (channelResult.success) {
            message += `✅ **${channelResult.channelName}**: ${channelResult.newsCount || 0} новостей\n`;
          } else {
            message += `❌ **${channelResult.channelName}**: ${channelResult.error || 'Ошибка'}\n`;
          }
        }
      }

      // Добавляем инструкции для пользователя
      message += `\n\n🎯 **Что делать дальше:**\n`;
      message += `1️⃣ Выберите нужный канал: /select_channel\n`;
      message += `2️⃣ Посмотрите сохраненные посты: /view_posts\n`;
      message += `3️⃣ Обработайте посты для публикации\n\n`;
      message += `💡 Посты сохраняются отдельно для каждого канала!`;

      await ctx.reply(message, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(
        `❌ **Ошибка при выполнении задачи**\n\n` +
        `🚨 Ошибка: ${result.error || 'Неизвестная ошибка'}\n` +
        `⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}\n\n` +
        `🔧 **Возможные решения:**\n` +
        `• Проверьте настройки n8n webhook\n` +
        `• Убедитесь, что каналы настроены правильно\n` +
        `• Проверьте логи для детальной информации`,
        { parse_mode: "Markdown" }
      );
    }

    logger.info({
      msg: 'Manual cron task executed',
      userId,
      success: result.success,
      totalNews: result.totalNews,
      totalMessages: result.totalMessages
    });

  } catch (error) {
    logger.error({
      msg: 'Error in runCronNowHandler',
      userId: ctx.from?.id,
      error: error instanceof Error ? error.message : String(error)
    });

    await ctx.answerCallbackQuery("❌ Произошла ошибка при запуске задачи");
  }
}

/**
 * Обработчик для кнопки "Статус задач"
 */
export async function cronStatusHandler(ctx: MyContext) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery("❌ Не удалось получить ID пользователя");
      return;
    }

    // Проверяем права
    const isAdmin = config.BOT_ADMIN_USER_IDS.includes(userId);
    const isMainCreator = config.MAIN_CONTENT_CREATOR_ID === userId;

    if (!isAdmin && !isMainCreator) {
      await ctx.answerCallbackQuery("❌ У вас нет прав для выполнения этой команды");
      return;
    }

    await ctx.answerCallbackQuery("📊 Получаю статус задач...");

    // Получаем scheduler из контекста
    const scheduler = (ctx as any).scheduler;
    
    if (!scheduler) {
      await ctx.reply("❌ Scheduler не найден в контексте");
      return;
    }

    // Получаем информацию о задачах
    const tasksInfo = scheduler.getTasksInfo();
    
    let message = `📊 **Статус запланированных задач:**\n\n`;
    
    if (tasksInfo.length === 0) {
      message += `📭 Нет активных задач\n\n`;
    } else {
      for (const task of tasksInfo) {
        message += `📋 **${task.name}**\n`;
        message += `🔄 Статус: ${task.running ? '✅ Активна' : '❌ Остановлена'}\n`;
        message += `⏰ Следующий запуск: ${task.nextRun || 'Неизвестно'}\n\n`;
      }
    }

    message += `⏰ **Время сервера:** ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    await ctx.reply(message, { parse_mode: "Markdown" });

    logger.info({
      msg: 'Cron status requested',
      userId,
      tasksCount: tasksInfo.length
    });

  } catch (error) {
    logger.error({
      msg: 'Error in cronStatusHandler',
      userId: ctx.from?.id,
      error: error instanceof Error ? error.message : String(error)
    });

    await ctx.answerCallbackQuery("❌ Произошла ошибка при получении статуса");
  }
}

/**
 * Обработчик для кнопки "Тестовое уведомление"
 */
export async function testNotificationHandler(ctx: MyContext) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery("❌ Не удалось получить ID пользователя");
      return;
    }

    // Проверяем права
    const isAdmin = config.BOT_ADMIN_USER_IDS.includes(userId);
    const isMainCreator = config.MAIN_CONTENT_CREATOR_ID === userId;

    if (!isAdmin && !isMainCreator) {
      await ctx.answerCallbackQuery("❌ У вас нет прав для выполнения этой команды");
      return;
    }

    await ctx.answerCallbackQuery("🧪 Отправляю тестовое уведомление...");

    // Отправляем тестовое сообщение
    const testMessage = `🧪 **Тестовое уведомление от Cron**\n\n` +
                       `✅ Система работает корректно\n` +
                       `👤 Отправитель: ${userId}\n` +
                       `⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}\n\n` +
                       `🎯 Это тестовое сообщение для проверки работы уведомлений`;

    await ctx.reply(testMessage, { parse_mode: "Markdown" });

    logger.info({
      msg: 'Test notification sent',
      userId
    });

  } catch (error) {
    logger.error({
      msg: 'Error in testNotificationHandler',
      userId: ctx.from?.id,
      error: error instanceof Error ? error.message : String(error)
    });

    await ctx.answerCallbackQuery("❌ Произошла ошибка при отправке тестового уведомления");
  }
}
