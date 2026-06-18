const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Importar banco de dados
const { inicializarBanco } = require('./database');

// Importar rotas
const clientesRoutes = require('./routes/clientes');
const vendasRoutes = require('./routes/vendas');
const financeiroRoutes = require('./routes/financeiro');
const pdvRoutes = require('./routes/pdv');
const adminRoutes = require('./routes/admin');
const setupWebSocket = require('./websocket');

const app = express();

// Criar servidor HTTP
const server = http.createServer(app);

// Configurar WebSocket
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configurações de segurança
app.use(helmet({
    contentSecurityPolicy: false
}));

// CORS
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '..')));

// Rotas da API
app.use('/api/clientes', clientesRoutes);
app.use('/api/vendas', vendasRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/pdv', pdvRoutes);
app.use('/api/admin', adminRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Rota para página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Configurar WebSocket
setupWebSocket(io);

// Iniciar servidor
const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    // Inicializar banco de dados
    await inicializarBanco();
    
    // Iniciar servidor HTTP
    server.listen(PORT, () => {
        console.log('========================================');
        console.log('🚀 REAL CAIXA - Servidor Iniciado!');
        console.log('========================================');
        console.log(`📡 API: http://localhost:${PORT}/api`);
        console.log(`💻 Frontend: http://localhost:${PORT}`);
        console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
        console.log(`📊 Health: http://localhost:${PORT}/api/health`);
        console.log('========================================');
        console.log('Pressione Ctrl+C para parar o servidor');
        console.log('========================================\n');
    });
}

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promise rejeitada:', error);
});

// Iniciar tudo
iniciarServidor();