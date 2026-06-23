const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const repo = require('./repository');

const router = express.Router();

router.use(autenticar, exigirPermissao('dashboard:ver'));

router.get('/', async (req, res) => {
    res.json(await repo.listarEstoque({
        empresaId: req.user.empresa_id,
        busca: req.query.busca || '',
        pagina: req.query.pagina,
        limite: req.query.limite
    }));
});

router.get('/indicadores', async (req, res) => {
    res.json({ indicadores: await repo.indicadores(req.user.empresa_id) });
});

router.get('/movimentacoes', async (req, res) => {
    res.json(await repo.listarMovimentacoes({
        empresaId: req.user.empresa_id,
        produtoId: req.query.produto_id,
        tipo: req.query.tipo,
        dataInicio: req.query.data_inicio,
        dataFim: req.query.data_fim,
        pagina: req.query.pagina,
        limite: req.query.limite
    }));
});

router.post('/entrada', (req, res) => responderMovimentacao(res, () => repo.registrarEntrada({
    empresaId: req.user.empresa_id,
    usuarioId: req.user.id,
    produtoId: req.body.produto_id,
    quantidade: req.body.quantidade,
    custoUnitario: req.body.custo_unitario,
    observacao: req.body.observacao
})));

router.post('/saida', (req, res) => responderMovimentacao(res, () => repo.registrarSaida({
    empresaId: req.user.empresa_id,
    usuarioId: req.user.id,
    produtoId: req.body.produto_id,
    quantidade: req.body.quantidade,
    observacao: req.body.observacao
})));

router.post('/perda', (req, res) => responderMovimentacao(res, () => repo.registrarPerda({
    empresaId: req.user.empresa_id,
    usuarioId: req.user.id,
    produtoId: req.body.produto_id,
    quantidade: req.body.quantidade,
    observacao: req.body.observacao
})));

router.post('/ajuste', (req, res) => responderMovimentacao(res, () => repo.registrarAjuste({
    empresaId: req.user.empresa_id,
    usuarioId: req.user.id,
    produtoId: req.body.produto_id,
    estoqueCorrigido: req.body.estoque_corrigido,
    observacao: req.body.observacao
})));

router.post('/inventario', (req, res) => responderMovimentacao(res, () => repo.registrarInventario({
    empresaId: req.user.empresa_id,
    usuarioId: req.user.id,
    produtoId: req.body.produto_id,
    contagemFisica: req.body.contagem_fisica,
    observacao: req.body.observacao
})));

async function responderMovimentacao(res, callback) {
    try {
        res.status(201).json(await callback());
    } catch (error) {
        res.status(error.status || 500).json({ erro: error.message || 'Erro interno do servidor.' });
    }
}

module.exports = router;
