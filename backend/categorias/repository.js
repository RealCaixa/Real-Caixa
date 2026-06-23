const { executarComando, executarQuery, buscarUm } = require('../database');

async function listarCategorias({ empresaId, busca = '', pagina = 1, limite = 20, incluirInativas = false }) {
    const page = Math.max(Number(pagina) || 1, 1);
    const limit = Math.min(Math.max(Number(limite) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const params = [empresaId];
    const where = ['empresa_id = ?'];

    if (!incluirInativas) {
        where.push('ativo = 1');
    }

    if (busca) {
        where.push('nome LIKE ?');
        params.push(`%${busca}%`);
    }

    const whereSql = where.join(' AND ');
    const total = (await buscarUm(`SELECT COUNT(*) AS total FROM categorias WHERE ${whereSql}`, params)).total;
    const dados = await executarQuery(
        `SELECT id, empresa_id, nome, ativo, created_at, updated_at
         FROM categorias
         WHERE ${whereSql}
         ORDER BY nome ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return {
        dados,
        paginacao: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) || 1 }
    };
}

async function criarCategoria({ empresaId, nome }) {
    const result = await executarComando(
        'INSERT INTO categorias (empresa_id, nome) VALUES (?, ?)',
        [empresaId, nome]
    );
    return buscarCategoriaPorId(empresaId, result.lastInsertRowid);
}

async function atualizarCategoria({ empresaId, id, nome, ativo }) {
    const atual = await buscarCategoriaPorId(empresaId, id);
    if (!atual) return null;

    await executarComando(
        `UPDATE categorias
         SET nome = COALESCE(?, nome),
             ativo = COALESCE(?, ativo),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [nome ?? null, ativo === undefined ? null : Number(Boolean(ativo)), id, empresaId]
    );

    return buscarCategoriaPorId(empresaId, id);
}

async function excluirCategoria({ empresaId, id }) {
    return atualizarCategoria({ empresaId, id, ativo: false });
}

async function buscarCategoriaPorId(empresaId, id) {
    return buscarUm(
        `SELECT id, empresa_id, nome, ativo, created_at, updated_at
         FROM categorias
         WHERE id = ? AND empresa_id = ?`,
        [id, empresaId]
    );
}

module.exports = {
    listarCategorias,
    criarCategoria,
    atualizarCategoria,
    excluirCategoria,
    buscarCategoriaPorId
};
