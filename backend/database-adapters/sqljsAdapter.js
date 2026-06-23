const database = require('../database');

function createSqlJsAdapter() {
    return {
        provider: 'sqljs',

        async connect(options = {}) {
            await database.inicializarBanco(options);
            return this;
        },

        get(sql, params = []) {
            return database.get(sql, params);
        },

        all(sql, params = []) {
            return database.all(sql, params);
        },

        run(sql, params = []) {
            return database.run(sql, params);
        },

        query(sql, params = []) {
            const trimmed = String(sql || '').trim().toLowerCase();
            if (trimmed.startsWith('select') || trimmed.startsWith('pragma')) {
                return this.all(sql, params);
            }
            return this.run(sql, params);
        },

        one(sql, params = []) {
            return this.get(sql, params);
        },

        transaction(callback) {
            return database.transacao(callback);
        },

        save() {
            database.salvarBanco();
        },

        path() {
            return database.dbPath;
        },

        async close() {
            return database.close();
        }
    };
}

module.exports = {
    createSqlJsAdapter
};
