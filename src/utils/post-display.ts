import { InlineKeyboard } from "grammy";
import { Context } from "grammy";
import { ProcessedPost } from "../bot/conversations/news-selection.js";

/**
 * Интерфейс для поста
 */
export interface PostData {
  original_title: string;
  trigger_title: string;
  post_text: string;
  hashtags?: string[];
  urgency_reason?: string;
  main_post_image?: string;
}

/**
 * Опции для отображения поста
 */
export interface PostDisplayOptions {
  showRegenerateButtons?: boolean;
  showEditButtons?: boolean;
  showHashtagButtons?: boolean;
  showPublishButtons?: boolean;
  isUpdated?: boolean;
}

/**
 * Создает клавиатуру для поста на основе опций
 */
export function createPostKeyboard(options: PostDisplayOptions = {}): InlineKeyboard {
  const {
    showRegenerateButtons = true,
    showEditButtons = true,
    showHashtagButtons = true,
    showPublishButtons = true
  } = options;

  const keyboard = new InlineKeyboard();

  if (showRegenerateButtons) {
    keyboard.text("🔄 Перегенерировать заголовок", "regenerate_title");
  }
  
  if (showEditButtons) {
    if (showRegenerateButtons) {
      keyboard.text("✏️ Изменить заголовок", "edit_title");
    } else {
      keyboard.text("✏️ Изменить заголовок", "edit_title");
    }
  }
  
  if (showRegenerateButtons || showEditButtons) {
    keyboard.row();
  }

  if (showRegenerateButtons) {
    keyboard.text("📝 Перегенерировать описание", "regenerate_description");
  }
  
  if (showEditButtons) {
    if (showRegenerateButtons) {
      keyboard.text("📝 Изменить описание", "edit_text");
    } else {
      keyboard.text("📝 Изменить описание", "edit_text");
    }
  }
  
  if (showRegenerateButtons || showEditButtons) {
    keyboard.row();
  }

  if (showHashtagButtons) {
    keyboard.text("🏷️ Изменить хэштеги", "edit_hashtags");
    keyboard.row();
  }

  if (showPublishButtons) {
    keyboard.text("✅ Опубликовать", "publish_post");
    keyboard.text("❌ Отменить", "cancel_post");
  }

  return keyboard;
}

/**
 * Формирует текст сообщения для поста
 */
export function formatPostMessage(post: ProcessedPost, options: PostDisplayOptions = {}): string {
  const { isUpdated = false } = options;
  
  let postMessage = `🎯 **Обработанная новость:**${isUpdated ? ' *(обновлено)*' : ''}\n\n`;
  postMessage += `📰 **Оригинальный заголовок:**\n${post.original_title}\n\n`;
  postMessage += `⚡ **Предложенный заголовок:**\n${post.generated_title}\n\n`;
  postMessage += `📝 **Текст поста:**\n${post.generated_post_text}\n\n`;
  
  if (post.hashtags && post.hashtags.length > 0) {
    postMessage += `🏷️ **Хештеги:** ${post.hashtags.split(' ').join(', ')}\n\n`;
  }
  
    if (post.original_link) {
      postMessage += `🔥 **Ссылка на оригинальную новость:**\n${post.original_link}\n\n`;
    }

  return postMessage;
}

/**
 * Отображает пост с клавиатурой
 */
export async function displayPost(
  ctx: Context, 
  post: ProcessedPost, 
  options: PostDisplayOptions = {}
): Promise<void> {
  const message = formatPostMessage(post, options);
  const keyboard = createPostKeyboard(options);

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
}

/**
 * Обновляет существующее сообщение с постом
 */
export async function updatePostMessage(
  ctx: Context, 
  post: ProcessedPost, 
  options: PostDisplayOptions = {}
): Promise<void> {
  const message = formatPostMessage(post, { ...options, isUpdated: true });
  const keyboard = createPostKeyboard(options);

  try {
    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  } catch (error) {
    // Если не удалось отредактировать, отправляем новое сообщение
    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  }
}
