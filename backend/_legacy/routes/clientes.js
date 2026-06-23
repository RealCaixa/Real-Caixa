const express = require('express');
const router = express.Router();
const { executarComando, executarQuery, buscarUm } = require('../database');
const { hashSenha, verificarSenha, gerarToken, autenticarToken } = require('../auth');

// CADASTRO DE CLIENTE
router.post('/cadastro', async (req, res) => {
    try {
        const { nome, email, telefone, empresa, senha, plano } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
        }

        // Verificar se email já existe
        const existente = buscarUm('SELECT id FROM clientes WHERE email = ?', [email]);
        if (existente) {
            return res.status(400).json({ erro: 'Este email já está cadastrado.' });
        }

        // Hash da senha
        const senhaHash = await hashSenha(senha);

        // Inserir cliente
        const result = executarComando(
            'INSERT INTO clientes (nome, email, telefone, empresa, senha, plano) VALUES (?, ?, ?, ?, ?, ?)',
            [nome, email, telefone || null, empresa || null, senhaHash, plano || 'basico']
        );

        const clienteId = result.lastInsertRowid;

        // Gerar token
        const token = gerarToken({ 
            id: clienteId, 
            email, 
            nome, 
            plano: plano || 'basico' 
        });

        res.status(201).json({
            mensagem: 'Cliente cadastrado com sucesso!',
            token,
            cliente: { id: clienteId, nome, email, plano: plano || 'basico' }
        });

    } catch (error) {
        console.error('Erro no cadastro:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
        }

        const cliente = buscarUm(
            'SELECT * FROM clientes WHERE email = ? AND status = ?',
            [email, 'ativo']
        );
        
        if (!cliente) {
            return res.status(401).json({ erro: 'Email ou senha inválidos.' });
        }

        const senhaValida = await verificarSenha(senha, cliente.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Email ou senha inválidos.' });
        }

        const token = gerarToken(cliente);

        res.json({
            mensagem: 'Login realizado com sucesso!',
            token,
            cliente: {
                id: cliente.id,
                nome: cliente.nome,
                email: cliente.email,
                telefone: cliente.telefone,
                empresa: cliente.empresa,
                plano: cliente.plano
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// PERFIL DO CLIENTE
router.get('/perfil', autenticarToken, (req, res) => {
    try {
        const cliente = buscarUm(
            'SELECT id, nome, email, telefone, empresa, plano, status, created_at FROM clientes WHERE id = ?',
            [req.user.id]
        );

        if (!cliente) {
            return res.status(404).json({ erro: 'Cliente não encontrado.' });
        }

        res.json({ cliente });

    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// ATUALIZAR PERFIL
router.put('/perfil', autenticarToken, (req, res) => {
    try {
        const { nome, telefone, empresa } = req.body;

        executarComando(
            'UPDATE clientes SET nome = ?, telefone = ?, empresa = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [nome, telefone, empresa, req.user.id]
        );

        res.json({ mensagem: 'Perfil atualizado com sucesso!' });

    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

module.exports = router;