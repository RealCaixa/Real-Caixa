const express = require('express');
const pdvs = require('../pdvs/repository');

const router = express.Router();

router.post('/verificar', async (req, res, next) => {
    try {
        const resultado = await pdvs.verificarLicenca({
            cnpj: req.body.cnpj || req.body.documento,
            codigo: req.body.codigo_licenca || req.body.codigo_empresa
        });
        res.json(resultado);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
