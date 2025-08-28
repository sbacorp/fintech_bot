import { config } from "../../config/index.js";

export function isBotAdmin(ctx: any): boolean {
  if (!ctx.from) return false;
  console.log(config.BOT_ADMIN_USER_IDS);
  return config.BOT_ADMIN_USER_IDS.includes(ctx.from.id);
}
