const express = require('express');
const router = express.Router();
const { executarComando, executarQuery, buscarUm } = require('../database');
const { autenticarToken } = require('../auth');

// REGISTRAR VENDA
router.post('/', autenticarToken, (req, res) => {
    try {
        const { pdv_id, itens, total, desconto, forma_pagamento } = req.body;
        const clienteId = req.user.id;

        // Validar plano básico (limite de 100 vendas/mês)
        if (req.user.plano === 'basico') {
            const vendasMes = executarQuery(
                "SELECT COUNT(*) as total FROM vendas WHERE cliente_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
                [clienteId]
            );
            
            if (vendasMes[0]?.total >= 100) {
                return res.status(403).json({ 
                    erro: 'Limite de vendas do plano básico atingido. Faça upgrade para o plano profissional.' 
                });
            }
        }

        // Inserir venda
        const vendaResult = executarComando(
            'INSERT INTO vendas (cliente_id, pdv_id, total, desconto, forma_pagamento) VALUES (?, ?, ?, ?, ?)',
            [clienteId, pdv_id, total, desconto || 0, forma_pagamento]
        );
        
        const vendaId = vendaResult.lastInsertRowid;

        // Inserir itens e atualizar estoque
        if (itens && itens.length > 0) {
            for (const item of itens) {
                executarComando(
                    'INSERT INTO vendas_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                    [vendaId, item.produto_id, item.quantidade, item.preco_unitario, item.subtotal]
                );
                
                executarComando(
                    'UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND cliente_id = ?',
                    [item.quantidade, item.produto_id, clienteId]
                );
            }
        }

        res.status(201).json({
            mensagem: 'Venda registrada com sucesso!',
            venda_id: vendaId,
            total,
            itens: itens?.length || 0
        });

    } catch (error) {
        console.error('Erro ao registrar venda:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// LISTAR VENDAS
router.get('/', autenticarToken, (req, res) => {
    try {
        const clienteId = req.user.id;
        const vendas = executarQuery(
            'SELECT * FROM vendas WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 50',
            [clienteId]
        );

        res.json({ vendas, total: vendas.length });

    } catch (error) {
        console.error('Erro ao listar vendas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// DETALHES DA VENDA
router.get('/:id', autenticarToken, (req, res) => {
    try {
        const venda = buscarUm(
            'SELECT * FROM vendas WHERE id = ? AND cliente_id = ?',
            [req.params.id, req.user.id]
        );

        if (!venda) {
            return res.status(404).json({ erro: 'Venda não encontrada.' });
        }

        const itens = executarQuery(
            'SELECT vi.*, p.nome as produto_nome, p.codigo_barras FROM vendas_itens vi JOIN produtos p ON vi.produto_id = p.id WHERE vi.venda_id = ?',
            [req.params.id]
        );

        res.json({ venda, itens });

    } catch (error) {
        console.error('Erro ao buscar venda:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

module.exports = router;