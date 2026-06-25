const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const database = require('./database');
const logger = require('./logger');
const authRoutes = require('./auth/routes');
const userRoutes = require('./users/routes');
const categoriasRoutes = require('./categorias/routes');
const produtosRoutes = require('./produtos/routes');
const estoqueRoutes = require('./estoque/routes');
const financeiroRoutes = require('./financeiro/routes');
const syncRoutes = require('./sync/routes');
const filiaisRoutes = require('./filiais/routes');
const pdvsRoutes = require('./pdvs/routes');
const licencaRoutes = require('./licencas/routes');
const contadorRoutes = require('./contador/routes');
const assistenteRoutes = require('./assistente/routes');

const PUBLIC = path.join(__dirname, 'public');
const DOWNLOADS = path.join(__dirname, '..', 'download');
const VERSION = '2.1.0';
const DEFAULT_HOMOLOGACAO_ORIGIN = 'https://realcaixa-homologacao.vercel.app';
const PORTAL_ROUTES = [
    '/dashboard',
    '/produtos',
    '/categorias',
    '/estoque',
    '/estoque/entrada',
    '/estoque/ajuste',
    '/estoque/perdas',
    '/estoque/inventario',
    '/estoque/movimentacoes',
    '/financeiro',
    '/financeiro/categorias',
    '/financeiro/lancamentos',
    '/relatorios',
    '/assistente',
    '/pdvs',
    '/sincronizacao',
    '/permissoes',
    '/licenca',
    '/usuarios',
    '/filiais',
    '/configuracoes'
];

function normalizeOrigin(origin) {
    return String(origin || '').trim().replace(/\/+$/, '');
}

function corsOrigins() {
    const configured = [
        process.env.HOMOLOGACAO_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        process.env.CORS_ORIGINS
    ]
        .filter(Boolean)
        .flatMap((value) => String(value).split(','))
        .map(normalizeOrigin)
        .filter(Boolean);

    if (process.env.NODE_ENV === 'production') {
        configured.push(DEFAULT_HOMOLOGACAO_ORIGIN);
    }

    return [...new Set(configured)];
}

function corsOptions() {
    const allowedOrigins = corsOrigins();

    return {
        origin(origin, callback) {
            if (!origin) {
                callback(null, true);
                return;
            }

            const normalized = normalizeOrigin(origin);
            if (!allowedOrigins.length && process.env.NODE_ENV !== 'production') {
                callback(null, true);
                return;
            }

            if (allowedOrigins.includes(normalized)) {
                callback(null, true);
                return;
            }

            callback(new Error('Origem nao permitida pelo CORS.'));
        },
        credentials: false,
        optionsSuccessStatus: 204
    };
}

function criarApp() {
    const app = express();

    if (process.env.RENDER || process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1);
    }

    app.use(helmet({
        contentSecurityPolicy: false
    }));
    app.use(cors(corsOptions()));
    app.use(express.json({ limit: '1mb' }));

    app.use('/api/auth', rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false
    }));

    app.use('/api/auth', authRoutes);
    app.use('/api', userRoutes);
    app.use('/api/categorias', categoriasRoutes);
    app.use('/api/produtos', produtosRoutes);
    app.use('/api/estoque', estoqueRoutes);
    app.use('/api/financeiro', financeiroRoutes);
    app.use('/api/sync', syncRoutes);
    app.use('/api/filiais', filiaisRoutes);
    app.use('/api/pdvs', pdvsRoutes);
    app.use('/api/licenca', licencaRoutes);
    app.use('/api/contador', contadorRoutes);
    app.use('/api/assistente', assistenteRoutes);

    // Aliases mantidos para nao quebrar telas antigas ou chamadas ja existentes.
    app.post('/api/cadastro', (req, res, next) => {
        req.url = '/cadastro';
        authRoutes(req, res, next);
    });
    app.post('/api/login', (req, res, next) => {
        req.url = '/login';
        authRoutes(req, res, next);
    });
    app.get('/api/me', (req, res, next) => {
        req.url = '/me';
        authRoutes(req, res, next);
    });

    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'online',
            version: VERSION,
            database: path.basename(database.dbPath),
            database_driver: database.providerAtual && database.providerAtual() === 'postgres' ? 'postgres' : 'sql.js',
            database_provider: database.providerAtual ? database.providerAtual() : (process.env.DATABASE_PROVIDER || 'sqljs'),
            storage: process.env.VERCEL ? 'serverless-ephemeral' : 'local-file',
            persistent_storage: !process.env.VERCEL,
            timestamp: new Date().toISOString()
        });
    });

    app.get('/login', (_req, res) => {
        res.sendFile(path.join(PUBLIC, 'cliente', 'login.html'));
    });

    app.get('/cadastro', (_req, res) => {
        res.sendFile(path.join(PUBLIC, 'cliente', 'cadastro.html'));
    });

    app.get('/contador/login', (_req, res) => {
        res.sendFile(path.join(PUBLIC, 'contador', 'login.html'));
    });

    app.get('/contador/dashboard', (_req, res) => {
        res.sendFile(path.join(PUBLIC, 'contador', 'portal.html'));
    });

    app.get('/contador/fechamentos', (_req, res) => {
        res.sendFile(path.join(PUBLIC, 'contador', 'portal.html'));
    });

    PORTAL_ROUTES.forEach((route) => {
        app.get(route, (_req, res) => {
            res.sendFile(path.join(PUBLIC, 'cliente', 'portal.html'));
        });
    });

    app.use('/download', express.static(DOWNLOADS, {
        fallthrough: false,
        immutable: true,
        maxAge: '1h'
    }));

    app.use(express.static(PUBLIC));

    app.get('/', (_req, res) => {
        res.sendFile(path.join(PUBLIC, 'index.html'));
    });

    app.use((req, res) => {
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ erro: 'Rota nao encontrada.' });
        }
        return res.status(404).sendFile(path.join(PUBLIC, 'index.html'));
    });

    app.use((error, _req, res, _next) => {
        const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500;
        if (status >= 500) {
            logger.error('Erro na requisicao', error);
        } else {
            logger.warn('Requisicao rejeitada', { status, erro: error.message });
        }
        res.status(status).json({ erro: status === 500 ? 'Erro interno do servidor.' : error.message });
    });

    return app;
}

async function start() {
    await database.inicializarBanco();
    const app = criarApp();
    const PORT = process.env.PORT || 3000;

    return app.listen(PORT, () => {
        logger.info(`Servidor Real Caixa Cloud rodando na porta ${PORT}`);
        logger.info(`Public: ${PUBLIC}`);
        logger.info(`Database: ${database.dbPath}`);
    });
}

if (require.main === module) {
    start().catch((error) => {
        logger.error('Falha ao iniciar servidor', error);
        process.exit(1);
    });
}

module.exports = {
    criarApp,
    start,
    corsOrigins
};
