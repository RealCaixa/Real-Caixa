const { executarComando, buscarUm } = require('../database');

async function criarEmpresa({ nomeFantasia, razaoSocial, documento, telefone, email }) {
    const result = await executarComando(
        `INSERT INTO empresas (nome_fantasia, razao_social, documento, telefone, email)
         VALUES (?, ?, ?, ?, ?)`,
        [nomeFantasia, razaoSocial || null, documento || null, telefone || null, email || null]
    );

    return buscarEmpresaPorId(result.lastInsertRowid);
}

async function buscarEmpresaPorId(id) {
    return buscarUm('SELECT * FROM empresas WHERE id = ?', [id]);
}

module.exports = {
    criarEmpresa,
    buscarEmpresaPorId
};
