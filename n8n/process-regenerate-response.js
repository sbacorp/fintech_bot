// Обработка ответа AI агента для перегенерации в n8n
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

// Получаем действие из исходных данных
const action = $('Extract Data').item.json.action;

// Формируем ответ в зависимости от действия
let finalResponse = {};

if (action === 'regenerate_title' && parsedResponse.new_title) {
  finalResponse = {
    new_title: parsedResponse.new_title,
    success: true,
    action: 'regenerate_title'
  };
} else if (action === 'regenerate_text' && parsedResponse.new_text) {
  finalResponse = {
    new_text: parsedResponse.new_text,
    success: true,
    action: 'regenerate_text'
  };
} else {
  finalResponse = {
    success: false,
    error: 'Не удалось получить новый контент от AI',
    action: action
  };
}

// Возвращаем обработанный результат
return [{ json: finalResponse }];
