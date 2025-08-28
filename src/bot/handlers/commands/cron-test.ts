import { logger } from "../../../utils/logger.js";
import { MyContext } from "../../../types/context.js";
import { config } from "../../../config/index.js";

export async function cronTestCommand(ctx: MyContext) {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply('❌ Произошла ошибка при получении ID пользователя');
    return;
  }

  try {
    // Проверяем, является ли пользователь админом или основным контент-мейкером
    const isAdmin = config.BOT_ADMIN_USER_IDS.includes(userId);
    const isMainCreator = config.MAIN_CONTENT_CREATOR_ID === userId;

    if (!isAdmin && !isMainCreator) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды');
      return;
    }

    // Получаем информацию о scheduler из контекста
    const scheduler = (ctx as any).scheduler;
    
    if (!scheduler) {
      await ctx.reply('❌ Scheduler не найден в контексте');
      return;
    }

    // Получаем информацию о задачах
    const tasksInfo = scheduler.getTasksInfo();
    
    let message = `🕛 **Информация о запланированных задачах:**\n\n`;
    
    if (tasksInfo.length === 0) {
      message += `📭 Нет активных задач\n\n`;
    } else {
      for (const task of tasksInfo) {
        message += `📋 **${task.name}**\n`;
        message += `🔄 Статус: ${task.running ? '✅ Активна' : '❌ Остановлена'}\n`;
        message += `⏰ Следующий запуск: ${task.nextRun || 'Неизвестно'}\n\n`;
      }
    }

    // Добавляем информацию о конфигурации
    message += `⚙️ **Конфигурация:**\n`;
    message += `👤 Основной контент-мейкер: ${config.MAIN_CONTENT_CREATOR_ID || 'Не настроен'}\n`;
    message += `👥 Админы: ${config.BOT_ADMIN_USER_IDS.length > 0 ? config.BOT_ADMIN_USER_IDS.join(', ') : 'Не настроены'}\n`;
    message += `🌍 Временная зона: Europe/Moscow\n\n`;

    // Добавляем кнопки для управления
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 Запустить задачу сейчас", callback_data: "run_cron_now" },
          { text: "📊 Статус задач", callback_data: "cron_status" }
        ],
        [
          { text: "🧪 Тестовое уведомление", callback_data: "test_notification" }
        ]
      ]
    };

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });

    logger.info({
      msg: 'Cron test command executed',
      userId,
      isAdmin,
      isMainCreator,
      tasksCount: tasksInfo.length
    });

  } catch (error) {
    logger.error({
      msg: 'cron_test command error',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    await ctx.reply(
      `❌ Произошла ошибка при получении информации о задачах:\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}
