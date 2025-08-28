import { Composer } from "grammy";
import { isBotAdmin } from "../filters/index.js";
import { setCommandsHandler } from "../handlers/commands/setcommands.js";

const composer = new Composer();

const feature = composer.chatType("private").filter(isBotAdmin);

feature.command("setcommands", setCommandsHandler);

feature.command("stats", async (ctx) => {
  await ctx.reply(
    "📊 Статистика канала\n\n" +
    "Функция в разработке...",
    { parse_mode: "HTML" }
  );
});

export { composer as botAdminFeature };
