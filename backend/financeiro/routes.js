const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const repo = require('./repository');

const router = express.Router();

router.use(autenticar, exigirPermissao('dashboard:ver'));

router.get('/dashboard', async (req, res) => {
    res.json(await repo.dashboard({
        empresaId: req.user.empresa_id,
        periodo: req.query.periodo || 'mes',
        dataInicio: req.query.data_inicio,
        dataFim: req.query.data_fim
    }));
});

router.get('/contas-receber', async (req, res) => {
    res.json(await repo.listarContasReceber({
        empresaId: req.user.empresa_id,
        status: req.query.status,
        pagina: req.query.pagina,
        limite: req.query.limite
    }));
});

router.post('/contas-receber', (req, res) => responder(res, async () => ({
    conta: await repo.criarContaReceber(req.user.empresa_id, req.body)
}), 201));

router.put('/contas-receber/:id', (req, res) => responder(res, async () => {
    const conta = await repo.atualizarContaReceber(req.user.empresa_id, req.params.id, req.body);
    if (!conta) return notFound('Conta a receber nao encontrada.');
    return { conta };
}));

router.get('/contas-pagar', async (req, res) => {
    res.json(await repo.listarContasPagar({
        empresaId: req.user.empresa_id,
        status: req.query.status,
        pagina: req.query.pagina,
        limite: req.query.limite
    }));
});

router.post('/contas-pagar', (req, res) => responder(res, async () => ({
    conta: await repo.criarContaPagar(req.user.empresa_id, req.body)
}), 201));

router.put('/contas-pagar/:id', (req, res) => responder(res, async () => {
    const conta = await repo.atualizarContaPagar(req.user.empresa_id, req.params.id, req.body);
    if (!conta) return notFound('Conta a pagar nao encontrada.');
    return { conta };
}));

router.get('/categorias', async (req, res) => {
    res.json({ dados: await repo.listarCategorias({
        empresaId: req.user.empresa_id,
        tipo: req.query.tipo,
        incluirInativas: req.query.incluir_inativas === '1'
    }) });
});

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

router.get('/lancamentos', async (req, res) => {
    res.json(await repo.listarLancamentos({
        empresaId: req.user.empresa_id,
        tipo: req.query.tipo,
        dataInicio: req.query.data_inicio,
        dataFim: req.query.data_fim,
        pagina: req.query.pagina,
        limite: req.query.limite
    }));
});

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

module.exports = router;
