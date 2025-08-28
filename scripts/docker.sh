#!/bin/bash

# Скрипт для управления Docker контейнерами Fintech Bot

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Проверка наличия .env файла
check_env() {
    if [ ! -f ".env" ]; then
        error "Файл .env не найден!"
        info "Скопируйте env.example в .env и настройте переменные окружения"
        exit 1
    fi
}

# Проверка Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker не установлен!"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose не установлен!"
        exit 1
    fi
}

# Создание директории для логов
create_logs_dir() {
    if [ ! -d "logs" ]; then
        log "Создание директории logs..."
        mkdir -p logs
    fi
}

# Функции команд
build() {
    log "Сборка Docker образа..."
    docker-compose build
    log "Сборка завершена!"
}

start() {
    log "Запуск контейнеров..."
    docker-compose up -d
    log "Контейнеры запущены!"
    info "Для просмотра логов используйте: ./scripts/docker.sh logs"
}

stop() {
    log "Остановка контейнеров..."
    docker-compose down
    log "Контейнеры остановлены!"
}

restart() {
    log "Перезапуск контейнеров..."
    docker-compose down
    docker-compose up -d
    log "Контейнеры перезапущены!"
}

rebuild() {
    log "Пересборка с очисткой кэша..."
    docker-compose build --no-cache
    log "Пересборка завершена!"
}

logs() {
    log "Показать логи контейнера..."
    docker-compose logs -f fintech-bot
}

status() {
    log "Статус контейнеров:"
    docker-compose ps
}

shell() {
    log "Вход в контейнер..."
    docker-compose exec fintech-bot sh
}

clean() {
    warn "Очистка Docker ресурсов..."
    docker-compose down --rmi all --volumes --remove-orphans
    docker system prune -f
    log "Очистка завершена!"
}

help() {
    echo "Использование: $0 [команда]"
    echo ""
    echo "Команды:"
    echo "  build     - Собрать Docker образ"
    echo "  start     - Запустить контейнеры"
    echo "  stop      - Остановить контейнеры"
    echo "  restart   - Перезапустить контейнеры"
    echo "  rebuild   - Пересобрать образ с очисткой кэша"
    echo "  logs      - Показать логи контейнера"
    echo "  status    - Показать статус контейнеров"
    echo "  shell     - Войти в контейнер"
    echo "  clean     - Очистить все Docker ресурсы"
    echo "  help      - Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0 build && $0 start"
    echo "  $0 logs"
    echo "  $0 restart"
}

# Основная логика
main() {
    check_docker
    check_env
    create_logs_dir
    
    case "${1:-help}" in
        build)
            build
            ;;
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        rebuild)
            rebuild
            ;;
        logs)
            logs
            ;;
        status)
            status
            ;;
        shell)
            shell
            ;;
        clean)
            clean
            ;;
        help|--help|-h)
            help
            ;;
        *)
            error "Неизвестная команда: $1"
            help
            exit 1
            ;;
    esac
}

# Запуск скрипта
main "$@"
