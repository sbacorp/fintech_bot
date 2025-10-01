// import { logger } from "../../../utils/logger.js";
// import { MyContext } from "../../../types/context.js";
// import { channelService } from "../../../services/channel-service.js";

// /**
//  * Тестовая команда для отправки сообщения в канал
//  */
// export async function testPostCommand(ctx: MyContext) {
//   const userId = ctx.from?.id;

//   if (!userId) {
//     await ctx.reply('❌ Произошла ошибка: не удалось получить ID пользователя');
//     return;
//   }

//   try {
//     // Получаем выбранный канал
//     const selectedChannel = ctx.session.selectedChannel;
//     if (!selectedChannel) {
//       await ctx.reply('❌ Не выбран канал для работы. Используйте /select_channel для выбора канала.');
//       return;
//     }

//     const channelId = channelService.getChannelId(selectedChannel);

//     logger.info({
//       msg: 'Sending test post to channel',
//       userId,
//       channelId,
//       channelName: selectedChannel.name,
//     });

//     // Отправляем тестовое сообщение в канал
//     await ctx.api.sendMessage(channelId, '👋 Привет! Это тестовое сообщение от Fintech Bot', {
//       parse_mode: "HTML"
//     });

//     // Подтверждаем админу
//     await ctx.reply(`✅ Тестовое сообщение отправлено в канал **${selectedChannel.name}**!\n\n📺 Channel ID: \`${channelId}\``);

//     logger.info({
//       msg: 'Test post sent successfully',
//       userId,
//       channelId,
//       channelName: selectedChannel.name,
//     });

//   } catch (error) {
//     logger.error({
//       msg: 'Failed to send test post',
//       userId,
//       channelId: ctx.session.selectedChannel ? channelService.getChannelId(ctx.session.selectedChannel) : 'unknown',
//       channelName: ctx.session.selectedChannel?.name,
//       error: error instanceof Error ? error.message : String(error),
//     });

//     // Детальная диагностика ошибки
//     if (error instanceof Error) {
//       let errorDetails = '';

//       // Проверяем типичные ошибки Telegram API
//       if (error.message.includes('chat not found')) {
//         errorDetails = '\n\n🔍 **Возможные причины:**\n• Неверный ID канала\n• Бот не добавлен в канал\n• Канал удален или заблокирован';
//       } else if (error.message.includes('not enough rights')) {
//         errorDetails = '\n\n🔍 **Возможные причины:**\n• Бот не является администратором канала\n• У бота нет прав на отправку сообщений';
//       } else if (error.message.includes('bot was blocked')) {
//         errorDetails = '\n\n🔍 **Возможные причины:**\n• Бот заблокирован в канале\n• Нужно разблокировать бота';
//       }

//       await ctx.reply(
//         `❌ Ошибка при отправке тестового поста:\n\`${error.message}\`${errorDetails}`,
//         { parse_mode: "Markdown" }
//       );
//     } else {
//       await ctx.reply(`❌ Неизвестная ошибка при отправке тестового поста: ${String(error)}`);
//     }
//   }
// }

// /**
//  * Команда для отправки тестового поста с изображением
//  */
// export async function testPostWithImageCommand(ctx: MyContext) {
//   const userId = ctx.from?.id;

//   if (!userId) {
//     await ctx.reply('❌ Произошла ошибка: не удалось получить ID пользователя');
//     return;
//   }

//   try {
//     // Получаем выбранный канал
//     const selectedChannel = ctx.session.selectedChannel;
//     if (!selectedChannel) {
//       await ctx.reply('❌ Не выбран канал для работы. Используйте /select_channel для выбора канала.');
//       return;
//     }

//     const channelId = channelService.getChannelId(selectedChannel);

//     logger.info({
//       msg: 'Sending test post with image to channel',
//       userId,
//       channelId,
//       channelName: selectedChannel.name,
//     });

//     // Тестовое изображение (логотип Telegram)
//     const testImageUrl = 'https://telegram.org/img/t_logo.png';

//     // Отправляем тестовое сообщение с изображением
//     try {
//       await ctx.api.sendPhoto(channelId, testImageUrl, {
//         caption: '🖼️ **Тестовый пост с изображением**\n\nПривет! Это тестовое сообщение с картинкой от Fintech Bot\n\n🤖 Все системы работают!',
//         parse_mode: "Markdown"
//       });

//       logger.info({
//         msg: 'Test post with image sent successfully',
//         userId,
//         channelId,
//         channelName: selectedChannel.name,
//         imageUrl: testImageUrl,
//       });

