const express = require('express');
const { verificarToken } = require('../auth/jwt');
const users = require('../users/repository');
const contadorRepo = require('../contador/repository');
const assistantService = require('./assistantService');

const router = express.Router();

router.post('/perguntar', autenticarAssistente, (req, res) => {
    responder(res, async () => {
        const empresaId = await resolverEmpresa(req);
        const resultado = await assistantService.perguntar({
            empresaId,
            usuarioId: req.assistente.usuario?.id,
            contadorId: req.assistente.contador?.id,
            origem: req.assistente.origem,
            pergunta: req.body?.pergunta
        });
        return resultado;
    });
});

async function autenticarAssistente(req, res, next) {
    const token = extrairBearer(req);
    if (!token) {
        return res.status(401).json({ erro: 'Sessao nao autenticada.' });
    }

    try {
        const payload = verificarToken(token);
        if (payload.perfil === 'contador') {
            throw new Error('token_contador');
        }

        const usuario = await users.buscarUsuarioPorId(payload.id);
        if (!usuario || usuario.status !== 'ativo') {
            throw new Error('usuario_invalido');
        }

        req.assistente = {
            origem: 'portal',
            usuario: {
                id: usuario.id,
                empresa_id: usuario.empresa_id,
                perfil: usuario.perfil
            }
        };
        return next();
    } catch (_) {
        // Continua para tentar token de contador.
    }

    try {
        const contador = await contadorRepo.autenticarToken(token);
        req.assistente = { origem: 'contador', contador };
        return next();
    } catch (_) {
        return res.status(401).json({ erro: 'Sessao expirada ou invalida.' });
    }
}

async function resolverEmpresa(req) {
    if (req.assistente.origem === 'portal') {
        return req.assistente.usuario.empresa_id;
    }

    const empresaId = Number(req.body?.empresa_id || req.query?.empresa_id);
    if (!empresaId) {
        erro('empresa_id e obrigatorio para acesso do contador.', 400);
    }
    await contadorRepo.exigirAcesso(req.assistente.contador.id, empresaId);
    return empresaId;
}

function extrairBearer(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim();
}

async function responder(res, callback) {
    try {
        res.json(await callback());
    } catch (error) {
        res.status(error.status || 500).json({ erro: error.message || 'Erro interno do servidor.' });
    }
}

function erro(message, status) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

module.exports = router;
