import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from './logger.js';

interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryCondition?: (error: any) => boolean;
}

const defaultRetryConfig: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 секунда
  maxDelay: 30000, // 30 секунд
  retryCondition: (error) => {
    // Ретраим только сетевые ошибки и 5xx ошибки
    return error.code === 'ECONNRESET' || 
           error.code === 'ENOTFOUND' || 
           error.code === 'ECONNABORTED' ||
           (error.response && error.response.status >= 500);
  }
};

/**
 * HTTP клиент с автоматическими повторными попытками
 */
export class HttpClient {
  /**
   * Выполняет GET запрос с retry логикой
   */
  static async get<T = any>(
    url: string, 
    config?: AxiosRequestConfig, 
    retryConfig?: RetryConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(() => axios.get<T>(url, config), url, 'GET', retryConfig);
  }

  /**
   * Выполняет POST запрос с retry логикой
   */
  static async post<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig, 
    retryConfig?: RetryConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(() => axios.post<T>(url, data, config), url, 'POST', retryConfig);
  }

  /**
   * Внутренняя функция для выполнения запросов с retry
   */
  private static async executeWithRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    url: string,
    method: string,
    retryConfig?: RetryConfig
  ): Promise<AxiosResponse<T>> {
    const config = { ...defaultRetryConfig, ...retryConfig };
    const requestId = Math.random().toString(36).substring(7);
    
    let lastError: any;
    
    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      const isRetry = attempt > 1;
      const startTime = Date.now();
      
      try {
        if (isRetry) {
          logger.info({
            msg: 'Retrying HTTP request',
            requestId,
            attempt,
            maxRetries: config.maxRetries,
            url,
            method,
          });
        } else {
          logger.debug({
            msg: 'Starting HTTP request',
            requestId,
            url,
            method,
          });
        }

        const response = await requestFn();
        const duration = Date.now() - startTime;
        
        logger.info({
          msg: isRetry ? 'HTTP retry succeeded' : 'HTTP request succeeded',
          requestId,
          attempt,
          duration: `${duration}ms`,
          status: response.status,
          url,
          method,
        });
        
        return response;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        lastError = error;
        
        // Логируем ошибку
        if (axios.isAxiosError(error)) {
          logger.error({
            msg: 'HTTP request failed',
            requestId,
            attempt,
            duration: `${duration}ms`,
            url,
            method,
            errorCode: error.code,
            errorMessage: error.message,
            responseStatus: error.response?.status,
            isNetworkError: error.code === 'ECONNRESET' || error.code === 'ENOTFOUND',
            willRetry: attempt <= config.maxRetries && config.retryCondition(error),
          });
        }
        
        // Проверяем, нужно ли повторить запрос
        if (attempt <= config.maxRetries && config.retryCondition(error)) {
          const delay = Math.min(
            config.baseDelay * Math.pow(2, attempt - 1), 
            config.maxDelay
          );
          
          logger.info({
            msg: 'Waiting before retry',
            requestId,
            attempt,
            delayMs: delay,
            nextAttempt: attempt + 1,
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Если достигли максимума попыток или ошибка не подлежит retry
        logger.error({
          msg: 'HTTP request failed permanently',
          requestId,
          attempts: attempt,
          maxRetries: config.maxRetries,
          url,
          method,
          finalError: axios.isAxiosError(error) ? {
            code: error.code,
            message: error.message,
            status: error.response?.status
          } : String(error)
        });
        
        throw error;
      }
    }
    
    throw lastError;
  }
}

/**
 * Проверяет доступность URL
 */
export async function checkUrlAvailability(url: string): Promise<boolean> {
  try {
    const response = await HttpClient.get(url, { timeout: 10000 }, { maxRetries: 1 });
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    logger.warn({
      msg: 'URL availability check failed',
      url,
      error: axios.isAxiosError(error) ? error.message : String(error)
    });
    return false;
  }
}
