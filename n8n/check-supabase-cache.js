// Проверка кэша в Supabase перед запросом к Firecrawl
// Этот код нужно вставить в узел "Code" в n8n

const url = $input.first().json.link;

// Запрос к Supabase для проверки кэша
const supabaseUrl = $vars.SUPABASE_URL;
const supabaseKey = $vars.SUPABASE_ANON_KEY;

try {
  const response = await fetch(`${supabaseUrl}/rest/v1/firecrawl_cache?url=eq.${encodeURIComponent(url)}&expires_at=gt.${new Date().toISOString()}`, {
    method: 'GET',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.ok) {
    const data = await response.json();
    
    if (data && data.length > 0) {
      const cacheEntry = data[0];
      
      // Вычисляем возраст кэша в минутах
      const createdAt = new Date(cacheEntry.created_at);
      const now = new Date();
      const cacheAge = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60));
      
      return [{
        json: {
          markdown: cacheEntry.markdown,
          fromCache: true,
          cacheAge: cacheAge,
          url: url
        }
      }];
    }
  }
} catch (error) {
  console.log('Cache check error:', error);
}

// Если кэша нет или ошибка, продолжаем с обычным запросом
return [{
  json: {
    url: url,
    shouldFetch: true
  }
}];
