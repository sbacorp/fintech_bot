// Обработка ответа AI агента в n8n
// Этот код нужно вставить в узел "Code" в n8n

// Получаем ответ от AI агента
const aiResponse = $input.first().json;

// Парсим JSON ответ от AI
let parsedResponse;
try {
  // Пытаемся распарсить строку JSON
  parsedResponse = JSON.parse(aiResponse.output || aiResponse);
} catch (error) {
  // Если это уже объект, используем как есть
  parsedResponse = aiResponse.output || aiResponse;
}

// Формируем финальный ответ в стандартном формате
const finalResponse = {
  title: parsedResponse.generated_title || parsedResponse.title,
  content: parsedResponse.generated_post_text || parsedResponse.content,
  hashtags: parsedResponse.hashtags ? 
    parsedResponse.hashtags.split(' ').filter(tag => tag.startsWith('#')) : 
    [],
  image: parsedResponse.main_post_image || parsedResponse.image || null,
  link: $('Extract Data').item.json.link,
  metadata: {
    wordCount: (parsedResponse.generated_post_text || parsedResponse.content || '').length,
    hasEmojis: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(
      parsedResponse.generated_post_text || parsedResponse.content || ''
    ),
    hasHashtags: (parsedResponse.hashtags || '').includes('#')
  },
  // Дополнительные поля для отладки
  originalTitle: parsedResponse.original_title,
  generatedTitle: parsedResponse.generated_title
};

// Возвращаем обработанный результат
return [{ json: finalResponse }];
