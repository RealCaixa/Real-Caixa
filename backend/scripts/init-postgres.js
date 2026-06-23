const fs = require('fs');
const path = require('path');
const { createDatabaseAdapter } = require('../database-adapters');

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
        console.log('Schema PostgreSQL aplicado com sucesso.');
    } finally {
        await adapter.close();
    }
}

main().catch((error) => {
    console.error(`Falha ao inicializar PostgreSQL: ${error.message}`);
    process.exitCode = 1;
});
