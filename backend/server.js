const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PUBLIC = path.join(__dirname, 'public');
app.use(express.static(PUBLIC));

// ==================== BANCO DE DADOS SIMPLES (JSON) ====================
const DB_PATH = path.join(__dirname, 'data');
const USERS_FILE = path.join(DB_PATH, 'users.json');

if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');

function getUsers() {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(senha) {
    return crypto.createHash('sha256').update(senha).digest('hex');
}

// ==================== ROTAS DA API ====================

// CADASTRO
app.post('/api/cadastro', (req, res) => {
    const { nome, email, senha, empresa, telefone } = req.body;
    
    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
    }
    
    const users = getUsers();
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ erro: 'Este email já está cadastrado.' });
    }
    
    const newUser = {
        id: Date.now(),
        nome,
        email,
        senha: hashPassword(senha),
        empresa: empresa || '',
        telefone: telefone || '',
        plano: 'basico',
        status: 'ativo',
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    res.status(201).json({
        mensagem: '✅ Cadastro realizado com sucesso!',
        usuario: {
            id: newUser.id,
            nome: newUser.nome,
            email: newUser.email,
            plano: newUser.plano
        }
    });
});

// LOGIN
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
    }
    
    const users = getUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    }
    
    if (user.senha !== hashPassword(senha)) {
        return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    }
    
    if (user.status !== 'ativo') {
        return res.status(403).json({ erro: 'Conta desativada. Entre em contato.' });
    }
    
    const token = crypto.randomBytes(32).toString('hex');
    
    // Salvar token no usuário
    user.token = token;
    user.lastLogin = new Date().toISOString();
    saveUsers(users);
    
    res.json({
        mensagem: '✅ Login realizado com sucesso!',
        token,
        usuario: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            plano: user.plano,
            empresa: user.empresa
        }
    });
});

// VERIFICAR TOKEN
app.get('/api/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ erro: 'Token não fornecido.' });
    }
    
    const users = getUsers();
    const user = users.find(u => u.token === token);
    
    if (!user) {
        return res.status(401).json({ erro: 'Token inválido.' });
    }
    
    res.json({
        usuario: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            plano: user.plano,
            empresa: user.empresa
        }
    });
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    const users = getUsers();
    res.json({
        status: 'online',
        version: '2.1.0',
        usuarios: users.length,
        timestamp: new Date().toISOString()
    });
});

// ROTA PRINCIPAL
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Servidor rodando na porta ' + PORT);
    console.log('📁 Public:', PUBLIC);
});