const { executarComando, buscarUm } = require('../database');

async function criarUsuario({ empresaId, nome, email, senhaHash, perfil = 'cliente_admin', permissoes = [] }) {
    const result = await executarComando(
        `INSERT INTO usuarios (empresa_id, nome, email, senha_hash, perfil, permissoes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [empresaId, nome, normalizarEmail(email), senhaHash, perfil, JSON.stringify(permissoes)]
    );

    return buscarUsuarioPorId(result.lastInsertRowid);
}

async function buscarUsuarioPorEmail(email) {
    return buscarUm(
        `SELECT u.*, e.nome_fantasia AS empresa_nome, l.plano, l.status AS licenca_status
         FROM usuarios u
         JOIN empresas e ON e.id = u.empresa_id
         LEFT JOIN licencas l ON l.empresa_id = e.id
         WHERE u.email = ?
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 1`,
        [normalizarEmail(email)]
    );
}

async function buscarUsuarioPorId(id) {
    return buscarUm(
        `SELECT u.*, e.nome_fantasia AS empresa_nome, l.plano, l.status AS licenca_status
         FROM usuarios u
         JOIN empresas e ON e.id = u.empresa_id
         LEFT JOIN licencas l ON l.empresa_id = e.id
         WHERE u.id = ?
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 1`,
        [id]
    );
}

async function registrarUltimoLogin(id) {
    await executarComando(
        'UPDATE usuarios SET ultimo_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
    );
}

function normalizarEmail(email) {
    return String(email || '').trim().toLowerCase();
}

module.exports = {
    criarUsuario,
    buscarUsuarioPorEmail,
    buscarUsuarioPorId,
    registrarUltimoLogin,
    normalizarEmail
};
