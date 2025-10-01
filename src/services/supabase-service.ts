import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { SessionData } from '../types/context.js';

// Типы для Supabase таблиц
export interface UserSession {
  user_id: number;
  session_data: SessionData;
  created_at: string;
  updated_at: string;
}

export interface UserNews {
  user_id: number;
  news_data: any[];
  created_at: string;
  updated_at: string;
}

export interface ProcessedPost {
  user_id: number;
  post_data: any;
  created_at: string;
  updated_at: string;
}

export interface PostStats {
  id: string;
  user_id: number;
  title: string;
  original_title: string;
  publish_date: string;
  category?: string;
  hashtags: string[];
  processing_time?: number;
  regeneration_count: {
    title: number;
    text: number;
  };
  status: 'published' | 'cancelled' | 'draft';
  channel_id?: string;
  created_at: string;
}

export interface Channel {
  id: string;
  user_id: number;
  name: string;
  description?: string | undefined;
  sources: string[];
  channel_username?: string | undefined;
  channel_id?: number | undefined;
  is_admin_verified: boolean;
  ai_prompt?: string | undefined;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class SupabaseService {
  public client;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
    
    if (this.isEnabled) {
      this.client = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
      logger.info({
        msg: 'Supabase client initialized',
        url: config.SUPABASE_URL,
      });
    } else {
      logger.warn({
        msg: 'Supabase not configured, using in-memory storage',
        supabaseUrl: config.SUPABASE_URL,
        supabaseKey: config.SUPABASE_ANON_KEY ? 'configured' : 'not configured'
      });
    }
  }

  /**
   * Проверяет, включен ли Supabase
   */
  isSupabaseEnabled(): boolean {
    return this.isEnabled;
  }





