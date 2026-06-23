const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const repository = require('./repository');

const router = express.Router();

router.post('/registrar', async (req, res, next) => {
    try {
        const resultado = await repository.registrarPdv(req.body);
        res.status(201).json(resultado);
    } catch (error) {
        next(error);
    }
});

router.get('/status/:codigo_pdv', async (req, res, next) => {
    try {
        const resultado = await repository.statusPdv({
            codigoPdv: req.params.codigo_pdv,
            deviceToken: extrairDeviceToken(req)
        });
        res.json(resultado);
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
router.use(exigirPermissao('dashboard:ver'));

router.get('/', async (req, res) => {
    const dados = await repository.listarPdvs({
        empresaId: req.user.empresa_id,
        filialId: req.query.filial_id,
        busca: req.query.busca,
        incluirInativos: req.query.incluir_inativos === '1'
    });
    res.json({ dados, total: dados.length });
});

router.post('/', async (req, res, next) => {
    try {
        const pdv = await repository.criarPdv({
            empresaId: req.user.empresa_id,
            campos: req.body
        });
        res.status(201).json({ pdv });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const pdv = await repository.atualizarPdv({
            empresaId: req.user.empresa_id,
            id: Number(req.params.id),
            campos: req.body
        });
        if (!pdv) {
            return res.status(404).json({ erro: 'PDV nao encontrado.' });
        }
        res.json({ pdv });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', async (req, res) => {
    const pdv = await repository.desativarPdv({
        empresaId: req.user.empresa_id,
        id: Number(req.params.id)
    });
    if (!pdv) {
        return res.status(404).json({ erro: 'PDV nao encontrado.' });
    }
    res.json({ pdv });
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
