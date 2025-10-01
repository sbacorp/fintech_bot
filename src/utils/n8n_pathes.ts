import { config } from "../config/index.js";

const N8N_BASE_URL = config.BASE_N8N_WEBHOOK_URL;


export const N8N_WEBHOOK_PATHES = {
    'SEARCH': `${N8N_BASE_URL}/search_posts`,
    'CREATE': `${N8N_BASE_URL}/create_news`,
    'REGENERATE': `${N8N_BASE_URL}/regenerate_post`,
}

export const N8N_WEBHOOK_PATHES_BY_ID = {
    'fintech85': {
        'search': N8N_WEBHOOK_PATHES.SEARCH,
        'create': N8N_WEBHOOK_PATHES.CREATE,
        'regenerate_post': N8N_WEBHOOK_PATHES.REGENERATE,
    },
    'trans_payments': {
        'search': N8N_WEBHOOK_PATHES.SEARCH,
        'create': N8N_WEBHOOK_PATHES.CREATE,
        'regenerate_post': N8N_WEBHOOK_PATHES.REGENERATE,
    },
}