#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки endpoint regenerate_post_part
 * 
 * Использование:
 * node test-regenerate.js [action]
 * 
 * action: regenerate_title | regenerate_text (по умолчанию regenerate_title)
 */

const baseUrl = 'http://localhost:3000';

async function testRegeneratePostPart(action = 'regenerate_title') {
  console.log(`🧪 Тестируем регенерацию: ${action}`);
  console.log('=' * 50);

  try {
    const payload = {
      action: action,
      // Можно передать кастомные значения для тестирования
      current_title: action === 'regenerate_title' ? 
        'Bitcoin не удержал $113K – грядёт новый обвал?' : undefined,
      current_text: action === 'regenerate_text' ? 
        '🛑 Бычий отскок биткоина на $113K провалился: слабый объём и цена дают повод ждать падения ниже $112K. Медведи готовят наступление, а ключевые поддержки под угрозой срыва. Время готовиться к худшему или ждать чудо? 🔥' : undefined
    };

    console.log('📤 Отправляем запрос:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(`${baseUrl}/test/regenerate-post-part`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('\n✅ Ответ получен:');
    console.log('=' * 50);
    
    if (result.success) {
      console.log('🎯 Действие:', result.action);
      console.log('📨 Отправлено в N8N:', JSON.stringify(result.request_data, null, 2));
      console.log('📥 Ответ от N8N:', JSON.stringify(result.n8n_response, null, 2));
      
      if (action === 'regenerate_title' && result.n8n_response?.new_title) {
        console.log('\n📰 Новый заголовок:');
        console.log(`"${result.n8n_response.new_title}"`);
      } else if (action === 'regenerate_text' && result.n8n_response?.new_text) {
        console.log('\n📝 Новый текст:');
        console.log(`"${result.n8n_response.new_text}"`);
      }
      
      console.log('\n📊 Обновленный пост сохранен для пользователя:', result.test_user_id);
      
    } else {
      console.log('❌ Тест провален:', result);
    }

  } catch (error) {
    console.error('💥 Ошибка при тестировании:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Подсказка: Убедись что бот запущен на localhost:3000');
    }
  }
}

// Запуск теста
const action = process.argv[2] || 'regenerate_title';

if (!['regenerate_title', 'regenerate_text'].includes(action)) {
  console.error('❌ Неверное действие. Используй: regenerate_title или regenerate_text');
  process.exit(1);
}

console.log('🚀 Запуск тестирования endpoint regenerate_post_part...\n');
testRegeneratePostPart(action);
