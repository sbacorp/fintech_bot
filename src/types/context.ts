import { Context, SessionFlavor } from "grammy";
import { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import { Channel } from "../services/supabase-service.js";


// Расширенный контекст с сессией
export interface SessionData {
  isAdmin: boolean;
  currentAction?: string | null;
  selectedNews?: any[];
  selectedPostIndex?: number;
  processedPost?: any;
  // Выбранный канал для модерации
  selectedChannel?: Channel | null;
  // Для асинхронных запросов
  pendingNewsRequest?: {
    requestId: string;
    userId: number;
    startTime: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    messageId?: number;
  };
  // Для редактирования постов
  editingMode?: 'title' | 'text' | 'hashtags' | null;
  editingData?: {
    field: string;
    currentValue: any;
  };
}
export type ContextSession = 
    Context &
    SessionFlavor<SessionData>


export type MyContext = ConversationFlavor<ContextSession>;
export type MyConversation = Conversation<MyContext, Context>;