const express = require('express');
const router = express.Router();
const { executarComando, executarQuery } = require('../database');
const { autenticarToken } = require('../auth');

// ADICIONAR TRANSAÇÃO
router.post('/', autenticarToken, (req, res) => {
    try {
        const { tipo, descricao, valor, categoria, data } = req.body;

        if (!tipo || !descricao || !valor) {
            return res.status(400).json({ erro: 'Tipo, descrição e valor são obrigatórios.' });
        }

        if (!['entrada', 'saida'].includes(tipo)) {
            return res.status(400).json({ erro: 'Tipo deve ser "entrada" ou "saida".' });
        }

        executarComando(
            'INSERT INTO financeiro (cliente_id, tipo, descricao, valor, categoria, data) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, tipo, descricao, valor, categoria || 'outros', data || new Date().toISOString().split('T')[0]]
        );

        res.status(201).json({ mensagem: 'Transação adicionada com sucesso!' });

    } catch (error) {
        console.error('Erro ao adicionar transação:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// LISTAR TRANSAÇÕES
router.get('/', autenticarToken, (req, res) => {
    try {
        const transacoes = executarQuery(
            'SELECT * FROM financeiro WHERE cliente_id = ? ORDER BY data DESC, created_at DESC',
            [req.user.id]
        );

        const saldo = transacoes.reduce((acc, t) => {
            return t.tipo === 'entrada' ? acc + t.valor : acc - t.valor;
        }, 0);

        res.json({ 
            transacoes, 
            total: transacoes.length,
            saldo
        });

    } catch (error) {
        console.error('Erro ao listar transações:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// EXCLUIR TRANSAÇÃO
router.delete('/:id', autenticarToken, (req, res) => {
    try {
        executarComando(
            'DELETE FROM financeiro WHERE id = ? AND cliente_id = ?',
            [req.params.id, req.user.id]
        );

        res.json({ mensagem: 'Transação excluída com sucesso!' });

    } catch (error) {
        console.error('Erro ao excluir transação:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

module.exports = router;