import { BotCommand } from "@grammyjs/types";
import { config } from "../../../config/index.js";

function getPrivateChatCommands(): BotCommand[] {
  return [
    {
      command: "start",
      description: "Запустить бота",
    },
  ];
}

function getPrivateChatAdminCommands(): BotCommand[] {
  return [
    {
      command: "setcommands",
      description: "Обновить команды",
    },
    {
      command: "get_posts",
      description: "Получить новости вручную",
    },
    {
      command: "view_posts",
      description: "Просмотреть сохраненные новости",
    },
    {
      command: "select_channel",
      description: "Выбрать канал для работы",
    },
    {
      command: "clear_state",
      description: "Очистить состояние бота",
    },
    {
      command: "add_channel",
      description: "Добавить канал",
    },
    {
      command: "delete_channel",
      description: "Удалить канал",
    },
    {
      command: "status",
      description: "Проверить текущее состояние",
    },
  ];
}

export async function setCommandsHandler(ctx: any) {
  try {
    // Устанавливаем команды для всех приватных чатов
    await ctx.api.setMyCommands([...getPrivateChatCommands()], {
      scope: {
        type: "all_private_chats",
      },
    });

    // Устанавливаем команды для админов (если есть)
    if (config.BOT_ADMIN_USER_IDS.length > 0) {
      for (const adminId of config.BOT_ADMIN_USER_IDS) {
        await ctx.api.setMyCommands(
          [...getPrivateChatCommands(), ...getPrivateChatAdminCommands()],
          {
            scope: {
              type: "chat",
              chat_id: adminId,
            },
          }
        );
      }
    }

    return ctx.reply("✅ Команды успешно обновлены!");
  } catch (error) {
    console.error("Error setting commands:", error);
    return ctx.reply("❌ Ошибка при обновлении команд");
  }
}
