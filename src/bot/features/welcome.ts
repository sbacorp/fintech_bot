import { Composer } from "grammy";
import { isBotAdmin } from "../filters/index.js";

const composer = new Composer();

const feature = composer.chatType("private");

// Команда start только для админов
feature.command("start", async (ctx) => {
  if (!isBotAdmin(ctx)) {
    await ctx.reply("❌ У вас нет доступа к этому боту.");
    return;
  }

  const userName = ctx.from?.first_name || "Пользователь";
  
  await ctx.reply(
    `👋 Привет, ${userName}!\n\n` +
    `🤖 FINTECH Bot\n\n` +
    `Бот для управления финансовым каналом.`,
    { parse_mode: "HTML" }
  );
});

// Блокируем все остальные сообщения от неадминов
feature.on("message", async (ctx) => {
  if (!isBotAdmin(ctx)) {
    await ctx.reply("❌ У вас нет доступа к этому боту.");
    return;
  }
});

export { composer as welcomeFeature };
