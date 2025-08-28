import "dotenv/config";
import z from "zod";

// Схема для канала
const channelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  channelId: z.string(),
  n8nTriggerUrl: z.string(),
  n8nRegenerateUrl: z.string().optional(),
  webhookToken: z.string().optional(),
});

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
  BOT_SERVER_HOST: z.string().default("0.0.0.0"),
  BOT_SERVER_PORT: z.coerce.number().positive().default(3000),
  BOT_ALLOWED_UPDATES: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (val === '[]' || val === '') return [];
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    })
    .default([]),
  BOT_TOKEN: z.string(),
  CHANNEL_ID: z.string().optional(),
  BOT_USERNAME: z.string().optional(),
  BOT_ADMIN_USER_IDS: z
    .union([z.string(), z.array(z.number())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    })
    .default([]),
  MAIN_CONTENT_CREATOR_ID: z.coerce.number().optional(),
  ERROR_WEBHOOK_TOKEN: z.string().optional(),
  // Supabase конфигурация
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Конфигурация каналов
  CHANNELS: z
    .union([z.string(), z.array(channelSchema)])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
    .default([]),
  // URL по умолчанию для обратной совместимости
  DEFAULT_N8N_TRIGGER_URL: z.string().optional(),
  DEFAULT_N8N_REGENERATE_URL: z.string().optional(),
  BASE_N8N_WEBHOOK_URL: z.string().optional(),
});

// Экспортируем типы
export type Channel = z.infer<typeof channelSchema>;

const parseConfig = (environment: NodeJS.ProcessEnv) => {
  const config = configSchema.parse(environment);

  return {
    ...config,
    isDev: config.NODE_ENV === "development",
    isProd: config.NODE_ENV === "production",
  };
};

export type Config = ReturnType<typeof parseConfig>;

export const config = parseConfig(process.env);