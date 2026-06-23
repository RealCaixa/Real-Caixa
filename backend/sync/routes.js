const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const repository = require('./repository');
const pdvs = require('../pdvs/repository');
const logger = require('../logger');

const router = express.Router();
const DIRECAO = 'portal_para_pdv';
const DIRECAO_ENTRADA = 'pdv_para_portal';

router.get('/auditoria', autenticar, exigirPermissao('dashboard:ver'), async (req, res) => {
    res.json(await pdvs.listarAuditoriaSync(req.user.empresa_id));
});

router.get('/produtos', autenticarSync, criarHandlerSync('produtos', repository.listarProdutosAlterados));
router.get('/categorias', autenticarSync, criarHandlerSync('categorias', repository.listarCategoriasAlteradas));
router.get('/usuarios', autenticarSync, criarHandlerSync('usuarios', repository.listarUsuariosAlterados));
router.get('/permissoes', autenticarSync, criarHandlerSync('permissoes', repository.listarPermissoesAlteradas));
router.get('/configuracoes', autenticarSync, criarHandlerSync('configuracoes', repository.listarConfiguracoesAlteradas));
router.get('/filiais', autenticarSync, criarHandlerSync('filiais', repository.listarFiliaisAlteradas));
router.get('/licenca', autenticarSync, criarHandlerSync('licenca', repository.listarLicencaAlterada));

router.post('/vendas', autenticarOperacionalSync, criarHandlerRecebimento('vendas', (req) => repository.receberVendas({
    empresaId: req.user.empresa_id,
    usuarioId: req.user.usuario_id ?? req.user.id ?? null,
    pdvId: req.syncPdv.id,
    filialId: req.syncPdv.filial_id,
    vendas: req.body.vendas || req.body.venda
})));
router.post('/caixa', autenticarOperacionalSync, criarHandlerRecebimento('caixa', (req) => repository.receberCaixa({
    empresaId: req.user.empresa_id,
    pdvId: req.syncPdv.id,
    filialId: req.syncPdv.filial_id,
    movimentacoes: req.body.movimentacoes,
    fechamentos: req.body.fechamentos
})));
router.post('/estoque-movimentacoes', autenticarOperacionalSync, criarHandlerRecebimento('estoque-movimentacoes', (req) => repository.receberEstoqueMovimentacoes({
    empresaId: req.user.empresa_id,
    usuarioId: req.user.usuario_id ?? req.user.id ?? null,
    pdvId: req.syncPdv.id,
    filialId: req.syncPdv.filial_id,
    movimentacoes: req.body.movimentacoes || req.body.movimentacao
})));

function criarHandlerSync(recurso, listar) {
    return async (req, res, next) => {
        const empresaId = req.user.empresa_id;
        const usuarioId = req.user.usuario_id ?? req.user.id ?? null;

        try {
            const lastSyncAt = normalizarLastSyncAt(req.query.last_sync_at);
            const paginacao = normalizarPaginacao(req.query);
            const serverSyncAt = new Date().toISOString();
            logger.info('Sync Portal para PDV iniciada', { empresaId, recurso, lastSyncAt: lastSyncAt || 'completa' });
            await repository.registrarLog({
                empresaId,
                usuarioId,
                recurso,
                status: 'iniciada',
                lastSyncAt
            });

            const resultado = await listar(empresaId, lastSyncAt, paginacao);
            const dados = Array.isArray(resultado) ? resultado : resultado.dados;
            const nextCursor = Array.isArray(resultado) ? null : resultado.next_cursor;

            await repository.registrarLog({
                empresaId,
                usuarioId,
                recurso,
                status: 'concluida',
                lastSyncAt,
                total: dados.length
            });
            if (req.user.tipo === 'device') {
                await pdvs.registrarSucessoSync({
                    empresaId,
                    pdvId: req.user.pdv_id,
                    eventosEnviados: 0,
                    eventosPendentes: req.query.eventos_pendentes || null
                });
            }
            logger.info('Sync Portal para PDV concluida', { empresaId, recurso, total: dados.length });

            return res.json({
                recurso,
                direcao: DIRECAO,
                last_sync_at: lastSyncAt,
                server_sync_at: serverSyncAt,
                limit: paginacao.limit,
                next_cursor: nextCursor,
                total: dados.length,
                dados
            });
        } catch (error) {
            if (req.user?.tipo === 'device') {
                await pdvs.registrarErroSync({
                    empresaId,
                    pdvId: req.user.pdv_id,
                    erro: error.message,
                    eventosPendentes: req.query.eventos_pendentes
                });
            }
            await repository.registrarLog({
                empresaId,
                usuarioId,
                recurso,
                status: 'erro',
                lastSyncAt: null,
                erro: error.message
            });
            logger.error('Sync Portal para PDV com erro', { empresaId, recurso, erro: error.message });
            return next(error);
        }
    };
}

