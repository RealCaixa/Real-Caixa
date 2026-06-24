const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const repo = require('./repository');
const logger = require('../logger');

const router = express.Router();

router.use(autenticar, exigirPermissao('dashboard:ver'));

router.get('/dashboard', asyncHandler(async (req, res) => {
    res.json(await repo.dashboard({
        empresaId: req.user.empresa_id,
        periodo: req.query.periodo || 'mes',
        dataInicio: req.query.data_inicio,
        dataFim: req.query.data_fim
    }));
}, fallbackDashboard));

router.get('/contas-receber', asyncHandler(async (req, res) => {
    res.json(await repo.listarContasReceber({
        empresaId: req.user.empresa_id,
        status: req.query.status,
        pagina: req.query.pagina,
        limite: req.query.limite
    }));
}, fallbackLista));

router.post('/contas-receber', (req, res) => responder(res, async () => ({
    conta: await repo.criarContaReceber(req.user.empresa_id, req.body)
}), 201));

router.put('/contas-receber/:id', (req, res) => responder(res, async () => {
    const conta = await repo.atualizarContaReceber(req.user.empresa_id, req.params.id, req.body);
    if (!conta) return notFound('Conta a receber nao encontrada.');
    return { conta };
}));

router.get('/contas-pagar', asyncHandler(async (req, res) => {
    res.json(await repo.listarContasPagar({
        empresaId: req.user.empresa_id,
        status: req.query.status,
        pagina: req.query.pagina,
        limite: req.query.limite
    }));
}, fallbackLista));

router.post('/contas-pagar', (req, res) => responder(res, async () => ({
    conta: await repo.criarContaPagar(req.user.empresa_id, req.body)
}), 201));

router.put('/contas-pagar/:id', (req, res) => responder(res, async () => {
    const conta = await repo.atualizarContaPagar(req.user.empresa_id, req.params.id, req.body);
    if (!conta) return notFound('Conta a pagar nao encontrada.');
    return { conta };
}));

router.get('/categorias', asyncHandler(async (req, res) => {
    res.json({ dados: await repo.listarCategorias({
        empresaId: req.user.empresa_id,
        tipo: req.query.tipo,
        incluirInativas: req.query.incluir_inativas === '1'
    }) });
}, () => ({ dados: [], erro: 'Nao foi possivel carregar categorias financeiras.' })));

router.post('/categorias', (req, res) => responder(res, async () => ({
    categoria: await repo.criarCategoria(req.user.empresa_id, req.body)
}), 201));

router.put('/categorias/:id', (req, res) => responder(res, async () => {
    const categoria = await repo.atualizarCategoria(req.user.empresa_id, req.params.id, req.body);
    if (!categoria) return notFound('Categoria financeira nao encontrada.');
    return { categoria };
}));

router.delete('/categorias/:id', (req, res) => responder(res, async () => {
    const categoria = await repo.desativarCategoria(req.user.empresa_id, req.params.id);
    if (!categoria) return notFound('Categoria financeira nao encontrada.');
    return { categoria };
}));

router.get('/lancamentos', asyncHandler(async (req, res) => {
    res.json(await repo.listarLancamentos({
        empresaId: req.user.empresa_id,
        tipo: req.query.tipo,
        dataInicio: req.query.data_inicio,
        dataFim: req.query.data_fim,
        pagina: req.query.pagina,
        limite: req.query.limite
    }));
}, fallbackLista));

router.post('/lancamentos', (req, res) => responder(res, async () => ({
    lancamento: await repo.criarLancamento({
        empresaId: req.user.empresa_id,
        usuarioId: req.user.id,
        payload: req.body
    })
}), 201));

async function responder(res, callback, status = 200) {
    try {
        const body = await callback();
        res.status(status).json(body);
    } catch (error) {
        res.status(error.status || 500).json({ erro: error.message || 'Erro interno do servidor.' });
    }
}

function notFound(message) {
    const error = new Error(message);
    error.status = 404;
    throw error;
}

function asyncHandler(handler, fallback = null) {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            logger.error('Erro controlado no modulo financeiro', {
                rota: req.originalUrl,
                erro: error.message
            });

            if (fallback) {
                return res.status(200).json(fallback(error, req));
            }

            return res.status(error.status || 500).json({
                erro: error.message || 'Erro interno do servidor.'
            });
        }
    };
}

function fallbackLista(error) {
    return {
        dados: [],
        paginacao: { pagina: 1, limite: 50, total: 0, paginas: 1 },
        erro: error.message || 'Nao foi possivel carregar dados financeiros.'
    };
}

function fallbackDashboard(error) {
    return {
        periodo: { inicio: new Date().toISOString().slice(0, 10), fim: new Date().toISOString().slice(0, 10) },
        contas_a_pagar: 0,
        contas_a_receber: 0,
        saldo: 0,
        lancamentos: [],
        indicadores: {
            faturamento_mes: 0,
            despesas_mes: 0,
            lucro_operacional: 0,
            contas_vencidas: { receber: 0, pagar: 0, total: 0 },
            contas_a_vencer: { receber: 0, pagar: 0, total: 0 },
            contas_a_pagar: 0,
            contas_a_receber: 0,
            saldo_atual: 0,
            saldo: 0,
            entradas: 0,
            saidas: 0,
            saldo_projetado: 0
        },
        graficos: {
            receitas_por_mes: [],
            despesas_por_mes: [],
            evolucao_caixa: []
        },
        erro: error.message || 'Nao foi possivel carregar indicadores financeiros.'
    };
}

module.exports = router;
