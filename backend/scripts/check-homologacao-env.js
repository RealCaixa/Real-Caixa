const database = require('../database');

const REQUIRED_TABLES = [
    'empresas',
    'usuarios',
    'licencas',
    'produtos',
    'categorias',
    'filiais',
    'pdvs',
    'sync_logs',
    'assistente_auditoria'
];

async function main() {
    await database.inicializarBanco();

    const provider = database.providerAtual();
    const tables = await listarTabelas(provider);
    const missing = REQUIRED_TABLES.filter((table) => !tables.includes(table));

    const report = {
        ok: missing.length === 0,
        app_version: require('../package.json').version,
        database_provider: provider,
        database_path: database.dbPath,
        postgres_connected: provider === 'postgres',
        storage: process.env.VERCEL ? 'serverless-ephemeral' : 'persistent-or-local',
        required_tables: REQUIRED_TABLES.length,
        missing_tables: missing,
        checked_at: new Date().toISOString()
    };

    console.log(JSON.stringify(report, null, 2));
    await database.close();

    if (!report.ok) {
        process.exitCode = 1;
    }
}

async function listarTabelas(provider) {
    if (provider === 'postgres') {
        const rows = await database.all(
            `SELECT table_name AS name
             FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
             ORDER BY table_name`
        );
        return rows.map((row) => row.name);
    }

    const rows = await database.all(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    return rows.map((row) => row.name);
}

main().catch(async (error) => {
    console.error(JSON.stringify({
        ok: false,
        erro: error.message,
        checked_at: new Date().toISOString()
    }, null, 2));

    try {
        await database.close();
    } catch (_) {
        // Nada a fechar.
    }

    process.exit(1);
});
