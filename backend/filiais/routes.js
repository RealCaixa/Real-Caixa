const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const repository = require('./repository');

const router = express.Router();

router.use(autenticar);
router.use(exigirPermissao('dashboard:ver'));

router.get('/', async (req, res) => {
    const dados = await repository.listarFiliais({
        empresaId: req.user.empresa_id,
        busca: req.query.busca,
        incluirInativas: req.query.incluir_inativas === '1'
    });
    res.json({ dados, total: dados.length });
});

router.post('/', async (req, res, next) => {
    try {
        const filial = await repository.criarFilial({
            empresaId: req.user.empresa_id,
            campos: req.body
        });
        res.status(201).json({ filial });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const filial = await repository.atualizarFilial({
            empresaId: req.user.empresa_id,
            id: Number(req.params.id),
            campos: req.body
        });
        if (!filial) {
            return res.status(404).json({ erro: 'Filial nao encontrada.' });
        }
        res.json({ filial });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', async (req, res) => {
    const filial = await repository.desativarFilial({
        empresaId: req.user.empresa_id,
        id: Number(req.params.id)
    });
    if (!filial) {
        return res.status(404).json({ erro: 'Filial nao encontrada.' });
    }
    res.json({ filial });
});

module.exports = router;
