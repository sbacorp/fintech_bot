#!/bin/bash

# Скрипт для запуска FINTECH Telegram Bot

echo "🚀 Starting FINTECH Telegram Bot..."

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy env.example to .env and configure it"
    exit 1
fi

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    exit 1
fi

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

# Установка зависимостей
echo "📦 Installing dependencies..."
npm install

# Сборка проекта
echo "🔨 Building project..."
npm run build

# Запуск приложения
echo "🤖 Starting bot..."
npm start
