const database = require('../backend/database');
const { criarApp } = require('../backend/server');

let app;
let databaseReady;

async function ensureApp() {
    if (!databaseReady) {
        databaseReady = database.inicializarBanco();
    }

    await databaseReady;

    if (!app) {
        app = criarApp();
    }

    return app;
}

module.exports = async function handler(req, res) {
    const expressApp = await ensureApp();
    return expressApp(req, res);
};
