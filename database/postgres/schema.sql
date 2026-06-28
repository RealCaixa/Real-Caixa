BEGIN;

CREATE TABLE IF NOT EXISTS empresas (
    id BIGSERIAL PRIMARY KEY,
    nome_fantasia TEXT NOT NULL,
    razao_social TEXT,
    documento TEXT,
    telefone TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'cliente_admin',
    permissoes JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'ativo',
    acesso_filiais_tipo TEXT NOT NULL DEFAULT 'todas',
    filiais_permitidas JSONB,
    ultimo_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contadores (
    id BIGSERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contador_empresas (
    contador_id BIGINT NOT NULL REFERENCES contadores(id),
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (contador_id, empresa_id)
);

CREATE TABLE IF NOT EXISTS assistente_auditoria (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    usuario_id BIGINT REFERENCES usuarios(id),
    contador_id BIGINT REFERENCES contadores(id),
    origem TEXT NOT NULL,
    pergunta TEXT NOT NULL,
    tipo_resposta TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS licencas (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    codigo_licenca TEXT,
    plano TEXT NOT NULL DEFAULT 'basico',
    status TEXT NOT NULL DEFAULT 'ativa',
    limite_usuarios INTEGER NOT NULL DEFAULT 1,
    limite_produtos INTEGER NOT NULL DEFAULT 50,
    limite_vendas_mes INTEGER NOT NULL DEFAULT 100,
    limite_pdvs INTEGER NOT NULL DEFAULT 1,
    limite_filiais INTEGER NOT NULL DEFAULT 1,
    expira_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS filiais (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    nome TEXT NOT NULL,
    cnpj TEXT,
    ie TEXT,
    endereco TEXT,
    numero TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    telefone TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdvs (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    filial_id BIGINT NOT NULL REFERENCES filiais(id),
    nome TEXT NOT NULL,
    codigo_pdv TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'offline',
    ultimo_sync TIMESTAMPTZ,
    versao_app TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    device_token_hash TEXT,
    machine_id TEXT,
    dispositivo_nome TEXT,
    licenciamento_status TEXT NOT NULL DEFAULT 'aguardando_ativacao',
    registrado_at TIMESTAMPTZ,
    ultimo_acesso TIMESTAMPTZ,
    ultimo_usuario TEXT,
    ultima_tentativa_sync TIMESTAMPTZ,
    ultimo_sync_sucesso TIMESTAMPTZ,
    ultimo_erro_sync TEXT,
    eventos_pendentes INTEGER NOT NULL DEFAULT 0,
    eventos_enviados INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, codigo_pdv)
);

CREATE TABLE IF NOT EXISTS licenca_ativacoes (
    id BIGSERIAL PRIMARY KEY,
    licenca_id BIGINT NOT NULL REFERENCES licencas(id),
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    pdv_id BIGINT REFERENCES pdvs(id),
    codigo_pdv TEXT,
    terminal_uuid TEXT,
    hostname TEXT,
    versao_app TEXT,
    device_token_hash TEXT,
    status TEXT NOT NULL DEFAULT 'ativa',
    ativado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_heartbeat_at TIMESTAMPTZ,
    revogado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS licenca_logs (
    id BIGSERIAL PRIMARY KEY,
    licenca_id BIGINT REFERENCES licencas(id),
    empresa_id BIGINT REFERENCES empresas(id),
    ativacao_id BIGINT REFERENCES licenca_ativacoes(id),
    evento TEXT NOT NULL,
    status TEXT NOT NULL,
    mensagem TEXT,
    terminal_uuid TEXT,
    hostname TEXT,
    versao_app TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    nome TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produtos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    filial_id BIGINT,
    categoria_id BIGINT REFERENCES categorias(id),
    codigo_interno TEXT NOT NULL,
    codigo_barras TEXT,
    descricao TEXT NOT NULL,
    custo NUMERIC(14, 2) NOT NULL DEFAULT 0,
    preco_venda NUMERIC(14, 2) NOT NULL DEFAULT 0,
    estoque_atual NUMERIC(14, 3) NOT NULL DEFAULT 0,
    estoque_minimo NUMERIC(14, 3) NOT NULL DEFAULT 0,
    unidade TEXT NOT NULL DEFAULT 'UN',
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    filial_id BIGINT,
    produto_id BIGINT NOT NULL REFERENCES produtos(id),
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida', 'ajuste', 'perda', 'inventario')),
    quantidade NUMERIC(14, 3) NOT NULL,
    custo_unitario NUMERIC(14, 2),
    observacao TEXT,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contas_receber (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    descricao TEXT NOT NULL,
    categoria TEXT,
    valor NUMERIC(14, 2) NOT NULL,
    vencimento DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'recebido', 'cancelado')),
    cliente TEXT,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contas_pagar (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    descricao TEXT NOT NULL,
    categoria TEXT,
    fornecedor TEXT,
    valor NUMERIC(14, 2) NOT NULL,
    vencimento DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'pago', 'cancelado')),
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financeiro_categorias (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('receita', 'despesa')),
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida', 'transferencia')),
    descricao TEXT NOT NULL,
    categoria TEXT,
    valor NUMERIC(14, 2) NOT NULL,
    data DATE NOT NULL,
    observacao TEXT,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
    origem TEXT,
    filial_id BIGINT,
    pdv_id TEXT,
    venda_uuid TEXT,
    forma_pagamento TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_eventos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    origem TEXT NOT NULL,
    entidade TEXT NOT NULL,
    entidade_id TEXT,
    acao TEXT NOT NULL,
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pdv_dispositivos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    identificador TEXT UNIQUE NOT NULL,
    nome TEXT,
    versao_app TEXT,
    status TEXT NOT NULL DEFAULT 'aguardando',
    ultimo_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_logs (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    usuario_id BIGINT REFERENCES usuarios(id),
    recurso TEXT NOT NULL,
    status TEXT NOT NULL,
    last_sync_at TIMESTAMPTZ,
    total_registros INTEGER NOT NULL DEFAULT 0,
    erro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_vendas (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    filial_id BIGINT,
    pdv_id TEXT NOT NULL,
    uuid TEXT NOT NULL,
    numero TEXT,
    data_venda TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'finalizada',
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
    desconto NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    operador_nome TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, uuid)
);

CREATE TABLE IF NOT EXISTS sync_venda_itens (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    venda_id BIGINT NOT NULL REFERENCES sync_vendas(id),
    produto_id BIGINT REFERENCES produtos(id),
    codigo_interno TEXT,
    codigo_barras TEXT,
    descricao TEXT NOT NULL,
    quantidade NUMERIC(14, 3) NOT NULL,
    preco_unitario NUMERIC(14, 2) NOT NULL DEFAULT 0,
    desconto NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_venda_pagamentos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    venda_id BIGINT NOT NULL REFERENCES sync_vendas(id),
    forma TEXT NOT NULL,
    valor NUMERIC(14, 2) NOT NULL,
    nsu TEXT,
    autorizacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_caixa_movimentacoes (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    filial_id BIGINT,
    pdv_id TEXT NOT NULL,
    uuid TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('abertura', 'venda', 'sangria', 'suprimento', 'fechamento')),
    valor NUMERIC(14, 2) NOT NULL DEFAULT 0,
    forma_pagamento TEXT,
    observacao TEXT,
    operador_nome TEXT,
    data_movimento TIMESTAMPTZ NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, uuid)
);

CREATE TABLE IF NOT EXISTS sync_caixa_fechamentos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    filial_id BIGINT,
    pdv_id TEXT NOT NULL,
    uuid TEXT NOT NULL,
    data_abertura TIMESTAMPTZ,
    data_fechamento TIMESTAMPTZ NOT NULL,
    saldo_inicial NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_vendas NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_sangrias NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_suprimentos NUMERIC(14, 2) NOT NULL DEFAULT 0,
    saldo_final NUMERIC(14, 2) NOT NULL DEFAULT 0,
    operador_nome TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, uuid)
);

CREATE TABLE IF NOT EXISTS pdv_licenciamento_logs (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT REFERENCES empresas(id),
    filial_id BIGINT REFERENCES filiais(id),
    pdv_id BIGINT REFERENCES pdvs(id),
    codigo_pdv TEXT,
    evento TEXT NOT NULL,
    status TEXT NOT NULL,
    machine_id TEXT,
    versao_app TEXT,
    mensagem TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categorias_empresa_nome ON categorias (empresa_id, nome);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_produtos_empresa_codigo_interno ON produtos (empresa_id, codigo_interno);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_produtos_empresa_codigo_barras ON produtos (empresa_id, codigo_barras) WHERE codigo_barras IS NOT NULL AND codigo_barras <> '';
CREATE INDEX IF NOT EXISTS idx_produtos_empresa_categoria ON produtos (empresa_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_empresa_produto ON estoque_movimentacoes (empresa_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_empresa_tipo_data ON estoque_movimentacoes (empresa_id, tipo, created_at);
CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_vencimento ON contas_receber (empresa_id, vencimento, status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_vencimento ON contas_pagar (empresa_id, vencimento, status);
CREATE INDEX IF NOT EXISTS idx_financeiro_categorias_empresa ON financeiro_categorias (empresa_id, tipo, ativo);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_empresa_data ON financeiro_lancamentos (empresa_id, data, tipo);
CREATE INDEX IF NOT EXISTS idx_empresas_updated_at ON empresas (updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_usuarios_empresa_email ON usuarios (empresa_id, email);
CREATE INDEX IF NOT EXISTS idx_contadores_email ON contadores (email);
CREATE INDEX IF NOT EXISTS idx_contador_empresas_empresa ON contador_empresas (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_contador_empresas_contador ON contador_empresas (contador_id, status);
CREATE INDEX IF NOT EXISTS idx_assistente_auditoria_empresa_data ON assistente_auditoria (empresa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistente_auditoria_tipo ON assistente_auditoria (tipo_resposta, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_licencas_codigo ON licencas (codigo_licenca) WHERE codigo_licenca IS NOT NULL AND codigo_licenca <> '';
CREATE INDEX IF NOT EXISTS idx_licencas_empresa_status ON licencas (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_lic_ativacoes_empresa_status ON licenca_ativacoes (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_lic_ativacoes_licenca_status ON licenca_ativacoes (licenca_id, status);
CREATE INDEX IF NOT EXISTS idx_lic_ativacoes_terminal ON licenca_ativacoes (empresa_id, terminal_uuid);
CREATE INDEX IF NOT EXISTS idx_lic_logs_empresa_data ON licenca_logs (empresa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_filiais_empresa_ativo ON filiais (empresa_id, ativo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_filiais_empresa_cnpj ON filiais (empresa_id, cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '';
CREATE INDEX IF NOT EXISTS idx_pdvs_empresa_filial ON pdvs (empresa_id, filial_id, ativo);
CREATE INDEX IF NOT EXISTS idx_pdvs_empresa_status ON pdvs (empresa_id, status, ativo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pdvs_empresa_codigo ON pdvs (empresa_id, codigo_pdv);
CREATE INDEX IF NOT EXISTS idx_sync_logs_empresa_data ON sync_logs (empresa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_recurso_status ON sync_logs (recurso, status);
CREATE INDEX IF NOT EXISTS idx_sync_vendas_empresa_pdv_data ON sync_vendas (empresa_id, pdv_id, data_venda);
CREATE INDEX IF NOT EXISTS idx_sync_venda_itens_empresa_venda ON sync_venda_itens (empresa_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_sync_pagamentos_empresa_venda ON sync_venda_pagamentos (empresa_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_sync_caixa_mov_empresa_data ON sync_caixa_movimentacoes (empresa_id, data_movimento);
CREATE INDEX IF NOT EXISTS idx_sync_caixa_fech_empresa_data ON sync_caixa_fechamentos (empresa_id, data_fechamento);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_lanc_empresa_venda_uuid ON financeiro_lancamentos (empresa_id, venda_uuid) WHERE venda_uuid IS NOT NULL AND venda_uuid <> '';
CREATE INDEX IF NOT EXISTS idx_pdvs_empresa_sync ON pdvs (empresa_id, ultimo_sync_sucesso, ultima_tentativa_sync);
CREATE INDEX IF NOT EXISTS idx_pdv_lic_logs_pdv_data ON pdv_licenciamento_logs (pdv_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pdv_lic_logs_empresa_evento ON pdv_licenciamento_logs (empresa_id, evento, created_at);

COMMIT;
