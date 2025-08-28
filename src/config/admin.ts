import { isUserHasId } from "grammy-guard";
import { config } from "./index.js";

export const isBotAdmin = isUserHasId(...config.BOT_ADMIN_USER_IDS);
