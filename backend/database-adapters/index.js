const { createSqlJsAdapter } = require('./sqljsAdapter');
const { createPostgresAdapter } = require('./postgresAdapter');

const PROVIDERS = new Set(['sqljs', 'postgres']);

function currentProvider() {
    const provider = String(process.env.DATABASE_PROVIDER || 'sqljs').trim().toLowerCase();
    if (!PROVIDERS.has(provider)) {
        throw new Error(`DATABASE_PROVIDER invalido: ${provider}. Use sqljs ou postgres.`);
    }
    return provider;
}

function createDatabaseAdapter(options = {}) {
    const provider = options.provider || currentProvider();
    if (provider === 'postgres') {
        return createPostgresAdapter(options);
    }
    return createSqlJsAdapter();
}

module.exports = {
    createDatabaseAdapter,
    currentProvider,
    PROVIDERS: [...PROVIDERS]
};
