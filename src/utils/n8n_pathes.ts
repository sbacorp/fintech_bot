import { config } from "../config/index.js";

const N8N_BASE_URL = config.BASE_N8N_WEBHOOK_URL;


export const N8N_WEBHOOK_PATHES = {
    'F85_SEARCH': `${N8N_BASE_URL}/fintech85_search_posts`,
    'F85_CREATE': `${N8N_BASE_URL}/fintech85_create_news`,
    'F85_REGENERATE_POST': `${N8N_BASE_URL}/fintech85_regenerate_post_part`,
    'TP_SEARCH': `${N8N_BASE_URL}/trans_payments_search_posts`,
    'TP_CREATE': `${N8N_BASE_URL}/trans_payments_create_news`,
    'TP_REGENERATE_POST': `${N8N_BASE_URL}/trans_payments_regenerate_post_part`,
}

export const N8N_WEBHOOK_PATHES_BY_ID = {
    'fintech85': {
        'search': N8N_WEBHOOK_PATHES.F85_SEARCH,
        'create': N8N_WEBHOOK_PATHES.F85_CREATE,
        'regenerate_post': N8N_WEBHOOK_PATHES.F85_REGENERATE_POST,
    },
    'trans_payments': {
        'search': N8N_WEBHOOK_PATHES.TP_SEARCH,
        'create': N8N_WEBHOOK_PATHES.TP_CREATE,
        'regenerate_post': N8N_WEBHOOK_PATHES.TP_REGENERATE_POST,
    },
}