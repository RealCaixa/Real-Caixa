CREATE TABLE IF NOT EXISTS pdv_ativacao (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    empresa_id INTEGER NOT NULL,
    filial_id INTEGER NOT NULL,
    pdv_id INTEGER NOT NULL,
    codigo_pdv TEXT NOT NULL,
    device_token TEXT NOT NULL,
    cnpj TEXT,
    plano TEXT,
    status_licenca TEXT NOT NULL DEFAULT 'aguardando_ativacao',
    alerta_offline_dias INTEGER NOT NULL DEFAULT 7,
    ultima_validacao TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
