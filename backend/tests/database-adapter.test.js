const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let dbFile;

test.beforeEach(() => {
    dbFile = path.join(os.tmpdir(), `realcaixa-adapter-${Date.now()}-${Math.random()}.db`);
    process.env.DATABASE_PROVIDER = 'sqljs';
    process.env.REALCAIXA_DB_PATH = dbFile;
    process.env.JWT_SECRET = 'realcaixa-test-secret';
});

test.afterEach(() => {
    if (dbFile && fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile);
    }
    delete process.env.DATABASE_PROVIDER;
});

test('adapter sql.js inicializa banco e executa comandos sem quebrar API atual', async () => {
    const { createDatabaseAdapter, currentProvider } = require('../database-adapters');
    const adapter = createDatabaseAdapter();

    assert.equal(currentProvider(), 'sqljs');
    assert.equal(adapter.provider, 'sqljs');

    await adapter.connect({ dbPath: dbFile });
    const insert = await adapter.run(
        'INSERT INTO empresas (nome_fantasia, documento, status) VALUES (?, ?, ?)',
        ['Adapter Empresa', '00.000.000/0001-00', 'ativa']
    );
    assert.equal(insert.changes, 1);

    const empresa = await adapter.get('SELECT id, nome_fantasia FROM empresas WHERE documento = ?', ['00.000.000/0001-00']);
    assert.equal(empresa.nome_fantasia, 'Adapter Empresa');
    assert.equal(fs.existsSync(adapter.path()), true);
});

test('facade central expoe interface comum get all run transaction close', async () => {
    const database = require('../database');

    await database.inicializarBanco({ dbPath: dbFile });
    assert.equal(database.providerAtual(), 'sqljs');

    const result = await database.run(
        'INSERT INTO empresas (nome_fantasia, documento, status) VALUES (?, ?, ?)',
        ['Facade Empresa', '00.000.000/0001-01', 'ativa']
    );
    assert.equal(result.changes, 1);

    const rows = await database.all('SELECT * FROM empresas WHERE documento LIKE ?', ['00.000.000/%']);
    assert.ok(rows.length >= 1);

    const row = await database.get('SELECT * FROM empresas WHERE id = ?', [result.lastInsertRowid]);
    assert.equal(row.nome_fantasia, 'Facade Empresa');

    await database.transaction(async () => {
        await database.run(
            'INSERT INTO categorias (empresa_id, nome) VALUES (?, ?)',
            [result.lastInsertRowid, 'Categoria Facade']
        );
    });

    await database.close();
});

test('runtime postgres exige DATABASE_URL para iniciar', async () => {
    const database = require('../database');
    process.env.DATABASE_PROVIDER = 'postgres';
    delete process.env.DATABASE_URL;

    await assert.rejects(() => database.inicializarBanco(), /DATABASE_URL/);
});

test('postgres adapter traduz placeholders e funcoes de data usadas no portal', () => {
    const { toPostgresSql } = require('../database-adapters/postgresAdapter');

    const sql = toPostgresSql(
        "SELECT * FROM produtos WHERE empresa_id = ? AND datetime(updated_at) >= datetime(?) AND date(created_at) >= date('now', '-30 day')"
    );

    assert.equal(
        sql,
        "SELECT * FROM produtos WHERE empresa_id = $1 AND CAST(updated_at AS TIMESTAMP) >= CAST($2 AS TIMESTAMP) AND CAST(created_at AS DATE) >= (CURRENT_DATE - INTERVAL '30 days')"
    );
});

test('postgres adapter conecta quando TEST_DATABASE_URL estiver configurado', { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const { createDatabaseAdapter } = require('../database-adapters');
    const adapter = createDatabaseAdapter({
        provider: 'postgres',
        connectionString: process.env.TEST_DATABASE_URL
    });

    await adapter.connect();
    const row = await adapter.get('SELECT 1 AS ok');
    assert.equal(Number(row.ok), 1);
    await adapter.close();
});

test('factory rejeita provider invalido', () => {
    process.env.DATABASE_PROVIDER = 'mongo';
    const { createDatabaseAdapter } = require('../database-adapters');

    assert.throws(() => createDatabaseAdapter(), /DATABASE_PROVIDER invalido/);
});
