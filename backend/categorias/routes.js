const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const repo = require('./repository');

const router = express.Router();

router.use(autenticar, exigirPermissao('dashboard:ver'));

router.get('/', async (req, res) => {
    const resultado = await repo.listarCategorias({
        empresaId: req.user.empresa_id,
        busca: req.query.busca || '',
        pagina: req.query.pagina,
        limite: req.query.limite,
        incluirInativas: req.query.incluir_inativas === '1'
    });

    res.json(resultado);
});

router.post('/', async (req, res) => {
    const nome = limpar(req.body.nome);

    if (!nome) {
        return res.status(400).json({ erro: 'Nome da categoria e obrigatorio.' });
    }

    const categoria = await repo.criarCategoria({ empresaId: req.user.empresa_id, nome });
    res.status(201).json({ categoria });
});

router.get('/:id', async (req, res) => {
    const categoria = await repo.buscarCategoriaPorId(req.user.empresa_id, req.params.id);
    if (!categoria) {
        return res.status(404).json({ erro: 'Categoria nao encontrada.' });
    }
    res.json({ categoria });
});

router.put('/:id', async (req, res) => {
    const nome = req.body.nome === undefined ? undefined : limpar(req.body.nome);
    if (nome === '') {
        return res.status(400).json({ erro: 'Nome da categoria e obrigatorio.' });
    }

    const categoria = await repo.atualizarCategoria({
        empresaId: req.user.empresa_id,
        id: req.params.id,
        nome,
        ativo: req.body.ativo
    });

    if (!categoria) {
        return res.status(404).json({ erro: 'Categoria nao encontrada.' });
    }

    res.json({ categoria });
});

router.delete('/:id', async (req, res) => {
    const categoria = await repo.excluirCategoria({ empresaId: req.user.empresa_id, id: req.params.id });
    if (!categoria) {
        return res.status(404).json({ erro: 'Categoria nao encontrada.' });
    }
    res.json({ categoria, mensagem: 'Categoria desativada com sucesso.' });
});

function limpar(value) {
    return String(value || '').trim();
}

module.exports = router;
