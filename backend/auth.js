const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = 'real-caixa-secret-key-2026'; // ALTERE EM PRODUÇÃO!
const JWT_EXPIRES = '24h';

// Middleware de autenticação
function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            erro: 'Acesso negado. Token não fornecido.' 
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                erro: 'Token inválido ou expirado.' 
            });
        }
        req.user = user;
        next();
    });
}

// Middleware para verificar se é admin
function autenticarAdmin(req, res, next) {
    const adminKey = req.headers['admin-key'];
    
    if (!adminKey || adminKey !== 'realcaixa-admin-2026') {
        return res.status(403).json({ 
            erro: 'Acesso restrito ao administrador.' 
        });
    }
    next();
}

// Gerar hash da senha
async function hashSenha(senha) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(senha, salt);
}

// Verificar senha
async function verificarSenha(senha, hash) {
    return await bcrypt.compare(senha, hash);
}

// Gerar token JWT
function gerarToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            nome: user.nome,
            plano: user.plano 
        }, 
        JWT_SECRET, 
        { expiresIn: JWT_EXPIRES }
    );
}

module.exports = {
    autenticarToken,
    autenticarAdmin,
    hashSenha,
    verificarSenha,
    gerarToken,
    JWT_SECRET
};