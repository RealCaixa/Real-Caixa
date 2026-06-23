const express = require('express');
const router = express.Router();
const { executarComando, executarQuery, buscarUm } = require('../database');
const { autenticarToken } = require('../auth');

// SINCRONIZAR DADOS DO PDV
router.post('/sincronizar', autenticarToken, (req, res) => {
    try {
        const { pdv_id, vendas } = req.body;
        const clienteId = req.user.id;

        // Atualizar conexão do PDV
        executarComando(
            `INSERT INTO pdv_conexoes (cliente_id, pdv_id, ultima_conexao, status) 
             VALUES (?, ?, CURRENT_TIMESTAMP, 'online')
             ON CONFLICT(pdv_id) DO UPDATE SET ultima_conexao = CURRENT_TIMESTAMP, status = 'online'`,
            [clienteId, pdv_id]
        );

        const resultado = { vendas_sincronizadas: 0, erros: [] };

        if (vendas && vendas.length > 0) {
            for (const venda of vendas) {
                try {
                    executarComando(
                        'INSERT INTO vendas (cliente_id, pdv_id, total, desconto, forma_pagamento, sincronizada) VALUES (?, ?, ?, ?, ?, 1)',
                        [clienteId, pdv_id, venda.total, venda.desconto || 0, venda.forma_pagamento]
                    );
                    resultado.vendas_sincronizadas++;
                } catch (err) {
                    resultado.erros.push(`Erro na venda: ${err.message}`);
                }
            }
        }

        res.json({
            mensagem: 'Sincronização concluída!',
            resultado
        });

    } catch (error) {
        console.error('Erro na sincronização:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

// REGISTRAR SANGRIA/SUPRIMENTO
router.post('/caixa', autenticarToken, (req, res) => {
    try {
        const { pdv_id, tipo, valor, observacao } = req.body;

        if (!['sangria', 'suprimento'].includes(tipo)) {
            return res.status(400).json({ erro: 'Tipo inválido.' });
        }

        executarComando(
            'INSERT INTO sangria_suprimento (cliente_id, pdv_id, tipo, valor, observacao) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, pdv_id, tipo, valor, observacao || '']
        );

        res.status(201).json({ mensagem: `${tipo} registrada com sucesso!` });

    } catch (error) {
        console.error('Erro ao registrar sangria/suprimento:', error);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

module.exports = router;