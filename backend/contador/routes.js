const express = require('express');
const repository = require('./repository');
const { autenticar, exigirPermissao } = require('../auth/middleware');

const router = express.Router();

router.post('/cadastro', asyncHandler(async (req, res) => {
    const contador = await repository.criarContador(req.body || {});
    res.status(201).json({ contador });
}));

router.post('/login', asyncHandler(async (req, res) => {
    const sessao = await repository.loginContador(req.body || {});
    res.json(sessao);
}));

router.get(
    '/empresarial/contadores',
    autenticar,
    exigirPermissao('dashboard:ver'),
    asyncHandler(async (req, res) => {
        res.json({ contadores: await repository.listarContadoresEmpresa(req.user.empresa_id) });
    })
);

router.post(
    '/empresarial/convites',
    autenticar,
    exigirPermissao('dashboard:ver'),
    asyncHandler(async (req, res) => {
        const vinculo = await repository.convidarContador({
            empresaId: req.user.empresa_id,
            email: req.body?.email,
            nome: req.body?.nome
        });
        res.status(201).json({ vinculo });
    })
);

router.delete(
    '/empresarial/contadores/:contadorId',
    autenticar,
    exigirPermissao('dashboard:ver'),
    asyncHandler(async (req, res) => {
        const vinculo = await repository.removerContador({
            empresaId: req.user.empresa_id,
            contadorId: Number(req.params.contadorId)
        });
        res.json({ vinculo, removido: Boolean(vinculo) });
    })
);

router.use(autenticarContador);

router.get('/me', asyncHandler(async (req, res) => {
    res.json({
        contador: req.contador,
        empresas: await repository.listarEmpresasDoContador(req.contador.id)
    });
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
    res.json(await repository.dashboardContador(req.contador.id));
}));

router.post('/convites/:empresaId/aceitar', asyncHandler(async (req, res) => {
    const vinculo = await repository.aceitarConvite({
        contadorId: req.contador.id,
        empresaId: Number(req.params.empresaId)
    });
    res.json({ vinculo });
}));

router.get('/empresas/:empresaId/relatorios', asyncHandler(async (req, res) => {
    const relatorio = await repository.relatorio({
        contadorId: req.contador.id,
        empresaId: Number(req.params.empresaId),
        tipo: req.query.tipo,
        mes: req.query.mes
    });
    res.json(relatorio);
}));

router.get('/fechamentos', asyncHandler(async (req, res) => {
    const fechamento = await repository.fechamentoMensal({
        contadorId: req.contador.id,
        empresaId: Number(req.query.empresa_id),
        mes: req.query.mes
    });
    res.json(fechamento);
}));

router.get('/fechamentos/export', asyncHandler(async (req, res) => {
    const arquivo = await repository.exportarFechamento({
        contadorId: req.contador.id,
        empresaId: Number(req.query.empresa_id),
        mes: req.query.mes,
        formato: req.query.formato
    });
    res.setHeader('Content-Type', arquivo.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${arquivo.filename}"`);
    res.send(arquivo.body);
}));

async function autenticarContador(req, res, next) {
    const token = extrairBearer(req);
    if (!token) {
        return res.status(401).json({ erro: 'Sessao do contador nao autenticada.' });
    }

    try {
        req.contador = await repository.autenticarToken(token);
        return next();
    } catch (error) {
        return res.status(error.status || 401).json({ erro: error.message });
    }
}

function extrairBearer(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim();
}

function asyncHandler(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = router;
