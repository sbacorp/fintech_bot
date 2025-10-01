import { MyContext } from "../../../types/context.js";
import { logger } from "../../../utils/logger.js";
import { addChannelConversation } from "../../conversations/add-channel.js";

/**
 * Команда для добавления нового канала
 */
export async function addChannelCommand(ctx: MyContext) {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply('❌ Произошла ошибка при получении ID пользователя');
    return;
  }

  try {
    logger.info({
      msg: 'Add channel command started',
      userId
    });

    // Запускаем conversation для добавления канала
    await ctx.conversation.enter("add-channel");

  } catch (error) {
    logger.error({
      msg: 'add_channel command error',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    await ctx.reply(
      `❌ Произошла ошибка при добавлении канала:\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}
