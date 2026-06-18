const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

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

// CAMINHO DA RAIZ DO PROJETO
const RAIZ = path.join(__dirname, '..');
console.log('📁 Diretório raiz:', RAIZ);
console.log('📁 Conteúdo da raiz:', fs.readdirSync(RAIZ));

// Servir arquivos estáticos
app.use(express.static(RAIZ));

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
        timestamp: new Date().toISOString()
    });
});

// Rota principal
app.get('/', (req, res) => {
    const arquivo = path.join(RAIZ, 'index.html');
    console.log('📄 Servindo:', arquivo);
    res.sendFile(arquivo);
});

// Configurar WebSocket
setupWebSocket(io);

const PORT = process.env.PORT || 3000;
// Rota de teste
app.get('/teste', (req, res) => {
    const fs = require('fs');
    const RAIZ = path.join(__dirname, '..');
    const arquivos = fs.readdirSync(RAIZ);
    res.json({
        raiz: RAIZ,
        arquivos: arquivos,
        indexExiste: fs.existsSync(path.join(RAIZ, 'index.html'))
    });
});

const PORT = process.env.PORT || 3000;
async function iniciarServidor() {
    await inicializarBanco();
    
    server.listen(PORT, () => {
        console.log('🚀 Servidor rodando na porta', PORT);
        console.log('📡 API: http://localhost:' + PORT + '/api');
        console.log('💻 Site: http://localhost:' + PORT);
    });
}

process.on('uncaughtException', (error) => {
    console.error('❌ Erro:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Erro:', error);
});

iniciarServidor();