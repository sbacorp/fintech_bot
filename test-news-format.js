// Тестовый скрипт для проверки нового формата данных
import { NewsService } from './src/services/news-service.js';

// Тестовые данные в новом формате
const testNewsData = {
  news: [
    {
      "title": "SoFi внедряет Bitcoin Lightning Network для международных переводов с Lightspark",
      "url": "https://www.coindesk.com/business/2025/08/19/sofi-taps-bitcoin-lightning-network-for-global-remittances-with-lightspark",
      "summary": "Финтех-компания SoFi интегрирует технологию Lightning Network для осуществления мгновенных международных переводов с низкими комиссиями через свое приложение",
      "category": "payments",
      "urgency": "high",
      "publish_date": "2025-08-19"
    },
    {
      "title": "Robinhood запускает рынки предсказаний для NFL и студенческого футбола",
      "url": "https://www.coindesk.com/business/2025/08/19/robinhood-partners-with-kalshi-to-launch-pro-and-college-football-prediction-markets",
      "summary": "Брокерская платформа Robinhood в партнерстве с Kalshi запускает регулируемые CFTC контракты на предсказания результатов футбольных матчей",
      "category": "startups",
      "urgency": "medium",
      "publish_date": "2025-08-19"
    },
    {
      "title": "Bitcoin падает ниже $114 тыс, Ethereum теряет $4,2 тыс",
      "url": "https://www.coindesk.com/markets/2025/08/19/bitcoin-drops-below-usd114k-ether-loses-usd4-2k-as-jackson-hole-speech-might-bring-hawkish-surprise",
      "summary": "Основные криптовалюты демонстрируют снижение на фоне ожиданий ястребиной риторики в выступлении на симпозиуме в Джексон-Хоул",
      "category": "crypto",
      "urgency": "high",
      "publish_date": "2025-08-19"
    },
    {
      "title": "Председатель банковского комитета Сената: 12-18 демократов могут поддержать законопроект о структуре рынка",
      "url": "https://www.coindesk.com/policy/2025/08/19/senate-banking-chair-tim-scott-12-18-dems-may-vote-for-market-structure-bill",
      "summary": "Ожидается широкая поддержка законопроекта о регулировании криптовалютного рынка среди демократов",
      "category": "regulation",
      "urgency": "medium",
      "publish_date": "2025-08-19"
    },
    {
      "title": "TeraWulf привлекает $850 млн через конвертируемые облигации после сделки с Google",
      "url": "https://www.coindesk.com/business/2025/08/19/terawulf-rally-cools-on-usd850m-convertible-note-sale-after-google-deal",
      "summary": "Майнинговая компания выпускает конвертируемые облигации для расширения дата-центров после партнерства с Google",
      "category": "startups",
      "urgency": "medium",
      "publish_date": "2025-08-19"
    }
  ]
};

// Создаем экземпляр NewsService (webhook URL не важен для тестирования)
const newsService = new NewsService('test-url');

// Тестируем обработку новостей
console.log('Тестирование нового формата данных...\n');

const messages = newsService.processNews(testNewsData);

console.log(`Общее количество сообщений: ${messages.length}`);
console.log(`Общее количество новостей: ${messages.reduce((sum, msg) => sum + msg.newsCount, 0)}\n`);

// Выводим каждое сообщение
messages.forEach((message, index) => {
  console.log(`=== Сообщение ${index + 1} ===`);
  console.log(message.telegramMessage);
  console.log(`\nСтатистика: ${message.newsCount} новостей, сообщение ${message.messageNumber}/${message.totalMessages}\n`);
});
