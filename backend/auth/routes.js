const express = require('express');
const authService = require('./service');
const { autenticar } = require('./middleware');
const { buscarEmpresaPorId } = require('../empresas/repository');
const { buscarLicencaPorEmpresa } = require('../licencas/repository');

const router = express.Router();

router.post('/cadastro', async (req, res) => {
    try {
        const sessao = await authService.cadastrarCliente(req.body);
        res.status(201).json(sessao);
    } catch (error) {
        res.status(error.status || 500).json({ erro: error.message || 'Erro interno do servidor.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const sessao = await authService.loginCliente(req.body);
        res.json(sessao);
    } catch (error) {
        res.status(error.status || 500).json({ erro: error.message || 'Erro interno do servidor.' });
    }
});

router.get('/me', autenticar, async (req, res) => {
    const empresa = await buscarEmpresaPorId(req.user.empresa_id);
    const licenca = await buscarLicencaPorEmpresa(req.user.empresa_id);

    res.json({
        usuario: req.user,
        empresa: authService.empresaSeguro(empresa),
        licenca: authService.licencaSeguro(licenca)
    });
});

router.post('/logout', autenticar, (_req, res) => {
    res.json({ mensagem: 'Logout realizado com sucesso.' });
});

module.exports = router;
