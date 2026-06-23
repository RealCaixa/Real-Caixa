const fs = require('fs');
const path = require('path');
const { createDatabaseAdapter } = require('../database-adapters');

const REQUIRED_TABLES = [
    'empresas',
    'usuarios',
    'licencas',
    'categorias',
    'produtos',
    'filiais',
    'pdvs',
    'sync_logs',
    'assistente_auditoria'
];

async function main() {
    if (String(process.env.DATABASE_PROVIDER || '').toLowerCase() !== 'postgres') {
        throw new Error('Defina DATABASE_PROVIDER=postgres antes de executar db:postgres:init.');
    }

    if (!process.env.DATABASE_URL) {
        throw new Error('Defina DATABASE_URL com a connection string do PostgreSQL.');
    }

    const schemaPath = path.resolve(__dirname, '../../database/postgres/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const adapter = createDatabaseAdapter({ provider: 'postgres' });

    try {
        await adapter.connect();
        await adapter.query(schema);
        await validarTabelas(adapter);
        console.log('Schema PostgreSQL aplicado e validado com sucesso.');
    } finally {
        await adapter.close();
    }
}

async function validarTabelas(adapter) {
    const rows = await adapter.all(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const existentes = new Set(rows.map((row) => row.name));
    const ausentes = REQUIRED_TABLES.filter((table) => !existentes.has(table));

    if (ausentes.length) {
        throw new Error(`Schema aplicado, mas faltam tabelas obrigatorias: ${ausentes.join(', ')}`);
    }
}

main().catch((error) => {
    console.error(`Falha ao inicializar PostgreSQL: ${error.message}`);
    process.exitCode = 1;
});