  /**
   * Сохраняет новости пользователя
   */
  async saveUserNews(userId: number, newsData: any[], channelId?: string): Promise<void> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, skipping news save',
        userId,
        channelId
      });
      return;
    }

    try {
      // Получаем существующие новости напрямую из БД
      const { data, error: fetchError } = await this.client!
        .from('user_news')
        .select('news_data')
        .eq('user_id', userId)
        .single();

      let allNewsData: Record<string, any[]> = {};
      
      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Пользователь не найден, создаем новый
          logger.debug({
            msg: 'User news not found, creating new',
            userId,
            channelId
          });
        } else {
          logger.error({
            msg: 'Failed to fetch user news for save',
            userId,
            channelId,
            error: fetchError.message
          });
          throw fetchError;
        }
      } else {
        const existingData = data.news_data;
        
        if (existingData && typeof existingData === 'object' && !Array.isArray(existingData)) {
          // Если это объект с ключами каналов
          allNewsData = existingData;
        } else if (existingData && Array.isArray(existingData)) {
          // Если это старый формат (массив), конвертируем в новый
          allNewsData = { 'default': existingData };
        }
      }
      
      // Добавляем/обновляем новости для конкретного канала
      const storageKey = channelId || 'default';
      allNewsData[storageKey] = newsData;

      const { error } = await this.client!
        .from('user_news')
        .upsert({
          user_id: userId,
          news_data: allNewsData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        logger.error({
          msg: 'Failed to save user news',
          userId,
          channelId,
          error: error.message
        });
        throw error;
      }

      logger.info({
        msg: 'User news saved',
        userId,
        channelId,
        storageKey,
        newsCount: newsData.length,
        totalChannels: Object.keys(allNewsData).length,
        allNewsDataKeys: Object.keys(allNewsData),
        hasExistingData: !!data?.news_data
      });
    } catch (error) {
      logger.error({
        msg: 'Error saving user news',
        userId,
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает новости пользователя
   */
  async getUserNews(userId: number, channelId?: string): Promise<any[] | null> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, returning null news',
        userId,
        channelId
      });
      return null;
    }

    try {
      const { data, error } = await this.client!
        .from('user_news')
        .select('news_data')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.debug({
            msg: 'User news not found',
            userId,
            channelId
          });
          return null;
        }
        logger.error({
          msg: 'Failed to get user news',
          userId,
          channelId,
          error: error.message
        });
        throw error;
      }

      const newsData = data.news_data;
      
      // Если передан channelId, возвращаем новости для конкретного канала
      if (channelId && typeof newsData === 'object' && !Array.isArray(newsData)) {
        const channelNews = newsData[channelId];
        logger.debug({
          msg: 'User news retrieved for specific channel',
          userId,
          channelId,
          newsCount: channelNews?.length || 0
        });
        return channelNews || null;
      }
      
      // Если это новый формат (объект с ключами), но channelId не передан
      if (typeof newsData === 'object' && !Array.isArray(newsData)) {
        logger.debug({
          msg: 'User news retrieved (new format, no channel specified)',
          userId,
          availableChannels: Object.keys(newsData),
          totalNewsCount: Object.values(newsData).reduce((sum: number, news: any) => sum + (Array.isArray(news) ? news.length : 0), 0)
        });
        return null; // Возвращаем null, так как нужен конкретный канал
      }
      
      // Если это старый формат (массив), возвращаем как есть
      logger.debug({
        msg: 'User news retrieved (old format)',
        userId,
        newsCount: Array.isArray(newsData) ? newsData.length : 0
      });

      return Array.isArray(newsData) ? newsData : null;
    } catch (error) {
      logger.error({
        msg: 'Error getting user news',
        userId,
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Удаляет новости пользователя
   */
  async deleteUserNews(userId: number, channelId?: string): Promise<void> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, skipping news delete',
        userId,
        channelId
      });
      return;
    }

    try {
      if (channelId) {
        // Удаляем новости только для конкретного канала
        // Получаем полные данные пользователя из БД
        const { data, error: fetchError } = await this.client!
          .from('user_news')
          .select('news_data')
          .eq('user_id', userId)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // Пользователь не найден
            logger.debug({
              msg: 'User news not found for deletion',
              userId,
              channelId
            });
            return;
          }
          logger.error({
            msg: 'Failed to fetch user news for deletion',
            userId,
            channelId,
            error: fetchError.message
          });
          throw fetchError;
        }

        const existingData = data.news_data;
        if (existingData && typeof existingData === 'object' && !Array.isArray(existingData)) {
          // Если это новый формат, удаляем только указанный канал
          delete existingData[channelId];
          
          const { error } = await this.client!
            .from('user_news')
            .upsert({
              user_id: userId,
              news_data: existingData,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });

          if (error) {
            logger.error({
              msg: 'Failed to delete user news for channel',
              userId,
              channelId,
              error: error.message
            });
            throw error;
          }

          logger.debug({
            msg: 'User news deleted for specific channel',
            userId,
            channelId,
            remainingChannels: Object.keys(existingData)
          });
        } else {
          // Если старый формат, конвертируем в новый и удаляем только указанный канал
          const currentData = existingData || [];
          const newFormat: Record<string, any[]> = {};
          
          // Конвертируем старый формат в новый, исключая указанный канал
          if (Array.isArray(currentData)) {
            // Если есть данные в старом формате, сохраняем их под ключом 'default'
            // но только если это не тот канал, который мы удаляем
            if (channelId !== 'default' && currentData.length > 0) {
              newFormat['default'] = currentData;
            }
          }
          
          const { error } = await this.client!
            .from('user_news')
            .upsert({
              user_id: userId,
              news_data: newFormat,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });

          if (error) {
            logger.error({
              msg: 'Failed to convert and delete user news for channel',
              userId,
              channelId,
              error: error.message
            });
            throw error;
          }

          logger.debug({
            msg: 'User news converted and deleted for specific channel',
            userId,
            channelId,
            remainingChannels: Object.keys(newFormat)
          });
        }
      } else {
        // Удаляем все новости пользователя
        const { error } = await this.client!
          .from('user_news')
          .delete()
          .eq('user_id', userId);

        if (error) {
          logger.error({
            msg: 'Failed to delete all user news',
            userId,
            error: error.message
          });
          throw error;
        }

        logger.debug({
          msg: 'All user news deleted',
          userId
        });
      }
    } catch (error) {
      logger.error({
        msg: 'Error deleting user news',
        userId,
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Сохраняет обработанный пост пользователя
   */
  async saveProcessedPost(userId: number, postData: any): Promise<void> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, skipping post save',
        userId
      });
      return;
    }

    try {
      const { error } = await this.client!
        .from('processed_posts')
        .upsert({
          user_id: userId,
          post_data: postData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        logger.error({
          msg: 'Failed to save processed post',
          userId,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Processed post saved',
        userId
      });
    } catch (error) {
      logger.error({
        msg: 'Error saving processed post',
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает обработанный пост пользователя
   */
  async getProcessedPost(userId: number): Promise<any | null> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, returning null post',
        userId
      });
      return null;
    }

    try {
      const { data, error } = await this.client!
        .from('processed_posts')
        .select('post_data')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.debug({
            msg: 'Processed post not found',
            userId
          });
          return null;
        }
        logger.error({
          msg: 'Failed to get processed post',
          userId,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Processed post retrieved',
        userId
      });

      return data.post_data;
    } catch (error) {
      logger.error({
        msg: 'Error getting processed post',
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Удаляет обработанный пост пользователя
   */
  async deleteProcessedPost(userId: number): Promise<void> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, skipping post delete',
        userId
      });
      return;
    }

    try {
      const { error } = await this.client!
        .from('processed_posts')
        .delete()
        .eq('user_id', userId);

      if (error) {
        logger.error({
          msg: 'Failed to delete processed post',
          userId,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Processed post deleted',
        userId
      });
    } catch (error) {
      logger.error({
        msg: 'Error deleting processed post',
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Сохраняет статистику поста
   */
  async savePostStats(postStats: PostStats): Promise<void> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, skipping stats save',
        postId: postStats.id
      });
      return;
    }

    try {
      const { error } = await this.client!
        .from('post_stats')
        .insert({
          id: postStats.id,
          user_id: postStats.user_id,
          title: postStats.title,
          original_title: postStats.original_title,
          publish_date: postStats.publish_date,
          category: postStats.category,
          hashtags: postStats.hashtags,
          processing_time: postStats.processing_time,
          regeneration_count: postStats.regeneration_count,
          status: postStats.status,
          channel_id: postStats.channel_id,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error({
          msg: 'Failed to save post stats',
          postId: postStats.id,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Post stats saved',
        postId: postStats.id
      });
    } catch (error) {
      logger.error({
        msg: 'Error saving post stats',
        postId: postStats.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает все статистики постов
   */
  async getAllPostStats(): Promise<PostStats[]> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, returning empty stats'
      });
      return [];
    }

    try {
      const { data, error } = await this.client!
        .from('post_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error({
          msg: 'Failed to get all post stats',
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'All post stats retrieved',
        count: data.length
      });

      return data;
    } catch (error) {
      logger.error({
        msg: 'Error getting all post stats',
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Получает статистики постов за период
   */
  async getPostStatsByDateRange(startDate: string, endDate: string): Promise<PostStats[]> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, returning empty stats for date range',
        startDate,
        endDate
      });
      return [];
    }

    try {
      const { data, error } = await this.client!
        .from('post_stats')
        .select('*')
        .gte('publish_date', startDate)
        .lte('publish_date', endDate)
        .order('publish_date', { ascending: false });

      if (error) {
        logger.error({
          msg: 'Failed to get post stats by date range',
          startDate,
          endDate,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Post stats by date range retrieved',
        startDate,
        endDate,
        count: data.length
      });

      return data;
    } catch (error) {
      logger.error({
        msg: 'Error getting post stats by date range',
        startDate,
        endDate,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Получает последние N постов
   */
  async getRecentPostStats(limit: number = 10): Promise<PostStats[]> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, returning empty recent stats',
        limit
      });
      return [];
    }

    try {
      const { data, error } = await this.client!
        .from('post_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error({
          msg: 'Failed to get recent post stats',
          limit,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Recent post stats retrieved',
        limit,
        count: data.length
      });

      return data;
    } catch (error) {
      logger.error({
        msg: 'Error getting recent post stats',
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Обновляет счетчик регенераций для поста
   */
  async incrementRegenerationCount(postId: string, type: 'title' | 'text'): Promise<void> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, skipping regeneration count increment',
        postId,
        type
      });
      return;
    }

    try {
      // Получаем текущие данные
      const { data: currentData, error: getError } = await this.client!
        .from('post_stats')
        .select('regeneration_count')
        .eq('id', postId)
        .single();

      if (getError) {
        logger.error({
          msg: 'Failed to get current regeneration count',
          postId,
          error: getError.message
        });
        throw getError;
      }

      // Обновляем счетчик
      const currentCount = currentData.regeneration_count || { title: 0, text: 0 };
      currentCount[type]++;

      const { error: updateError } = await this.client!
        .from('post_stats')
        .update({ regeneration_count: currentCount })
        .eq('id', postId);

      if (updateError) {
        logger.error({
          msg: 'Failed to update regeneration count',
          postId,
          type,
          error: updateError.message
        });
        throw updateError;
      }

      logger.debug({
        msg: 'Regeneration count incremented',
        postId,
        type,
        newCount: currentCount[type]
      });
    } catch (error) {
      logger.error({
        msg: 'Error incrementing regeneration count',
        postId,
        type,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Очищает pendingNewsRequest из сессии пользователя в grammy_sessions
   */
  async clearPendingNewsRequest(userId: number): Promise<void> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, skipping pendingNewsRequest clear',
        userId
      });
      return;
    }

    try {
      // Получаем текущую сессию из grammy_sessions
      const { data, error: getError } = await this.client!
        .from('grammy_sessions')
        .select('value')
        .eq('key', userId.toString())
        .single();

      if (getError) {
        if (getError.code === 'PGRST116') {
          // Сессия не найдена
          logger.debug({
            msg: 'User session not found for pendingNewsRequest clear',
            userId
          });
          return;
        }
        logger.error({
          msg: 'Failed to get user session for pendingNewsRequest clear',
          userId,
          error: getError.message
        });
        throw getError;
      }

      const sessionData = data.value;
      if (sessionData && sessionData.pendingNewsRequest) {
        // Удаляем pendingNewsRequest
        delete sessionData.pendingNewsRequest;
        
        // Обновляем сессию
        const { error: updateError } = await this.client!
          .from('grammy_sessions')
          .update({ 
            value: sessionData,
            updated_at: new Date().toISOString()
          })
          .eq('key', userId.toString());

        if (updateError) {
          logger.error({
            msg: 'Failed to update session after pendingNewsRequest clear',
            userId,
            error: updateError.message
          });
          throw updateError;
        }

        logger.info({
          msg: 'PendingNewsRequest cleared from Supabase session',
          userId
        });
      } else {
        logger.debug({
          msg: 'No pendingNewsRequest found in session',
          userId
        });
      }
    } catch (error) {
      logger.error({
        msg: 'Error clearing pendingNewsRequest from Supabase',
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Сохраняет канал в базу данных
   */
  async saveChannel(channelData: Omit<Channel, 'id' | 'created_at' | 'updated_at'>): Promise<Channel | null> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, cannot save channel',
        channelName: channelData.name
      });
      return null;
    }

    try {
      const { data, error } = await this.client!
        .from('channels')
        .insert({
          user_id: channelData.user_id,
          name: channelData.name,
          description: channelData.description,
          sources: channelData.sources,
          channel_username: channelData.channel_username,
          channel_id: channelData.channel_id,
          is_admin_verified: channelData.is_admin_verified,
          ai_prompt: channelData.ai_prompt,
          is_active: channelData.is_active
        })
        .select()
        .single();

      if (error) {
        logger.error({
          msg: 'Failed to save channel',
          channelName: channelData.name,
          error: error.message
        });
        throw error;
      }

      logger.info({
        msg: 'Channel saved successfully',
        channelId: data.id,
        channelName: channelData.name,
        userId: channelData.user_id
      });

      return data;
    } catch (error) {
      logger.error({
        msg: 'Error saving channel',
        channelName: channelData.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Получает каналы пользователя
   */
  async getUserChannels(userId: number): Promise<Channel[]> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, cannot get user channels',
        userId
      });
      return [];
    }

    try {
      const { data, error } = await this.client!
        .from('channels')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error({
          msg: 'Failed to get user channels',
          userId,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'User channels retrieved',
        userId,
        channelsCount: data?.length || 0
      });

      return data || [];
    } catch (error) {
      logger.error({
        msg: 'Error getting user channels',
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Получает канал по ID
   */
  async getChannelById(channelId: string): Promise<Channel | null> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, cannot get channel by ID',
        channelId
      });
      return null;
    }

    try {
      const { data, error } = await this.client!
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.debug({
            msg: 'Channel not found',
            channelId
          });
          return null;
        }
        logger.error({
          msg: 'Failed to get channel by ID',
          channelId,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Channel retrieved by ID',
        channelId,
        channelName: data.name
      });

      return data;
    } catch (error) {
      logger.error({
        msg: 'Error getting channel by ID',
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Обновляет канал
   */
  async updateChannel(channelId: string, updates: Partial<Omit<Channel, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<Channel | null> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, cannot update channel',
        channelId
      });
      return null;
    }

    try {
      const { data, error } = await this.client!
        .from('channels')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', channelId)
        .select()
        .single();

      if (error) {
        logger.error({
          msg: 'Failed to update channel',
          channelId,
          error: error.message
        });
        throw error;
      }

      logger.info({
        msg: 'Channel updated successfully',
        channelId,
        channelName: data.name
      });

      return data;
    } catch (error) {
      logger.error({
        msg: 'Error updating channel',
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Удаляет канал (помечает как неактивный)
   */
  async deleteChannel(channelId: string): Promise<boolean> {
    if (!this.isEnabled) {
      logger.debug({
        msg: 'Supabase disabled, cannot delete channel',
        channelId
      });
      return false;
    }

    try {
      const { error } = await this.client!
        .from('channels')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', channelId);

      if (error) {
        logger.error({
          msg: 'Failed to delete channel',
          channelId,
          error: error.message
        });
        throw error;
      }

      logger.info({
        msg: 'Channel deleted successfully',
        channelId
      });

      return true;
    } catch (error) {
      logger.error({
        msg: 'Error deleting channel',
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}

// Создаем singleton экземпляр
export const supabaseService = new SupabaseService();