async function autenticarSync(req, res, next) {
    const authorization = req.headers.authorization || '';
    if (authorization.startsWith('Device ')) {
        try {
            req.user = await pdvs.autenticarDispositivo(authorization.slice('Device '.length).trim());
            await pdvs.registrarTentativaSync({
                empresaId: req.user.empresa_id,
                pdvId: req.user.pdv_id,
                eventosPendentes: req.query.eventos_pendentes
            });
            return next();
        } catch (error) {
            return next(error);
        }
    }

    return autenticar(req, res, (error) => {
        if (error) return next(error);
        return exigirPermissao('dashboard:ver')(req, res, next);
    });
}

async function autenticarOperacionalSync(req, res, next) {
    const authorization = req.headers.authorization || '';
    if (authorization.startsWith('Device ')) {
        try {
            req.user = await pdvs.autenticarDispositivo(authorization.slice('Device '.length).trim());
            req.syncPdv = await validarPdvDaRequisicao(req, req.user);
            await pdvs.registrarTentativaSync({
                empresaId: req.user.empresa_id,
                pdvId: req.syncPdv.id,
                eventosPendentes: req.body?.eventos_pendentes
            });
            return next();
        } catch (error) {
            return next(error);
        }
    }

    return autenticar(req, res, (error) => {
        if (error) return next(error);
        return exigirPermissao('dashboard:ver')(req, res, (permissaoError) => {
            if (permissaoError) return next(permissaoError);
            try {
                validarPdvDaRequisicao(req, req.user)
                    .then((pdv) => {
                        req.syncPdv = pdv;
                        return next();
                    })
                    .catch(next);
            } catch (validationError) {
                return next(validationError);
            }
        });
    });
}

async function validarPdvDaRequisicao(req, user) {
    const body = req.body || {};
    const pdv = await pdvs.validarPdvSincronizacao({
        empresaId: user.empresa_id,
        pdvId: body.pdv_id || body.codigo_pdv || user.pdv_id || user.codigo_pdv,
        filialId: body.filial_id || user.filial_id
    });

    if (user.tipo === 'device' && Number(user.pdv_id) !== Number(pdv.id)) {
        const error = new Error('Token de dispositivo nao pertence ao PDV informado.');
        error.status = 403;
        throw error;
    }

    return pdv;
}

function criarHandlerRecebimento(recurso, receber) {
    return async (req, res, next) => {
        const empresaId = req.user.empresa_id;
        const usuarioId = req.user.usuario_id ?? (Number.isInteger(req.user.id) ? req.user.id : null);

        try {
            logger.info('Sync PDV para Portal iniciada', { empresaId, recurso });
            await repository.registrarLog({
                empresaId,
                usuarioId,
                recurso,
                status: 'iniciada'
            });

            const resultado = await receber(req);
            if (req.syncPdv?.id) {
                await pdvs.registrarSucessoSync({
                    empresaId,
                    pdvId: req.syncPdv.id,
                    eventosEnviados: resultado.recebidos || 0,
                    eventosPendentes: req.body?.eventos_pendentes || 0
                });
            }
            await repository.registrarLog({
                empresaId,
                usuarioId,
                recurso,
                status: 'concluida',
                total: resultado.total
            });
            logger.info('Sync PDV para Portal concluida', { empresaId, recurso, total: resultado.total });

            return res.status(202).json({
                recurso,
                direcao: DIRECAO_ENTRADA,
                server_sync_at: new Date().toISOString(),
                ...resultado
            });
        } catch (error) {
            if (req.syncPdv?.id) {
                await pdvs.registrarErroSync({
                    empresaId,
                    pdvId: req.syncPdv.id,
                    erro: error.message,
                    eventosPendentes: req.body?.eventos_pendentes
                });
            }
            await repository.registrarLog({
                empresaId,
                usuarioId,
                recurso,
                status: 'erro',
                erro: error.message
            });
            logger.error('Sync PDV para Portal com erro', { empresaId, recurso, erro: error.message });
            return next(error);
        }
    };
}

function normalizarLastSyncAt(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
        const error = new Error('last_sync_at invalido.');
        error.status = 400;
        throw error;
    }

    return parsed.toISOString();
}

function normalizarPaginacao(query) {
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
    const cursor = query.cursor === undefined || query.cursor === null || query.cursor === ''
        ? 0
        : Number(query.cursor);

    if (!Number.isInteger(cursor) || cursor < 0) {
        const error = new Error('cursor invalido.');
        error.status = 400;
        throw error;
    }

    return { limit, cursor };
}

module.exports = router;
