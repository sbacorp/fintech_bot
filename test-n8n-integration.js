// Простой тест для проверки интеграции с N8N_WEBHOOK_PATHES_BY_ID
import { N8N_WEBHOOK_PATHES_BY_ID } from './src/utils/n8n_pathes.js';

console.log('🔍 Тестирование N8N_WEBHOOK_PATHES_BY_ID:');
console.log('');

// Проверяем структуру данных
console.log('📋 Доступные каналы:');
Object.keys(N8N_WEBHOOK_PATHES_BY_ID).forEach(channelId => {
  const channelPaths = N8N_WEBHOOK_PATHES_BY_ID[channelId];
  console.log(`  ${channelId}:`);
  console.log(`    - search: ${channelPaths.search ? '✅' : '❌'}`);
  console.log(`    - create: ${channelPaths.create ? '✅' : '❌'}`);
  console.log(`    - regenerate_post: ${channelPaths.regenerate_post ? '✅' : '❌'}`);
  console.log('');
});

// Проверяем конкретные URL'ы
console.log('🔗 URL\'ы для fintech85:');
const fintech85Paths = N8N_WEBHOOK_PATHES_BY_ID.fintech85;
if (fintech85Paths) {
  console.log(`  Search: ${fintech85Paths.search}`);
  console.log(`  Create: ${fintech85Paths.create}`);
  console.log(`  Regenerate: ${fintech85Paths.regenerate_post}`);
}

console.log('');
console.log('🔗 URL\'ы для trans_payments:');
const transPaymentsPaths = N8N_WEBHOOK_PATHES_BY_ID.trans_payments;
if (transPaymentsPaths) {
  console.log(`  Search: ${transPaymentsPaths.search}`);
  console.log(`  Create: ${transPaymentsPaths.create}`);
  console.log(`  Regenerate: ${transPaymentsPaths.regenerate_post}`);
}

console.log('');
console.log('✅ Тест завершен!');
