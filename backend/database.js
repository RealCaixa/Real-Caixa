const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { createPostgresAdapter } = require('./database-adapters/postgresAdapter');
const logger = require('./logger');

const DEFAULT_DB_PATH = path.join(__dirname, 'realcaixa.db');
const POSTGRES_SCHEMA_PATH = path.resolve(__dirname, '../database/postgres/schema.sql');
const POSTGRES_REQUIRED_TABLES = [
    'usuarios',
    'contas_receber',
    'contas_pagar',
    'financeiro_categorias',
    'financeiro_lancamentos',
    'sync_logs',
    'pdvs'
];

let db;
let adapter;
let dbPath = process.env.REALCAIXA_DB_PATH || DEFAULT_DB_PATH;
let emTransacao = false;
let provider = 'sqljs';

async function inicializarBanco(options = {}) {
    provider = String(options.provider || process.env.DATABASE_PROVIDER || 'sqljs').toLowerCase();
    if (provider === 'postgres') {
        adapter = createPostgresAdapter(options);
        await adapter.connect();
        await inicializarSchemaPostgresSeNecessario(adapter);
        dbPath = 'postgres';
        return adapter;
    }

    if (provider !== 'sqljs') {
        throw new Error(`DATABASE_PROVIDER invalido: ${provider}. Use sqljs ou postgres.`);
    }

    dbPath = options.dbPath || process.env.REALCAIXA_DB_PATH || DEFAULT_DB_PATH;
    const SQL = await initSqlJs();

    if (fs.existsSync(dbPath)) {
        db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
        db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');
    criarTabelasCloud();
    criarTabelasPreparadasParaSync();
    salvarBanco();

    return db;
}

async function inicializarSchemaPostgresSeNecessario(postgresAdapter) {
    const faltantes = await tabelasPostgresFaltantes(postgresAdapter, POSTGRES_REQUIRED_TABLES);
    if (!faltantes.length) {
        return;
    }

    const schema = fs.readFileSync(POSTGRES_SCHEMA_PATH, 'utf8');
    await postgresAdapter.query(schema);
    logger.info('Schema PostgreSQL inicializado automaticamente', { tabelas_faltantes: faltantes });
}

async function tabelasPostgresFaltantes(postgresAdapter, tabelas) {
    const rows = await postgresAdapter.all(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'`
    );
    const existentes = new Set(rows.map((row) => row.name));

    return tabelas.filter((tabela) => !existentes.has(tabela));
}

function criarTabelasCloud() {
    db.run(`
        CREATE TABLE IF NOT EXISTS empresas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_fantasia TEXT NOT NULL,
            razao_social TEXT,
            documento TEXT,
            telefone TEXT,
            email TEXT,
            status TEXT NOT NULL DEFAULT 'ativa',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            perfil TEXT NOT NULL DEFAULT 'cliente_admin',
            permissoes TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'ativo',
            ultimo_login_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contadores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ativo',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contador_empresas (
            contador_id INTEGER NOT NULL,
            empresa_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pendente',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (contador_id, empresa_id),
            FOREIGN KEY (contador_id) REFERENCES contadores(id),
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS assistente_auditoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            usuario_id INTEGER,
            contador_id INTEGER,
            origem TEXT NOT NULL,
            pergunta TEXT NOT NULL,
            tipo_resposta TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY (contador_id) REFERENCES contadores(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS licencas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            plano TEXT NOT NULL DEFAULT 'basico',
            status TEXT NOT NULL DEFAULT 'ativa',
            limite_usuarios INTEGER NOT NULL DEFAULT 1,
            limite_produtos INTEGER NOT NULL DEFAULT 50,
            limite_vendas_mes INTEGER NOT NULL DEFAULT 100,
            expira_em TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS filiais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
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
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS pdvs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            filial_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            codigo_pdv TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'offline',
            ultimo_sync TEXT,
            versao_app TEXT,
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (empresa_id, codigo_pdv),
            FOREIGN KEY (empresa_id) REFERENCES empresas(id),
            FOREIGN KEY (filial_id) REFERENCES filiais(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            categoria_id INTEGER,
            codigo_interno TEXT NOT NULL,
            codigo_barras TEXT,
            descricao TEXT NOT NULL,
            custo REAL NOT NULL DEFAULT 0,
            preco_venda REAL NOT NULL DEFAULT 0,
            estoque_atual REAL NOT NULL DEFAULT 0,
            estoque_minimo REAL NOT NULL DEFAULT 0,
            unidade TEXT NOT NULL DEFAULT 'UN',
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id),
            FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            produto_id INTEGER NOT NULL,
            tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida', 'ajuste', 'perda', 'inventario')),
            quantidade REAL NOT NULL,
            custo_unitario REAL,
            observacao TEXT,
            usuario_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id),
            FOREIGN KEY (produto_id) REFERENCES produtos(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contas_receber (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            categoria TEXT,
            valor REAL NOT NULL,
            vencimento TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'recebido', 'cancelado')),
            cliente TEXT,
            observacao TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contas_pagar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            categoria TEXT,
            fornecedor TEXT,
            valor REAL NOT NULL,
            vencimento TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'pago', 'cancelado')),
            observacao TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS financeiro_categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK(tipo IN ('receita', 'despesa')),
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida', 'transferencia')),
            descricao TEXT NOT NULL,
            categoria TEXT,
            valor REAL NOT NULL,
            data TEXT NOT NULL,
            observacao TEXT,
            usuario_id INTEGER NOT NULL,
            origem TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    migrarTabelaProdutosLegada();

    db.run('CREATE INDEX IF NOT EXISTS idx_categorias_empresa_nome ON categorias (empresa_id, nome)');
    db.run('CREATE INDEX IF NOT EXISTS idx_produtos_empresa_codigo_interno ON produtos (empresa_id, codigo_interno)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_produtos_empresa_codigo_interno ON produtos (empresa_id, codigo_interno)');
    db.run(`
        CREATE INDEX IF NOT EXISTS idx_produtos_empresa_codigo_barras
        ON produtos (empresa_id, codigo_barras)
        WHERE codigo_barras IS NOT NULL AND codigo_barras <> ''
    `);
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_produtos_empresa_codigo_barras
        ON produtos (empresa_id, codigo_barras)
        WHERE codigo_barras IS NOT NULL AND codigo_barras <> ''
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_produtos_empresa_categoria ON produtos (empresa_id, categoria_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_estoque_mov_empresa_produto ON estoque_movimentacoes (empresa_id, produto_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_estoque_mov_empresa_tipo_data ON estoque_movimentacoes (empresa_id, tipo, created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_vencimento ON contas_receber (empresa_id, vencimento, status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_vencimento ON contas_pagar (empresa_id, vencimento, status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_financeiro_categorias_empresa ON financeiro_categorias (empresa_id, tipo, ativo)');
    db.run('CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_empresa_data ON financeiro_lancamentos (empresa_id, data, tipo)');
    db.run('CREATE INDEX IF NOT EXISTS idx_empresas_updated_at ON empresas (updated_at)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_usuarios_empresa_email ON usuarios (empresa_id, email)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contadores_email ON contadores (email)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contador_empresas_empresa ON contador_empresas (empresa_id, status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contador_empresas_contador ON contador_empresas (contador_id, status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_assistente_auditoria_empresa_data ON assistente_auditoria (empresa_id, created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_assistente_auditoria_tipo ON assistente_auditoria (tipo_resposta, created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_filiais_empresa_ativo ON filiais (empresa_id, ativo)');
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_filiais_empresa_cnpj
        ON filiais (empresa_id, cnpj)
        WHERE cnpj IS NOT NULL AND cnpj <> ''
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_pdvs_empresa_filial ON pdvs (empresa_id, filial_id, ativo)');
    db.run('CREATE INDEX IF NOT EXISTS idx_pdvs_empresa_status ON pdvs (empresa_id, status, ativo)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pdvs_empresa_codigo ON pdvs (empresa_id, codigo_pdv)');

    prepararCamposMultiempresa();
}

function migrarTabelaProdutosLegada() {
    const columns = db.exec('PRAGMA table_info(produtos)')[0]?.values.map((row) => row[1]) || [];

    adicionarColunaSeNaoExiste(columns, 'empresa_id', 'INTEGER');
    adicionarColunaSeNaoExiste(columns, 'categoria_id', 'INTEGER');
    adicionarColunaSeNaoExiste(columns, 'codigo_interno', 'TEXT');
    adicionarColunaSeNaoExiste(columns, 'codigo_barras', 'TEXT');
    adicionarColunaSeNaoExiste(columns, 'descricao', 'TEXT');
    adicionarColunaSeNaoExiste(columns, 'custo', 'REAL NOT NULL DEFAULT 0');
    adicionarColunaSeNaoExiste(columns, 'preco_venda', 'REAL NOT NULL DEFAULT 0');
    adicionarColunaSeNaoExiste(columns, 'estoque_atual', 'REAL NOT NULL DEFAULT 0');
    adicionarColunaSeNaoExiste(columns, 'estoque_minimo', 'REAL NOT NULL DEFAULT 0');
    adicionarColunaSeNaoExiste(columns, 'unidade', "TEXT NOT NULL DEFAULT 'UN'");
    adicionarColunaSeNaoExiste(columns, 'ativo', 'INTEGER NOT NULL DEFAULT 1');
    adicionarColunaSeNaoExiste(columns, 'created_at', 'TEXT');
    adicionarColunaSeNaoExiste(columns, 'updated_at', 'TEXT');

    const updatedColumns = db.exec('PRAGMA table_info(produtos)')[0]?.values.map((row) => row[1]) || [];

    if (updatedColumns.includes('nome')) {
        db.run("UPDATE produtos SET descricao = COALESCE(NULLIF(descricao, ''), nome) WHERE descricao IS NULL OR descricao = ''");
    }
    db.run("UPDATE produtos SET codigo_interno = 'LEGADO-' || id WHERE codigo_interno IS NULL OR codigo_interno = ''");
    db.run("UPDATE produtos SET empresa_id = 0 WHERE empresa_id IS NULL");
    db.run("UPDATE produtos SET unidade = 'UN' WHERE unidade IS NULL OR unidade = ''");
    db.run("UPDATE produtos SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
    db.run("UPDATE produtos SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL");
}

function adicionarColunaSeNaoExiste(columns, column, definition) {
    if (!columns.includes(column)) {
        db.run(`ALTER TABLE produtos ADD COLUMN ${column} ${definition}`);
        columns.push(column);
    }
}

function prepararCamposMultiempresa() {
    adicionarColunaTabelaSeNaoExiste('usuarios', 'acesso_filiais_tipo', "TEXT NOT NULL DEFAULT 'todas'");
    adicionarColunaTabelaSeNaoExiste('usuarios', 'filiais_permitidas', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('produtos', 'filial_id', 'INTEGER');
    adicionarColunaTabelaSeNaoExiste('estoque_movimentacoes', 'filial_id', 'INTEGER');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'device_token_hash', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'machine_id', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'dispositivo_nome', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'licenciamento_status', "TEXT NOT NULL DEFAULT 'aguardando_ativacao'");
    adicionarColunaTabelaSeNaoExiste('pdvs', 'registrado_at', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'ultimo_acesso', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'ultimo_usuario', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'ultima_tentativa_sync', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'ultimo_sync_sucesso', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'ultimo_erro_sync', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'eventos_pendentes', 'INTEGER NOT NULL DEFAULT 0');
    adicionarColunaTabelaSeNaoExiste('pdvs', 'eventos_enviados', 'INTEGER NOT NULL DEFAULT 0');
    adicionarColunaTabelaSeNaoExiste('financeiro_lancamentos', 'filial_id', 'INTEGER');
    adicionarColunaTabelaSeNaoExiste('financeiro_lancamentos', 'pdv_id', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('financeiro_lancamentos', 'venda_uuid', 'TEXT');
    adicionarColunaTabelaSeNaoExiste('financeiro_lancamentos', 'forma_pagamento', 'TEXT');
}

function prepararCamposSyncMultiempresa() {
    adicionarColunaTabelaSeNaoExiste('sync_vendas', 'filial_id', 'INTEGER');
    adicionarColunaTabelaSeNaoExiste('sync_caixa_movimentacoes', 'filial_id', 'INTEGER');
    adicionarColunaTabelaSeNaoExiste('sync_caixa_fechamentos', 'filial_id', 'INTEGER');
}

function adicionarColunaTabelaSeNaoExiste(table, column, definition) {
    const columns = db.exec(`PRAGMA table_info(${table})`)[0]?.values.map((row) => row[1]) || [];
    if (!columns.includes(column)) {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

function criarTabelasPreparadasParaSync() {
    db.run(`
        CREATE TABLE IF NOT EXISTS sync_eventos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            origem TEXT NOT NULL,
            entidade TEXT NOT NULL,
            entidade_id TEXT,
            acao TEXT NOT NULL,
            payload TEXT,
            status TEXT NOT NULL DEFAULT 'pendente',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            processed_at TEXT,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS pdv_dispositivos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            identificador TEXT UNIQUE NOT NULL,
            nome TEXT,
            versao_app TEXT,
            status TEXT NOT NULL DEFAULT 'aguardando',
            ultimo_sync_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sync_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            usuario_id INTEGER,
            recurso TEXT NOT NULL,
            status TEXT NOT NULL,
            last_sync_at TEXT,
            total_registros INTEGER NOT NULL DEFAULT 0,
            erro TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_sync_logs_empresa_data ON sync_logs (empresa_id, created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sync_logs_recurso_status ON sync_logs (recurso, status)');

    db.run(`
        CREATE TABLE IF NOT EXISTS sync_vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            pdv_id TEXT NOT NULL,
            uuid TEXT NOT NULL,
            numero TEXT,
            data_venda TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'finalizada',
            subtotal REAL NOT NULL DEFAULT 0,
            desconto REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL DEFAULT 0,
            operador_nome TEXT,
            payload TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (empresa_id, uuid),
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sync_venda_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            venda_id INTEGER NOT NULL,
            produto_id INTEGER,
            codigo_interno TEXT,
            codigo_barras TEXT,
            descricao TEXT NOT NULL,
            quantidade REAL NOT NULL,
            preco_unitario REAL NOT NULL DEFAULT 0,
            desconto REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id),
            FOREIGN KEY (venda_id) REFERENCES sync_vendas(id),
            FOREIGN KEY (produto_id) REFERENCES produtos(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sync_venda_pagamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            venda_id INTEGER NOT NULL,
            forma TEXT NOT NULL,
            valor REAL NOT NULL,
            nsu TEXT,
            autorizacao TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id),
            FOREIGN KEY (venda_id) REFERENCES sync_vendas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sync_caixa_movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            pdv_id TEXT NOT NULL,
            uuid TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK(tipo IN ('abertura', 'venda', 'sangria', 'suprimento', 'fechamento')),
            valor REAL NOT NULL DEFAULT 0,
            forma_pagamento TEXT,
            observacao TEXT,
            operador_nome TEXT,
            data_movimento TEXT NOT NULL,
            payload TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (empresa_id, uuid),
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sync_caixa_fechamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            pdv_id TEXT NOT NULL,
            uuid TEXT NOT NULL,
            data_abertura TEXT,
            data_fechamento TEXT NOT NULL,
            saldo_inicial REAL NOT NULL DEFAULT 0,
            total_vendas REAL NOT NULL DEFAULT 0,
            total_sangrias REAL NOT NULL DEFAULT 0,
            total_suprimentos REAL NOT NULL DEFAULT 0,
            saldo_final REAL NOT NULL DEFAULT 0,
            operador_nome TEXT,
            payload TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (empresa_id, uuid),
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_sync_vendas_empresa_pdv_data ON sync_vendas (empresa_id, pdv_id, data_venda)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sync_venda_itens_empresa_venda ON sync_venda_itens (empresa_id, venda_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sync_pagamentos_empresa_venda ON sync_venda_pagamentos (empresa_id, venda_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sync_caixa_mov_empresa_data ON sync_caixa_movimentacoes (empresa_id, data_movimento)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sync_caixa_fech_empresa_data ON sync_caixa_fechamentos (empresa_id, data_fechamento)');
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_lanc_empresa_venda_uuid
        ON financeiro_lancamentos (empresa_id, venda_uuid)
        WHERE venda_uuid IS NOT NULL AND venda_uuid <> ''
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_pdvs_empresa_sync ON pdvs (empresa_id, ultimo_sync_sucesso, ultima_tentativa_sync)');

    prepararCamposSyncMultiempresa();

    db.run(`
        CREATE TABLE IF NOT EXISTS pdv_licenciamento_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER,
            filial_id INTEGER,
            pdv_id INTEGER,
            codigo_pdv TEXT,
            evento TEXT NOT NULL,
            status TEXT NOT NULL,
            machine_id TEXT,
            versao_app TEXT,
            mensagem TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id),
            FOREIGN KEY (filial_id) REFERENCES filiais(id),
            FOREIGN KEY (pdv_id) REFERENCES pdvs(id)
        )
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_pdv_lic_logs_pdv_data ON pdv_licenciamento_logs (pdv_id, created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_pdv_lic_logs_empresa_evento ON pdv_licenciamento_logs (empresa_id, evento, created_at)');
}

function garantirBanco() {
    if (provider === 'postgres') {
        if (!adapter) {
            throw new Error('Banco de dados ainda nao foi inicializado.');
        }
        return;
    }

    if (!db) {
        throw new Error('Banco de dados ainda nao foi inicializado.');
    }
}

function salvarBanco() {
    garantirBanco();
    if (provider === 'postgres') {
        return;
    }
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function executarQuery(sql, params = []) {
    return all(sql, params);
}

function executarComando(sql, params = []) {
    return run(sql, params);
}

function buscarUm(sql, params = []) {
    return get(sql, params);
}

async function all(sql, params = []) {
    garantirBanco();
    if (provider === 'postgres') {
        return adapter.all(sql, params);
    }

    const stmt = db.prepare(sql);
    try {
        stmt.bind(params);
        const resultados = [];
        while (stmt.step()) {
            resultados.push(stmt.getAsObject());
        }
        return resultados;
    } finally {
        stmt.free();
    }
}

async function run(sql, params = []) {
    garantirBanco();
    if (provider === 'postgres') {
        return adapter.run(sql, params);
    }

    db.run(sql, params);
    const lastInsertRowid = db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0] || null;
    const changes = db.getRowsModified();
    if (!emTransacao) {
        salvarBanco();
    }
    return { changes, lastInsertRowid };
}

async function get(sql, params = []) {
    if (provider === 'postgres') {
        return adapter.get(sql, params);
    }
    return (await all(sql, params))[0] || null;
}

async function transacao(callback) {
    garantirBanco();
    if (provider === 'postgres') {
        return adapter.transaction(callback);
    }

    db.run('BEGIN TRANSACTION');
    emTransacao = true;
    try {
        const resultado = await callback();
        db.run('COMMIT');
        emTransacao = false;
        salvarBanco();
        return resultado;
    } catch (error) {
        db.run('ROLLBACK');
        emTransacao = false;
        throw error;
    }
}

async function close() {
    if (provider === 'postgres' && adapter) {
        await adapter.close();
        adapter = null;
        return;
    }

    if (db?.close) {
        db.close();
    }
    db = null;
}

function providerAtual() {
    return provider;
}

module.exports = {
    inicializarBanco,
    salvarBanco,
    get,
    all,
    run,
    executarQuery,
    executarComando,
    buscarUm,
    transacao,
    transaction: transacao,
    close,
    providerAtual,
    get db() { return db; },
    get dbPath() { return dbPath; },
    get provider() { return provider; }
};
