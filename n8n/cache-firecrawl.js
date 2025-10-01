// Кэширование запросов к Firecrawl API в n8n
// Этот код нужно вставить в узел "Code" перед Firecrawl запросом

// Получаем URL для кэширования
const url = $input.first().json.link || $input.first().json.url;

// Создаем ключ кэша на основе URL
const cacheKey = `firecrawl_${Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;

// Проверяем кэш
const cachedData = $workflow.getStaticData('global')[cacheKey];

if (cachedData) {
  // Проверяем, не устарел ли кэш (например, старше 1 часа)
  const cacheAge = Date.now() - cachedData.timestamp;
  const maxAge = 60 * 60 * 1000; // 1 час в миллисекундах
  
  if (cacheAge < maxAge) {
    // Возвращаем данные из кэша
    return [{
      json: {
        ...cachedData.data,
        fromCache: true,
        cacheAge: Math.round(cacheAge / 1000 / 60) // возраст в минутах
      }
    }];
  } else {
    // Кэш устарел, удаляем его
    delete $workflow.getStaticData('global')[cacheKey];
  }
}

// Если кэша нет или он устарел, продолжаем с обычным запросом
return [{
  json: {
    url: url,
    shouldFetch: true
  }
}];
