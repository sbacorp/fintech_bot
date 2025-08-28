import axios from 'axios';
import { logger } from '../utils/logger.js';

interface NewsMessage {
  telegramMessage: string;
  messageNumber: number;
  totalMessages: number;
  newsCount: number;
}

interface NewsResponse {
  data?: any;
  success?: boolean;
  error?: string;
}

export class NewsService {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }
  /**
   * Получает новости с n8n webhook
   */
  async fetchNews(): Promise<string> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      logger.info({
        msg: 'Starting news fetch request',
        requestId,
        url: this.webhookUrl,
        timestamp: new Date().toISOString(),
        timeout: 300000,
      });

      // Логируем детали перед запросом
      logger.debug({
        msg: 'Preparing axios request',
        requestId,
        method: 'POST',
        url: this.webhookUrl,
        timeout: 300000,
        userAgent: 'Fintech-Bot/1.0',
      });

      const response = await axios.post(this.webhookUrl, {
        action: 'search_news',
        timestamp: new Date().toISOString()
      }, {
        timeout: 300000, // 5 минут
        headers: {
          'User-Agent': 'Fintech-Bot/1.0',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Content-Type': 'application/json',
        },
        validateStatus: (status) => {
          logger.debug({
            msg: 'Response status received',
            requestId,
            status,
            statusText: status >= 200 && status < 300 ? 'OK' : 'ERROR'
          });
          return status >= 200 && status < 300;
        }
      });

      const duration = Date.now() - startTime;
      
      // Детальное логирование успешного ответа
      logger.info({
        msg: 'News fetch completed successfully',
        requestId,
        duration: `${duration}ms`,
        status: response.status,
        statusText: response.statusText,
        responseSize: JSON.stringify(response.data).length,
        contentType: response.headers['content-type'],
        timestamp: new Date().toISOString(),
      });

      // Логируем структуру данных
      logger.debug({
        msg: 'Response data structure analysis',
        requestId,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        hasNewsProperty: response.data?.news ? 'yes' : 'no',
        newsCount: response.data?.news?.length || 'N/A',
        topLevelKeys: response.data && typeof response.data === 'object' 
          ? Object.keys(response.data).slice(0, 10) 
          : 'not an object',
      });

      // Логируем первые несколько новостей для отладки
      if (response.data?.news && Array.isArray(response.data.news)) {
        logger.debug({
          msg: 'Sample news items',
          requestId,
          sampleNews: response.data.news.slice(0, 2).map((item: any, index: number) => ({
            index,
            title: item?.title?.substring(0, 100) + '...' || 'no title',
            hasDescription: !!item?.description,
            hasLink: !!item?.link,
            hasImage: !!item?.image,
          }))
        });
      }

      return response.data;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Подробное логирование ошибок
      if (axios.isAxiosError(error)) {
        logger.error({
          msg: 'Axios error during news fetch',
          requestId,
          duration: `${duration}ms`,
          errorCode: error.code,
          errorMessage: error.message,
          responseStatus: error.response?.status,
          responseStatusText: error.response?.statusText,
          responseData: error.response?.data,
          requestUrl: error.config?.url,
          requestMethod: error.config?.method,
          requestTimeout: error.config?.timeout,
          isTimeout: error.code === 'ECONNABORTED',
          isNetworkError: error.code === 'ECONNRESET' || error.code === 'ENOTFOUND',
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.error({
          msg: 'Non-axios error during news fetch',
          requestId,
          duration: `${duration}ms`,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
      }

      // Логируем детали для диагностики сети
      logger.error({
        msg: 'Network diagnostics',
        requestId,
        url: this.webhookUrl,
        urlParsed: {
          protocol: new URL(this.webhookUrl).protocol,
          hostname: new URL(this.webhookUrl).hostname,
          port: new URL(this.webhookUrl).port || 'default',
          pathname: new URL(this.webhookUrl).pathname,
        },
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        }
      });

      throw error;
    }
  }

  /**
   * Обрабатывает новости с помощью news-formatter и возвращает сообщения
   */
  processNews(newsData: any): NewsMessage[] {
    try {
      logger.info({
        msg: 'processing news data',
        inputType: typeof newsData,
        hasNews: newsData?.news ? newsData.news.length : 'no news property',
      });

      let allNews: any[] = [];

      // Если newsData это объект с массивом news
      if (newsData && typeof newsData === 'object' && Array.isArray(newsData.news)) {
        allNews = newsData.news;
        logger.info({
          msg: 'found news array in object',
          newsCount: allNews.length,
        });
      }
      // Если newsData это строка (старый формат)
      else if (typeof newsData === 'string') {
        // Эмулируем структуру $input.all() как в n8n
        const mockInput = {
          all: () => [newsData]
        };

        // Обрабатываем каждый элемент массива (копируем логику из news-formatter.js)
        for (const item of mockInput.all()) {
          if (!item) continue;

          try {
            const output = item;

            // Проверяем, является ли output валидным JSON
            let parsed;
            try {
              parsed = JSON.parse(output);
            } catch (e) {
              // Если не валидный JSON, пытаемся извлечь отдельные объекты
              const lines = output.split('\n');
              let currentObject = '';
              let braceCount = 0;

              for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                for (const char of trimmedLine) {
                  if (char === '{') braceCount++;
                  if (char === '}') braceCount--;
                }

                currentObject += trimmedLine;

                if (braceCount === 0 && currentObject.includes('{')) {
                  try {
                    const newsItem = JSON.parse(currentObject);
                    allNews.push(newsItem);
                    currentObject = '';
                  } catch (e) {
                    currentObject = '';
                  }
                }
              }
              continue;
            }

            // Если это объект с массивом новостей
            if (parsed.news && Array.isArray(parsed.news)) {
              allNews = allNews.concat(parsed.news);
            }
            // Если это отдельная новость
            else if (parsed.title) {
              allNews.push(parsed);
            }
          } catch (error) {
            logger.warn('failed to process news item', error);
            continue;
          }
        }
      }
      // Если newsData это массив новостей напрямую
      else if (Array.isArray(newsData)) {
        allNews = newsData;
        logger.info({
          msg: 'received news as array',
          newsCount: allNews.length,
        });
      }

      if (allNews.length === 0) {
        logger.warn('no news found after processing');
        return [];
      }

      // Разделяем новости на группы по 5
      const newsPerMessage = 5;
      const messageGroups = [];
      for (let i = 0; i < allNews.length; i += newsPerMessage) {
        messageGroups.push(allNews.slice(i, i + newsPerMessage));
      }

      const totalMessages = messageGroups.length;
      const results: NewsMessage[] = [];

      // Создаем отдельное сообщение для каждой группы
      messageGroups.forEach((newsGroup, groupIndex) => {
        const messageNumber = groupIndex + 1;

        const formattedNews = newsGroup.map((newsItem, index) => {
          const globalNumber = groupIndex * newsPerMessage + index + 1;
          const title = newsItem.title || 'Без заголовка';
          const summary = newsItem.summary || '';
          const category = newsItem.category || '';
          const urgency = newsItem.urgency || '';
          const url = newsItem.url || '';

          let formattedItem = `${globalNumber}. 📰 ${title}`;

          if (summary) {
            formattedItem += `\n   ${summary}`;
          }

          if (category || urgency) {
            const tags = [];
            if (category) tags.push(`#${category}`);
            if (urgency) {
              // Маппинг английских значений urgency на русские с эмодзи
              let urgencyText = urgency;
              let urgencyEmoji = '📋';
              
              if (urgency === 'high') {
                urgencyText = 'высокая';
                urgencyEmoji = '🔥';
              } else if (urgency === 'medium') {
                urgencyText = 'средняя';
                urgencyEmoji = '⚡';
              } else if (urgency === 'low') {
                urgencyText = 'низкая';
                urgencyEmoji = '📋';
              }
              
              tags.push(`${urgencyEmoji}${urgencyText}`);
            }
            formattedItem += `\n   ${tags.join(' ')}`;
          }

          if (url) {
            formattedItem += `\n   🔗 ${url}`;
          }

          return formattedItem;
        });

        const header = totalMessages > 1
          ? `📈 Новости финансов и криптовалют (часть ${messageNumber}/${totalMessages})\n\n`
          : `📈 Новости финансов и криптовалют (${allNews.length})\n\n`;

        const telegramMessage = header + formattedNews.join('\n\n');

        results.push({
          telegramMessage,
          messageNumber,
          totalMessages,
          newsCount: newsGroup.length
        });
      });

      logger.info({
        msg: 'news processed successfully',
        totalNews: allNews.length,
        totalMessages: results.length,
      });

      return results;

    } catch (error) {
      logger.error({
        msg: 'failed to process news',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Основной метод для получения и обработки новостей
   */
  async fetchAndProcessNews(): Promise<{
    success: boolean;
    messages: NewsMessage[];
    totalNews: number;
    rawNews?: any[];
    error?: string;
  }> {
    try {
      // Получаем новости
      const newsData = await this.fetchNews();

      if (newsData.length === 0) {
        logger.info('no news data received');
        return {
          success: true,
          messages: [],
          totalNews: 0,
        };
      }

      // Обрабатываем новости
      const messages = this.processNews(newsData);

      if (messages.length === 0) {
        logger.info('no valid news found after processing');
        return {
          success: true,
          messages: [],
          totalNews: 0,
        };
      }

      return {
        success: true,
        messages,
        totalNews: messages.reduce((sum, msg) => sum + msg.newsCount, 0),
        rawNews: Array.isArray(newsData) ? newsData : [newsData],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        msg: 'failed to fetch and process news',
        error: errorMessage,
      });

      return {
        success: false,
        messages: [],
        totalNews: 0,
        error: errorMessage,
      };
    }
  }
}
