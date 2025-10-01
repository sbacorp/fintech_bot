// Сохранение результата Firecrawl в кэш
// Этот код нужно вставить в узел "Code" после Firecrawl запроса

// Получаем URL и данные от Firecrawl
const url = $('Extract Data').item.json.link;
const firecrawlData = $input.first().json;

// Создаем ключ кэша на основе URL
const cacheKey = `firecrawl_${Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;

// Сохраняем в кэш с меткой времени
$workflow.getStaticData('global')[cacheKey] = {
  data: firecrawlData,
  timestamp: Date.now(),
  url: url
};

// Возвращаем данные с информацией о кэшировании
return [{
  json: {
    ...firecrawlData,
    fromCache: false,
    cached: true
  }
}];
