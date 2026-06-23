const jwt = require('jsonwebtoken');
const security = require('../config/security');

function gerarToken(usuario) {
    return jwt.sign(
        {
            sub: String(usuario.id),
            id: usuario.id,
            empresa_id: usuario.empresa_id,
            email: usuario.email,
            perfil: usuario.perfil,
            permissoes: normalizarPermissoes(usuario.permissoes)
        },
        security.jwtSecret(),
        { expiresIn: security.jwtExpiresIn() }
    );
}

function verificarToken(token) {
    return jwt.verify(token, security.jwtSecret());
}

function normalizarPermissoes(permissoes) {
    if (Array.isArray(permissoes)) {
        return permissoes;
    }

    try {
        return JSON.parse(permissoes || '[]');
    } catch (_) {
        return [];
    }
}

module.exports = {
    gerarToken,
    verificarToken,
    normalizarPermissoes
};
