const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let server;
let baseUrl;
let dbFile;

test.before(async () => {
    dbFile = path.join(os.tmpdir(), `realcaixa-deploy-${Date.now()}.db`);
    process.env.REALCAIXA_DB_PATH = dbFile;
    process.env.JWT_SECRET = 'realcaixa-test-secret';
    process.env.CORS_ORIGINS = 'https://homolog.realcaixa.test';

    const database = require('../database');
    const { criarApp } = require('../server');

    await database.inicializarBanco({ dbPath: dbFile });
    server = criarApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    if (dbFile && fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile);
    }
    delete process.env.CORS_ORIGINS;
});

test('healthcheck publico informa status e tipo de storage', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'online');
    assert.equal(body.database_driver, 'sql.js');
    assert.equal(body.storage, 'local-file');
    assert.equal(body.persistent_storage, true);
});

test('CORS permite dominio de homologacao configurado', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
        headers: {
            Origin: 'https://homolog.realcaixa.test'
        }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://homolog.realcaixa.test');
});

test('arquivos de deploy para Vercel existem sem publicar automaticamente', () => {
    const root = path.resolve(__dirname, '..', '..');
    const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const serverlessHandler = fs.readFileSync(path.join(root, 'api', 'index.js'), 'utf8');
    const docs = fs.readFileSync(path.join(root, 'docs', 'deploy-homologacao.md'), 'utf8');

    assert.equal(vercel.rewrites[0].destination, '/api/index.js');
    assert.match(serverlessHandler, /criarApp/);
    assert.match(docs, /sql\.js/);
    assert.match(docs, /vercel --prod/);
});
