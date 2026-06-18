const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'realcaixa.db');

let db;

// Inicializar banco de dados
async function inicializarBanco() {
    const SQL = await initSqlJs();
    
    // Carregar banco existente ou criar novo
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }
    
    // Criar tabelas
    db.run(`
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            telefone TEXT,
            empresa TEXT,
            senha TEXT NOT NULL,
            plano TEXT DEFAULT 'basico',
            status TEXT DEFAULT 'ativo',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            codigo_barras TEXT,
            nome TEXT NOT NULL,
            descricao TEXT,
            preco_custo REAL,
            preco_venda REAL NOT NULL,
            estoque INTEGER DEFAULT 0,
            estoque_minimo INTEGER DEFAULT 10,
            categoria TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            pdv_id TEXT,
            total REAL NOT NULL,
            desconto REAL DEFAULT 0,
            forma_pagamento TEXT,
            status TEXT DEFAULT 'finalizada',
            sincronizada INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS vendas_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venda_id INTEGER NOT NULL,
            produto_id INTEGER NOT NULL,
            quantidade INTEGER NOT NULL,
            preco_unitario REAL NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (venda_id) REFERENCES vendas(id),
            FOREIGN KEY (produto_id) REFERENCES produtos(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS financeiro (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            tipo TEXT CHECK(tipo IN ('entrada', 'saida')) NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            categoria TEXT,
            data DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sangria_suprimento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            pdv_id TEXT,
            tipo TEXT CHECK(tipo IN ('sangria', 'suprimento')) NOT NULL,
            valor REAL NOT NULL,
            observacao TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS pdv_conexoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            pdv_id TEXT UNIQUE NOT NULL,
            ultima_conexao DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'online',
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS backup_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            arquivo TEXT,
            tamanho INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    `);

    // Salvar no disco
    salvarBanco();
    
    console.log('✅ Banco de dados inicializado com sucesso!');
    return db;
}

// Função para salvar banco no disco
function salvarBanco() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

// Função para executar query e retornar resultados
function executarQuery(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        
        const resultados = [];
        while (stmt.step()) {
            resultados.push(stmt.getAsObject());
        }
        stmt.free();
        return resultados;
    } catch (error) {
        console.error('Erro na query:', error);
        throw error;
    }
}

// Função para executar INSERT/UPDATE/DELETE
function executarComando(sql, params = []) {
    try {
        db.run(sql, params);
        salvarBanco();
        return {
            changes: db.getRowsModified(),
            lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0]
        };
    } catch (error) {
        console.error('Erro no comando:', error);
        throw error;
    }
}

// Função para buscar um único registro
function buscarUm(sql, params = []) {
    const resultados = executarQuery(sql, params);
    return resultados.length > 0 ? resultados[0] : null;
}

module.exports = {
    inicializarBanco,
    salvarBanco,
    executarQuery,
    executarComando,
    buscarUm,
    get db() { return db; }
};