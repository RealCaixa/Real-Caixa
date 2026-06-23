function loadPg() {
    try {
        return require('pg');
    } catch (error) {
        const missing = new Error('Dependencia pg nao instalada. Execute npm install antes de usar DATABASE_PROVIDER=postgres.');
        missing.cause = error;
        throw missing;
    }
}

function sslConfig() {
    if (process.env.DATABASE_SSL === 'false') {
        return false;
    }

    return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' };
}

function createPostgresAdapter(options = {}) {
    const { Pool } = loadPg();
    const connectionString = options.connectionString || process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL e obrigatoria quando DATABASE_PROVIDER=postgres.');
    }

    const pool = new Pool({
        connectionString,
        ssl: sslConfig(),
        max: Number(process.env.DATABASE_POOL_MAX || 5),
        idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000)
    });

    return {
        provider: 'postgres',

        async connect() {
            const client = await pool.connect();
            client.release();
            return this;
        },

        async all(sql, params = []) {
            const result = await pool.query(toPostgresSql(sql), params);
            return result.rows;
        },

        async get(sql, params = []) {
            const result = await pool.query(toPostgresSql(sql), params);
            return result.rows[0] || null;
        },

        async run(sql, params = []) {
            const normalized = withReturningId(toPostgresSql(sql));
            const result = await pool.query(normalized, params);
            return {
                changes: result.rowCount,
                lastInsertRowid: result.rows[0]?.id || null
            };
        },

        async query(sql, params = []) {
            const trimmed = String(sql || '').trim().toLowerCase();
            if (trimmed.startsWith('select') || trimmed.startsWith('with')) {
                return this.all(sql, params);
            }
            return this.run(sql, params);
        },

        async one(sql, params = []) {
            return this.get(sql, params);
        },

        async transaction(callback) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const result = await callback({
                    all: async (sql, params = []) => (await client.query(toPostgresSql(sql), params)).rows,
                    get: async (sql, params = []) => (await client.query(toPostgresSql(sql), params)).rows[0] || null,
                    run: async (sql, params = []) => {
                        const result = await client.query(withReturningId(toPostgresSql(sql)), params);
                        return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id || null };
                    }
                });
                await client.query('COMMIT');
                return result;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        },

        async close() {
            await pool.end();
        }
    };
}

function toPostgresSql(sql) {
    let index = 0;
    return normalizeSqliteFunctions(sql).replace(/\?/g, () => {
        index += 1;
        return `$${index}`;
    });
}

function normalizeSqliteFunctions(sql) {
    return String(sql)
        .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
        .replace(/date\('now'\s*,\s*'-([0-9]+) day'\)/gi, "(CURRENT_DATE - INTERVAL '$1 days')")
        .replace(/date\('now'\)/gi, 'CURRENT_DATE')
        .replace(/\bdatetime\(([^()]+)\)/gi, 'CAST($1 AS TIMESTAMP)')
        .replace(/\bdate\(([^()]+)\)/gi, 'CAST($1 AS DATE)');
}

function withReturningId(sql) {
    const trimmed = String(sql || '').trim();
    if (!/^insert\s+into/i.test(trimmed) || /\breturning\b/i.test(trimmed)) {
        return sql;
    }

    return `${trimmed.replace(/;$/, '')} RETURNING id`;
}

module.exports = {
    createPostgresAdapter,
    toPostgresSql
};
