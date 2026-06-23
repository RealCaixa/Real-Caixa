const express = require('express');
const router = express.Router();
const db = require('../database');
const { autenticarAdmin } = require('../auth');

// DASHBOARD ADMIN
router.get('/dashboard', autenticarAdmin, (req, res) => {
    try {
        const totalClientes = db.prepare('SELECT COUNT(*) as total FROM clientes WHERE status = ?').get('ativo');
        const planosAtivos = db.prepare('SELECT COUNT(*) as total FROM clientes WHERE plano = ? AND status = ?').get('profissional', 'ativo');
        const totalVendas = db.prepare('SELECT COUNT(*) as total FROM vendas').get();
        const faturamento = db.prepare(`
            SELECT COALESCE(SUM(total), 0) as total 
            FROM vendas 
            WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        `).get();

        res.json({
            total_clientes: totalClientes.total,
            planos_ativos: planosAtivos.total,
            total_vendas: totalVendas.total,
            faturamento_mensal: faturamento.total,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erro no dashboard admin:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// LISTAR TODOS OS CLIENTES
router.get('/clientes', autenticarAdmin, (req, res) => {
    try {
        const clientes = db.prepare(`
            SELECT id, nome, email, telefone, empresa, plano, status, created_at 
            FROM clientes 
            ORDER BY created_at DESC
        `).all();

        res.json({ clientes, total: clientes.length });

    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// LISTAR PDVs CONECTADOS
router.get('/pdvs', autenticarAdmin, (req, res) => {
    try {
        const pdvs = db.prepare(`
            SELECT pc.*, c.nome as cliente_nome, c.email as cliente_email
            FROM pdv_conexoes pc
            JOIN clientes c ON pc.cliente_id = c.id
            ORDER BY pc.ultima_conexao DESC
        `).all();

        res.json({ pdvs, total: pdvs.length });

    } catch (error) {
        console.error('Erro ao listar PDVs:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

module.exports = router;