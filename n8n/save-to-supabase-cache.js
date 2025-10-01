// Сохранение результата Firecrawl в Supabase кэш
// Этот код нужно вставить в узел "Code" в n8n

const url = $('Extract Data').item.json.link;
const firecrawlData = $input.first().json;
const markdown = firecrawlData.markdown;

if (!markdown) {
  return [{
    json: {
      ...firecrawlData,
      fromCache: false,
      cached: false,
      error: 'No markdown data to cache'
    }
  }];
}

// Запрос к Supabase для сохранения в кэш
const supabaseUrl = $vars.SUPABASE_URL;
const supabaseKey = $vars.SUPABASE_ANON_KEY;

// Вычисляем время истечения (1 час от сейчас)
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 1);

try {
  const response = await fetch(`${supabaseUrl}/rest/v1/firecrawl_cache`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      url: url,
      markdown: markdown,
      expires_at: expiresAt.toISOString()
    })
  });

  if (response.ok) {
    console.log('Successfully saved to Supabase cache');
    
    return [{
      json: {
        ...firecrawlData,
        fromCache: false,
        cached: true,
        expiresAt: expiresAt.toISOString()
      }
    }];
  } else {
    console.error('Failed to save to cache:', response.status, await response.text());
  }
} catch (error) {
  console.error('Cache save error:', error);
}

// Если не удалось сохранить в кэш, возвращаем данные без кэширования
return [{
  json: {
    ...firecrawlData,
    fromCache: false,
    cached: false,
    error: 'Failed to save to cache'
  }
}];
