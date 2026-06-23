CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN (
        'venda_finalizada',
        'caixa_aberto',
        'sangria',
        'suprimento',
        'caixa_fechado',
        'caixa_movimentacao',
        'estoque_movimentado',
        'vendas',
        'caixa',
        'estoque-movimentacoes'
    )),
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'enviado', 'erro')),
    tentativas INTEGER NOT NULL DEFAULT 0,
    ultimo_erro TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enviado_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created
ON sync_queue (status, created_at);
