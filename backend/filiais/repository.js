const { executarComando, executarQuery, buscarUm } = require('../database');

async function listarFiliais({ empresaId, busca = '', incluirInativas = false }) {
    const params = [empresaId];
    const where = ['empresa_id = ?'];

    if (!incluirInativas) {
        where.push('ativo = 1');
    }
    if (busca) {
        where.push('(nome LIKE ? OR cnpj LIKE ? OR cidade LIKE ?)');
        params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }

    return executarQuery(
        `SELECT id, empresa_id, nome, cnpj, ie, endereco, numero, bairro,
                cidade, estado, cep, telefone, ativo, created_at, updated_at
         FROM filiais
         WHERE ${where.join(' AND ')}
         ORDER BY nome ASC`,
        params
    );
}

async function criarFilial({ empresaId, campos }) {
    validarNome(campos.nome);
    await validarCnpjDuplicado(empresaId, campos.cnpj);
    const result = await executarComando(
        `INSERT INTO filiais (
            empresa_id, nome, cnpj, ie, endereco, numero, bairro, cidade,
            estado, cep, telefone
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            empresaId,
            limpar(campos.nome),
            limpar(campos.cnpj),
            limpar(campos.ie),
            limpar(campos.endereco),
            limpar(campos.numero),
            limpar(campos.bairro),
            limpar(campos.cidade),
            limpar(campos.estado),
            limpar(campos.cep),
            limpar(campos.telefone)
        ]
    );

    return buscarFilialPorId(empresaId, result.lastInsertRowid);
}

async function atualizarFilial({ empresaId, id, campos }) {
    const atual = await buscarFilialPorId(empresaId, id);
    if (!atual) return null;
    if (campos.nome !== undefined) validarNome(campos.nome);
    if (campos.cnpj !== undefined) await validarCnpjDuplicado(empresaId, campos.cnpj, id);

    const proxima = { ...atual, ...normalizarCampos(campos) };
    await executarComando(
        `UPDATE filiais
         SET nome = ?, cnpj = ?, ie = ?, endereco = ?, numero = ?, bairro = ?,
             cidade = ?, estado = ?, cep = ?, telefone = ?, ativo = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [
            proxima.nome,
            proxima.cnpj,
            proxima.ie,
            proxima.endereco,
            proxima.numero,
            proxima.bairro,
            proxima.cidade,
            proxima.estado,
            proxima.cep,
            proxima.telefone,
            Number(Boolean(proxima.ativo)),
            id,
            empresaId
        ]
    );

    return buscarFilialPorId(empresaId, id);
}

async function desativarFilial({ empresaId, id }) {
    return atualizarFilial({ empresaId, id, campos: { ativo: false } });
}

async function buscarFilialPorId(empresaId, id) {
    return buscarUm(
        `SELECT id, empresa_id, nome, cnpj, ie, endereco, numero, bairro,
                cidade, estado, cep, telefone, ativo, created_at, updated_at
         FROM filiais
         WHERE id = ? AND empresa_id = ?`,
        [id, empresaId]
    );
}

function validarNome(nome) {
    if (!limpar(nome)) {
        const error = new Error('Nome da filial e obrigatorio.');
        error.status = 400;
        throw error;
    }
}

async function validarCnpjDuplicado(empresaId, cnpj, ignorarId = null) {
    const cnpjLimpo = limpar(cnpj);
    if (!cnpjLimpo) return;

    const existente = await buscarUm(
        'SELECT id FROM filiais WHERE empresa_id = ? AND cnpj = ? AND (? IS NULL OR id <> ?)',
        [empresaId, cnpjLimpo, ignorarId, ignorarId]
    );
    if (existente) {
        const error = new Error('Ja existe uma filial com este CNPJ nesta empresa.');
        error.status = 409;
        throw error;
    }
}

function normalizarCampos(campos) {
    const normalizado = {};
    ['nome', 'cnpj', 'ie', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'telefone'].forEach((campo) => {
        if (campos[campo] !== undefined) normalizado[campo] = limpar(campos[campo]);
    });
    if (campos.ativo !== undefined) normalizado.ativo = Number(Boolean(campos.ativo));
    return normalizado;
}

function limpar(value) {
    const text = String(value || '').trim();
    return text || null;
}

module.exports = {
    listarFiliais,
    criarFilial,
    atualizarFilial,
    desativarFilial,
    buscarFilialPorId
};