//     } catch (photoError) {
//       logger.warn({
//         msg: 'Failed to send test post with image, trying without image',
//         userId,
//         channelId,
//         channelName: selectedChannel.name,
//         imageUrl: testImageUrl,
//         error: photoError instanceof Error ? photoError.message : String(photoError)
//       });

//       // Fallback: отправляем без изображения
//       await ctx.api.sendMessage(channelId, '🖼️ **Тестовый пост без изображения**\n\nПривет! Это тестовое сообщение от Fintech Bot\n\n🤖 Все системы работают!', {
//         parse_mode: "Markdown"
//       });

//       logger.info({
//         msg: 'Test post without image sent successfully (fallback)',
//         userId,
//         channelId,
//         channelName: selectedChannel.name
//       });
//     }

//     // Подтверждаем админу
//     await ctx.reply(`✅ Тестовое сообщение отправлено в канал **${selectedChannel.name}**!\n\n📺 Channel ID: \`${channelId}\``);

//   } catch (error) {
//     logger.error({
//       msg: 'Failed to send test post with image',
//       userId,
//       channelId: ctx.session.selectedChannel ? channelService.getChannelId(ctx.session.selectedChannel) : 'unknown',
//       channelName: ctx.session.selectedChannel?.name,
//       error: error instanceof Error ? error.message : String(error),
//     });

//     await ctx.reply(
//       `❌ Ошибка при отправке тестового поста с изображением:\n\`${error instanceof Error ? error.message : String(error)}\``,
//       { parse_mode: "Markdown" }
//     );
//   }
// }

// /**
//  * Команда для проверки настроек канала
//  */
// export async function checkChannelCommand(ctx: MyContext) {
//   const userId = ctx.from?.id;

//   try {
//     const selectedChannel = ctx.session.selectedChannel;

//     let statusMessage = '📊 **Статус каналов:**\n\n';

//     if (!selectedChannel) {
//       statusMessage += '❌ Канал не выбран для работы\n';
//       statusMessage += '💡 Используйте /select_channel для выбора канала\n\n';

//       // Показываем все доступные каналы
//       const allChannels = channelService.getAllChannels();
//       if (allChannels.length > 0) {
//         statusMessage += '**Доступные каналы:**\n';
//         allChannels.forEach((channel, index) => {
//           statusMessage += `${index + 1}. **${channel.name}** - \`${channelService.getChannelId(channel)}\`\n`;
//         });
//       } else {
//         statusMessage += '❌ Нет доступных каналов в конфигурации\n';
//       }
//     } else {
//       const channelId = channelService.getChannelId(selectedChannel);
//       statusMessage += `📢 **Текущий канал:** ${selectedChannel.name}\n`;
//       statusMessage += `📝 **Описание:** ${selectedChannel.description}\n`;
//       statusMessage += `✅ Channel ID настроен: \`${channelId}\`\n\n`;

//       try {
//         // Пытаемся получить информацию о чате
//         const chat = await ctx.api.getChat(channelId);
//         statusMessage += `📺 **Название канала:** ${chat.title || 'Без названия'}\n`;
//         statusMessage += `👥 **Тип:** ${chat.type}\n`;

//         if ('username' in chat && chat.username) {
//           statusMessage += `🔗 **Username:** @${chat.username}\n`;
//         }

//         // Проверяем права бота
//         try {
//           const member = await ctx.api.getChatMember(channelId, ctx.me.id);
//           statusMessage += `🤖 **Статус бота:** ${member.status}\n`;

//           if (member.status === 'administrator') {
//             statusMessage += '✅ Бот является администратором\n';
//           } else if (member.status === 'member') {
//             statusMessage += '⚠️ Бот является участником (нужны права админа)\n';
//           }
//         } catch (memberError) {
//           statusMessage += '❌ Не удалось проверить статус бота в канале\n';
//         }

//       } catch (chatError) {
//         statusMessage += '❌ Не удалось получить информацию о канале\n';
//         statusMessage += `🔍 Ошибка: \`${chatError instanceof Error ? chatError.message : String(chatError)}\`\n`;
//       }
//     }

//     await ctx.reply(statusMessage, { parse_mode: "Markdown" });

//     logger.info({
//       msg: 'Channel status checked',
//       userId,
//       channelId: selectedChannel ? channelService.getChannelId(selectedChannel) : 'not selected',
//       channelName: selectedChannel?.name,
//     });

//   } catch (error) {
//     logger.error({
//       msg: 'Failed to check channel status',
//       userId,
//       error: error instanceof Error ? error.message : String(error),
//     });

//     await ctx.reply(
//       `❌ Ошибка при проверке статуса канала:\n\`${error instanceof Error ? error.message : String(error)}\``,
//       { parse_mode: "Markdown" }
//     );
//   }
// }
