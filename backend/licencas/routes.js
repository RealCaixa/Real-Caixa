const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const repository = require('./repository');

const router = express.Router();

router.post('/verificar', async (req, res, next) => {
    try {
        const resultado = await repository.verificarLicenca({
            cnpj: req.body.cnpj || req.body.documento,
            codigo: req.body.codigo_licenca || req.body.codigo_empresa
        });
        res.json(resultado);
    } catch (error) {
        next(error);
    }
});

router.post('/ativar', async (req, res, next) => {
    try {
        const resultado = await repository.ativarPdv(req.body);
        res.status(201).json(resultado);
    } catch (error) {
        next(error);
    }
});

router.post('/heartbeat', async (req, res, next) => {
    try {
        const resultado = await repository.heartbeat(req.body, extrairDeviceToken(req));
        res.json(resultado);
    } catch (error) {
        next(error);
    }
});

router.use(autenticar);
router.use(exigirPermissao('licenca:ver'));

router.get('/', async (req, res, next) => {
    try {
        res.json(await repository.resumoPortal(req.user.empresa_id));
    } catch (error) {
        next(error);
    }
});

router.post('/regenerar', async (req, res, next) => {
    try {
        const licenca = await repository.regenerarLicenca(req.user.empresa_id);
        res.json({ licenca: repository.licencaSeguro(licenca) });
    } catch (error) {
        next(error);
    }
});

router.get('/ativacoes', async (req, res, next) => {
    try {
        const dados = await repository.listarAtivacoes(req.user.empresa_id);
        res.json({ dados, total: dados.length });
    } catch (error) {
        next(error);
    }
});

router.post('/revogar', async (req, res, next) => {
    try {
        const ativacao = await repository.revogarAtivacao({
            empresaId: req.user.empresa_id,
            ativacaoId: req.body.ativacao_id || req.body.id,
            terminalUuid: req.body.terminal_uuid,
            codigoPdv: req.body.codigo_pdv
        });
        res.json({ ativacao: repository.ativacaoSeguro(ativacao) });
    } catch (error) {
        next(error);
    }
});

function extrairDeviceToken(req) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Device ')) {
        return header.slice('Device '.length).trim();
    }
    if (header.startsWith('Bearer ')) {
        return header.slice('Bearer '.length).trim();
    }
    return req.headers['x-device-token'] || null;
}

module.exports = router;
