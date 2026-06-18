const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const { inicializarBanco } = require('./database');
const clientesRoutes = require('./routes/clientes');
const vendasRoutes = require('./routes/vendas');
const financeiroRoutes = require('./routes/financeiro');
const pdvRoutes = require('./routes/pdv');
const adminRoutes = require('./routes/admin');
const setupWebSocket = require('./websocket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const RAIZ = __dirname.includes('/app/') ? '/app' : path.join(__dirname, '..');
console.log('📁 Raiz detectada:', RAIZ);
console.log('📁 Raiz:', RAIZ);

app.use(express.static(RAIZ));

app.use('/api/clientes', clientesRoutes);
app.use('/api/vendas', vendasRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/pdv', pdvRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'online', version: '2.1.0', timestamp: new Date().toISOString() });
});

app.get('/teste', (req, res) => {
    const arquivos = fs.readdirSync(RAIZ);
    res.json({ raiz: RAIZ, arquivos: arquivos });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(RAIZ, 'index.html'));
});

setupWebSocket(io);

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    await inicializarBanco();
    server.listen(PORT, () => {
        console.log('🚀 Servidor rodando na porta ' + PORT);
    });
}

iniciarServidor();