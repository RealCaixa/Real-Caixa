const { executarComando, executarQuery, buscarUm } = require('../database');

async function listarProdutos({ empresaId, busca = '', categoriaId, pagina = 1, limite = 20, incluirInativos = false }) {
    const page = Math.max(Number(pagina) || 1, 1);
    const limit = Math.min(Math.max(Number(limite) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const params = [empresaId];
    const where = ['p.empresa_id = ?'];

    if (!incluirInativos) {
        where.push('p.ativo = 1');
    }

    if (categoriaId) {
        where.push('p.categoria_id = ?');
        params.push(Number(categoriaId));
    }

    if (busca) {
        where.push(`(
            p.descricao LIKE ?
            OR p.codigo_interno LIKE ?
            OR p.codigo_barras LIKE ?
            OR c.nome LIKE ?
        )`);
        params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
    }

    const whereSql = where.join(' AND ');
    const total = (await buscarUm(
        `SELECT COUNT(*) AS total
         FROM produtos p
         LEFT JOIN categorias c ON c.id = p.categoria_id AND c.empresa_id = p.empresa_id
         WHERE ${whereSql}`,
        params
    )).total;

    const dados = await executarQuery(
        `SELECT p.id, p.empresa_id, p.categoria_id, c.nome AS categoria_nome,
                p.codigo_interno, p.codigo_barras, p.descricao, p.custo,
                p.preco_venda, p.estoque_atual, p.estoque_minimo, p.unidade,
                p.ativo, p.created_at, p.updated_at
         FROM produtos p
         LEFT JOIN categorias c ON c.id = p.categoria_id AND c.empresa_id = p.empresa_id
         WHERE ${whereSql}
         ORDER BY p.descricao ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return {
        dados,
        paginacao: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) || 1 }
    };
}

async function criarProduto(produto) {
    const result = await executarComando(
        `INSERT INTO produtos (
            empresa_id, categoria_id, codigo_interno, codigo_barras, descricao, custo,
            preco_venda, estoque_atual, estoque_minimo, unidade
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            produto.empresaId,
            produto.categoriaId || null,
            produto.codigoInterno,
            produto.codigoBarras || null,
            produto.descricao,
            produto.custo,
            produto.precoVenda,
            produto.estoqueAtual,
            produto.estoqueMinimo,
            produto.unidade
        ]
    );

    return buscarProdutoPorId(produto.empresaId, result.lastInsertRowid);
}

async function atualizarProduto({ empresaId, id, campos }) {
    const atual = await buscarProdutoPorId(empresaId, id);
    if (!atual) return null;

    await executarComando(
        `UPDATE produtos
         SET categoria_id = ?,
             codigo_interno = ?,
             codigo_barras = ?,
             descricao = ?,
             custo = ?,
             preco_venda = ?,
             estoque_atual = ?,
             estoque_minimo = ?,
             unidade = ?,
             ativo = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [
            campos.categoriaId,
            campos.codigoInterno,
            campos.codigoBarras || null,
            campos.descricao,
            campos.custo,
            campos.precoVenda,
            campos.estoqueAtual,
            campos.estoqueMinimo,
            campos.unidade,
            Number(Boolean(campos.ativo)),
            id,
            empresaId
        ]
    );

    return buscarProdutoPorId(empresaId, id);
}

async function excluirProduto({ empresaId, id }) {
    const atual = await buscarProdutoPorId(empresaId, id);
    if (!atual) return null;

    await executarComando(
        'UPDATE produtos SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?',
        [id, empresaId]
    );

    return buscarProdutoPorId(empresaId, id);
}

async function buscarProdutoPorId(empresaId, id) {
    return buscarUm(
        `SELECT p.id, p.empresa_id, p.categoria_id, c.nome AS categoria_nome,
                p.codigo_interno, p.codigo_barras, p.descricao, p.custo,
                p.preco_venda, p.estoque_atual, p.estoque_minimo, p.unidade,
                p.ativo, p.created_at, p.updated_at
         FROM produtos p
         LEFT JOIN categorias c ON c.id = p.categoria_id AND c.empresa_id = p.empresa_id
         WHERE p.id = ? AND p.empresa_id = ?`,
        [id, empresaId]
    );
}

async function buscarPorCodigoInterno(empresaId, codigoInterno, ignorarId) {
    return buscarUm(
        `SELECT id FROM produtos
         WHERE empresa_id = ? AND codigo_interno = ? AND (? IS NULL OR id <> ?)`,
        [empresaId, codigoInterno, ignorarId || null, ignorarId || null]
    );
}

async function buscarPorCodigoBarras(empresaId, codigoBarras, ignorarId) {
    if (!codigoBarras) return null;
    return buscarUm(
        `SELECT id FROM produtos
         WHERE empresa_id = ? AND codigo_barras = ? AND (? IS NULL OR id <> ?)`,
        [empresaId, codigoBarras, ignorarId || null, ignorarId || null]
    );
}

module.exports = {
    listarProdutos,
    criarProduto,
    atualizarProduto,
    excluirProduto,
    buscarProdutoPorId,
    buscarPorCodigoInterno,
    buscarPorCodigoBarras
};
