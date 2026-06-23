const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const categorias = require('../categorias/repository');
const repo = require('./repository');

const router = express.Router();

router.use(autenticar, exigirPermissao('dashboard:ver'));

router.get('/', async (req, res) => {
    const resultado = await repo.listarProdutos({
        empresaId: req.user.empresa_id,
        busca: req.query.busca || '',
        categoriaId: req.query.categoria_id,
        pagina: req.query.pagina,
        limite: req.query.limite,
        incluirInativos: req.query.incluir_inativos === '1'
    });

    res.json(resultado);
});

router.post('/', async (req, res) => {
    const normalizado = normalizarProduto(req.body);
    const erro = validarProduto(normalizado);
    if (erro) return res.status(400).json({ erro });

    const duplicidade = await validarDuplicidade(req.user.empresa_id, normalizado);
    if (duplicidade) return res.status(409).json({ erro: duplicidade });

    if (normalizado.categoriaId && !(await categorias.buscarCategoriaPorId(req.user.empresa_id, normalizado.categoriaId))) {
        return res.status(400).json({ erro: 'Categoria invalida para esta empresa.' });
    }

    const produto = await repo.criarProduto({ empresaId: req.user.empresa_id, ...normalizado });
    res.status(201).json({ produto });
});

router.get('/:id', async (req, res) => {
    const produto = await repo.buscarProdutoPorId(req.user.empresa_id, req.params.id);
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado.' });
    res.json({ produto });
});

router.put('/:id', async (req, res) => {
    const atual = await repo.buscarProdutoPorId(req.user.empresa_id, req.params.id);
    if (!atual) return res.status(404).json({ erro: 'Produto nao encontrado.' });

    const normalizado = normalizarProduto({ ...desnormalizarProduto(atual), ...req.body });
    normalizado.ativo = req.body.ativo === undefined ? Boolean(atual.ativo) : Boolean(req.body.ativo);

    const erro = validarProduto(normalizado);
    if (erro) return res.status(400).json({ erro });

    const duplicidade = await validarDuplicidade(req.user.empresa_id, normalizado, req.params.id);
    if (duplicidade) return res.status(409).json({ erro: duplicidade });

    if (normalizado.categoriaId && !(await categorias.buscarCategoriaPorId(req.user.empresa_id, normalizado.categoriaId))) {
        return res.status(400).json({ erro: 'Categoria invalida para esta empresa.' });
    }

    const produto = await repo.atualizarProduto({
        empresaId: req.user.empresa_id,
        id: req.params.id,
        campos: normalizado
    });

    res.json({ produto });
});

router.delete('/:id', async (req, res) => {
    const produto = await repo.excluirProduto({ empresaId: req.user.empresa_id, id: req.params.id });
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado.' });
    res.json({ produto, mensagem: 'Produto desativado com sucesso.' });
});

function normalizarProduto(body) {
    return {
        categoriaId: body.categoria_id || body.categoriaId || null,
        codigoInterno: limpar(body.codigo_interno || body.codigoInterno),
        codigoBarras: limpar(body.codigo_barras || body.codigoBarras),
        descricao: limpar(body.descricao),
        custo: numero(body.custo),
        precoVenda: numero(body.preco_venda ?? body.precoVenda),
        estoqueAtual: numero(body.estoque_atual ?? body.estoqueAtual),
        estoqueMinimo: numero(body.estoque_minimo ?? body.estoqueMinimo),
        unidade: limpar(body.unidade || 'UN').toUpperCase(),
        ativo: body.ativo === undefined ? true : Boolean(body.ativo)
    };
}

function desnormalizarProduto(produto) {
    return {
        categoria_id: produto.categoria_id,
        codigo_interno: produto.codigo_interno,
        codigo_barras: produto.codigo_barras,
        descricao: produto.descricao,
        custo: produto.custo,
        preco_venda: produto.preco_venda,
        estoque_atual: produto.estoque_atual,
        estoque_minimo: produto.estoque_minimo,
        unidade: produto.unidade,
        ativo: Boolean(produto.ativo)
    };
}

function validarProduto(produto) {
    if (!produto.codigoInterno) return 'Codigo interno e obrigatorio.';
    if (!produto.descricao) return 'Descricao e obrigatoria.';
    if (!produto.unidade) return 'Unidade e obrigatoria.';
    if (produto.custo < 0) return 'Custo nao pode ser negativo.';
    if (produto.precoVenda < 0) return 'Preco de venda nao pode ser negativo.';
    if (produto.estoqueAtual < 0) return 'Estoque atual nao pode ser negativo.';
    if (produto.estoqueMinimo < 0) return 'Estoque minimo nao pode ser negativo.';
    return null;
}

async function validarDuplicidade(empresaId, produto, ignorarId) {
    if (await repo.buscarPorCodigoInterno(empresaId, produto.codigoInterno, ignorarId)) {
        return 'Codigo interno ja cadastrado para esta empresa.';
    }
    if (await repo.buscarPorCodigoBarras(empresaId, produto.codigoBarras, ignorarId)) {
        return 'Codigo de barras ja cadastrado para esta empresa.';
    }
    return null;
}

function limpar(value) {
    return String(value || '').trim();
}

function numero(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = router;
