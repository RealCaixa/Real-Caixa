const { executarComando, buscarUm } = require('../database');

const PLANOS = {
    basico: {
        limite_usuarios: 1,
        limite_produtos: 50,
        limite_vendas_mes: 100
    },
    profissional: {
        limite_usuarios: 5,
        limite_produtos: 10000,
        limite_vendas_mes: 100000
    }
};

async function criarLicenca({ empresaId, plano = 'basico' }) {
    const limites = PLANOS[plano] || PLANOS.basico;
    const result = await executarComando(
        `INSERT INTO licencas (
            empresa_id, plano, limite_usuarios, limite_produtos, limite_vendas_mes
         ) VALUES (?, ?, ?, ?, ?)`,
        [empresaId, plano, limites.limite_usuarios, limites.limite_produtos, limites.limite_vendas_mes]
    );

    return (await buscarLicencaPorEmpresa(empresaId)) || buscarLicencaPorId(result.lastInsertRowid);
}

async function buscarLicencaPorId(id) {
    return buscarUm('SELECT * FROM licencas WHERE id = ?', [id]);
}

async function buscarLicencaPorEmpresa(empresaId) {
    return buscarUm(
        `SELECT * FROM licencas
         WHERE empresa_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [empresaId]
    );
}

module.exports = {
    criarLicenca,
    buscarLicencaPorId,
    buscarLicencaPorEmpresa,
    PLANOS
};
