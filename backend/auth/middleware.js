const { verificarToken, normalizarPermissoes } = require('./jwt');
const { buscarUsuarioPorId } = require('../users/repository');

async function autenticar(req, res, next) {
    const token = extrairBearerToken(req);

    if (!token) {
        return res.status(401).json({ erro: 'Sessao nao autenticada.' });
    }

    try {
        const payload = verificarToken(token);
        const usuario = await buscarUsuarioPorId(payload.id);

        if (!usuario || usuario.status !== 'ativo') {
            return res.status(401).json({ erro: 'Usuario inativo ou inexistente.' });
        }

        if (usuario.licenca_status && usuario.licenca_status !== 'ativa') {
            return res.status(403).json({ erro: 'Licenca inativa.' });
        }

        req.user = {
            id: usuario.id,
            empresa_id: usuario.empresa_id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil,
            permissoes: normalizarPermissoes(usuario.permissoes),
            plano: usuario.plano || 'basico'
        };

        next();
    } catch (_) {
        return res.status(401).json({ erro: 'Sessao expirada ou invalida.' });
    }
}

function exigirPermissao(permissao) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ erro: 'Sessao nao autenticada.' });
        }

        const permissoes = req.user.permissoes || [];
        const ehAdminCliente = req.user.perfil === 'cliente_admin';

        if (ehAdminCliente || permissoes.includes(permissao)) {
            return next();
        }

        return res.status(403).json({ erro: 'Permissao insuficiente.' });
    };
}

function extrairBearerToken(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return null;
    }
    return header.slice('Bearer '.length).trim();
}

module.exports = {
    autenticar,
    exigirPermissao
};
