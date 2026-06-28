const crypto = require('crypto');
const { executarComando, executarQuery, buscarUm } = require('../database');
const filiais = require('../filiais/repository');

const PLANOS = {
    basico: {
        limite_usuarios: 1,
        limite_produtos: 50,
        limite_vendas_mes: 100,
        limite_pdvs: 1,
        limite_filiais: 1
    },
    profissional: {
        limite_usuarios: 5,
        limite_produtos: 10000,
        limite_vendas_mes: 100000,
        limite_pdvs: 50,
        limite_filiais: 10
    }
};

async function criarLicenca({ empresaId, plano = 'basico', expiraEm = null }) {
    const limites = limitesPlano(plano);
    const result = await executarComando(
        `INSERT INTO licencas (
            empresa_id, codigo_licenca, plano, status,
            limite_usuarios, limite_produtos, limite_vendas_mes,
            limite_pdvs, limite_filiais, expira_em
         ) VALUES (?, ?, ?, 'ativa', ?, ?, ?, ?, ?, ?)`,
        [
            empresaId,
            gerarCodigoLicenca(),
            planoNormalizado(plano),
            limites.limite_usuarios,
            limites.limite_produtos,
            limites.limite_vendas_mes,
            limites.limite_pdvs,
            limites.limite_filiais,
            expiraEm
        ]
    );

    return (await buscarLicencaPorEmpresa(empresaId)) || buscarLicencaPorId(result.lastInsertRowid);
}

async function buscarLicencaPorId(id) {
    const licenca = await buscarUm('SELECT * FROM licencas WHERE id = ?', [id]);
    return garantirCodigoLicenca(licenca);
}

async function buscarLicencaPorEmpresa(empresaId) {
    const licenca = await buscarUm(
        `SELECT * FROM licencas
         WHERE empresa_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [empresaId]
    );
    return garantirCodigoLicenca(licenca);
}

async function buscarLicencaPorCodigo(codigo, documento = null) {
    const codigoLimpo = limpar(codigo);
    if (!codigoLimpo) return null;

    const params = [codigoLimpo, codigoLimpo];
    const whereDocumento = documento ? documentoSql(params, documento) : '';

    return buscarUm(
        `SELECT l.*, e.nome_fantasia AS empresa_nome, e.documento AS empresa_documento, e.status AS empresa_status
         FROM licencas l
         JOIN empresas e ON e.id = l.empresa_id
         WHERE (l.codigo_licenca = ? OR CAST(l.id AS TEXT) = ?)
         ${whereDocumento}
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 1`,
        params
    );
}

async function resumoPortal(empresaId) {
    const licenca = await buscarLicencaPorEmpresa(empresaId);
    if (!licenca) {
        const error = new Error('Licenca nao encontrada para esta empresa.');
        error.status = 404;
        throw error;
    }

    const [pdvsUsados, filiaisUsadas, ativacoes, heartbeat] = await Promise.all([
        contar('SELECT COUNT(*) AS total FROM pdvs WHERE empresa_id = ? AND ativo = 1', [empresaId]),
        contar('SELECT COUNT(*) AS total FROM filiais WHERE empresa_id = ? AND ativo = 1', [empresaId]),
        contar("SELECT COUNT(*) AS total FROM licenca_ativacoes WHERE empresa_id = ? AND status = 'ativa'", [empresaId]),
        buscarUm(
            `SELECT MAX(ultimo_heartbeat_at) AS ultimo_heartbeat
             FROM licenca_ativacoes
             WHERE empresa_id = ?`,
            [empresaId]
        )
    ]);

    const dispositivos = await listarAtivacoes(empresaId);

    return {
        licenca: licencaSeguro(licenca),
        uso: {
            pdvs_usados: pdvsUsados,
            pdvs_limite: Number(licenca.limite_pdvs || 0),
            filiais_usadas: filiaisUsadas,
            filiais_limite: Number(licenca.limite_filiais || 0),
            ativacoes_realizadas: ativacoes,
            ultimo_heartbeat: heartbeat?.ultimo_heartbeat || null
        },
        dispositivos
    };
}

async function listarAtivacoes(empresaId) {
    return executarQuery(
        `SELECT a.id, a.licenca_id, a.empresa_id, a.pdv_id, a.codigo_pdv,
                a.terminal_uuid, a.hostname, a.versao_app, a.status,
                a.ativado_at, a.ultimo_heartbeat_at, a.revogado_at,
                p.nome AS pdv_nome, p.filial_id, f.nome AS filial_nome
         FROM licenca_ativacoes a
         LEFT JOIN pdvs p ON p.id = a.pdv_id AND p.empresa_id = a.empresa_id
         LEFT JOIN filiais f ON f.id = p.filial_id AND f.empresa_id = a.empresa_id
         WHERE a.empresa_id = ?
         ORDER BY COALESCE(a.ultimo_heartbeat_at, a.ativado_at) DESC, a.id DESC`,
        [empresaId]
    );
}

async function regenerarLicenca(empresaId) {
    const licenca = await buscarLicencaPorEmpresa(empresaId);
    if (!licenca) {
        const error = new Error('Licenca nao encontrada para esta empresa.');
        error.status = 404;
        throw error;
    }

    const codigo = gerarCodigoLicenca();
    await executarComando(
        'UPDATE licencas SET codigo_licenca = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?',
        [codigo, licenca.id, empresaId]
    );
    await registrarLog({
        licencaId: licenca.id,
        empresaId,
        evento: 'regenerar_licenca',
        status: 'sucesso',
        mensagem: 'Codigo da licenca regenerado pelo portal.'
    });

    return buscarLicencaPorEmpresa(empresaId);
}

async function verificarLicenca({ cnpj, codigo }) {
    const licenca = await buscarLicencaPorCodigo(codigo, cnpj);
    if (!licenca) {
        await registrarLog({ evento: 'verificar_licenca', status: 'erro', mensagem: 'Empresa ou licenca nao encontrada.' });
        const error = new Error('Empresa ou licenca nao encontrada.');
        error.status = 404;
        throw error;
    }

    const empresa = empresaFromLicenca(licenca);
    const status = calcularStatusLicenca(empresa, licenca);
    await registrarLog({
        licencaId: licenca.id,
        empresaId: licenca.empresa_id,
        evento: 'verificar_licenca',
        status,
        mensagem: status === 'ativo' ? 'Licenca valida.' : 'Licenca nao liberada.'
    });

    return {
        autorizado: status === 'ativo',
        status,
        empresa: empresaSeguro(empresa),
        licenca: licencaSeguro(licenca),
        alerta_offline_dias: 7
    };
}

async function ativarPdv(payload) {
    const licenca = await buscarLicencaPorCodigo(payload.codigo_licenca || payload.codigo_empresa, payload.cnpj || payload.documento);
    if (!licenca) {
        await registrarLog({
            evento: 'ativar_pdv',
            status: 'erro',
            mensagem: 'Empresa ou licenca nao encontrada.',
            terminalUuid: payload.terminal_uuid || payload.machine_id,
            hostname: payload.hostname,
            versaoApp: payload.versao_app
        });
        const error = new Error('Empresa ou licenca nao encontrada.');
        error.status = 404;
        throw error;
    }

    const empresa = empresaFromLicenca(licenca);
    const statusLicenca = calcularStatusLicenca(empresa, licenca);
    if (statusLicenca !== 'ativo') {
        await registrarLogAtivacao(licenca, null, 'ativar_pdv', statusLicenca, 'Licenca nao permite ativacao.', payload);
        const error = new Error('Licenca nao permite ativacao deste PDV.');
        error.status = 403;
        error.licenciamento_status = statusLicenca;
        throw error;
    }

    await validarLimiteFiliais(licenca, payload.filial_id);

    const terminalUuid = limpar(payload.terminal_uuid || payload.machine_id);
    const codigoPdv = limpar(payload.codigo_pdv) || gerarCodigoPdv(payload.nome_pdv || payload.nome, terminalUuid);
    const existente = await buscarAtivacaoExistente({
        empresaId: licenca.empresa_id,
        licencaId: licenca.id,
        terminalUuid,
        codigoPdv
    });

    if (!existente) {
        await validarLimitePdvs(licenca);
    }

    const filial = payload.filial_id ? await filiais.buscarFilialPorId(licenca.empresa_id, Number(payload.filial_id)) : null;
    if (payload.filial_id && (!filial || !filial.ativo)) {
        const error = new Error('Filial nao encontrada para esta empresa.');
        error.status = 404;
        throw error;
    }

    const deviceToken = gerarDeviceToken();
    const tokenHash = hashToken(deviceToken);
    const pdv = filial ? await criarOuAtualizarPdv({ licenca, filial, codigoPdv, tokenHash, payload, terminalUuid }) : null;
    const ativacao = existente
        ? await atualizarAtivacao(existente.id, {
            pdvId: pdv?.id || existente.pdv_id,
            codigoPdv,
            terminalUuid,
            hostname: payload.hostname || payload.dispositivo_nome,
            versaoApp: payload.versao_app,
            tokenHash
        })
        : await criarAtivacao({
            licenca,
            pdv,
            codigoPdv,
            terminalUuid,
            hostname: payload.hostname || payload.dispositivo_nome,
            versaoApp: payload.versao_app,
            tokenHash
        });

    await registrarLogAtivacao(licenca, ativacao, 'ativar_pdv', 'ativo', 'PDV ativado.', payload);

    return {
        autorizado: true,
        status: 'ativo',
        device_token: deviceToken,
        ativacao: ativacaoSeguro(ativacao),
        empresa: empresaSeguro(empresa),
        filial,
        pdv,
        licenca: licencaSeguro(licenca),
        alerta_offline_dias: 7
    };
}

async function heartbeat(payload, deviceToken) {
    const ativacao = await buscarAtivacaoParaHeartbeat(payload, deviceToken);
    if (!ativacao) {
        const error = new Error('Ativacao nao encontrada.');
        error.status = 404;
        throw error;
    }

    if (ativacao.status !== 'ativa') {
        const error = new Error('Ativacao revogada ou bloqueada.');
        error.status = 403;
        throw error;
    }

    const licenca = await buscarLicencaPorId(ativacao.licenca_id);
    const empresa = await buscarEmpresaPorId(ativacao.empresa_id);
    const statusLicenca = calcularStatusLicenca(empresa, licenca);
    const versaoApp = limpar(payload.versao_app) || ativacao.versao_app;
    const hostname = limpar(payload.hostname) || ativacao.hostname;

    await executarComando(
        `UPDATE licenca_ativacoes
         SET ultimo_heartbeat_at = CURRENT_TIMESTAMP,
             hostname = COALESCE(?, hostname),
             versao_app = COALESCE(?, versao_app),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [hostname, versaoApp, ativacao.id, ativacao.empresa_id]
    );

    if (ativacao.pdv_id) {
        await executarComando(
            `UPDATE pdvs
             SET ultimo_sync = ?,
                 ultimo_acesso = CURRENT_TIMESTAMP,
                 status = ?,
                 versao_app = COALESCE(?, versao_app),
                 ultimo_usuario = COALESCE(?, ultimo_usuario),
                 licenciamento_status = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND empresa_id = ?`,
            [
                dataIso(payload.data_hora || payload.data || new Date().toISOString()),
                normalizarStatus(payload.status || 'online'),
                versaoApp,
                limpar(payload.usuario_logado),
                statusLicenca,
                ativacao.pdv_id,
                ativacao.empresa_id
            ]
        );
    }

    const atualizada = await buscarAtivacaoPorId(ativacao.empresa_id, ativacao.id);
    await registrarLogAtivacao(licenca, atualizada, 'heartbeat', statusLicenca, null, payload);

    return {
        autorizado: statusLicenca === 'ativo',
        status: statusLicenca,
        ultima_validacao: new Date().toISOString(),
        ativacao: ativacaoSeguro(atualizada),
        empresa: empresaSeguro(empresa),
        licenca: licencaSeguro(licenca),
        alerta_offline_dias: 7
    };
}

async function revogarAtivacao({ empresaId, ativacaoId, terminalUuid, codigoPdv }) {
    const ativacao = ativacaoId
        ? await buscarAtivacaoPorId(empresaId, Number(ativacaoId))
        : await buscarAtivacaoExistente({ empresaId, terminalUuid: limpar(terminalUuid), codigoPdv: limpar(codigoPdv) });

    if (!ativacao || Number(ativacao.empresa_id) !== Number(empresaId)) {
        const error = new Error('Ativacao nao encontrada para esta empresa.');
        error.status = 404;
        throw error;
    }

    await executarComando(
        `UPDATE licenca_ativacoes
         SET status = 'revogada',
             revogado_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [ativacao.id, empresaId]
    );

    if (ativacao.pdv_id) {
        await executarComando(
            `UPDATE pdvs
             SET ativo = 0,
                 status = 'bloqueado',
                 licenciamento_status = 'bloqueado',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND empresa_id = ?`,
            [ativacao.pdv_id, empresaId]
        );
    }

    const licenca = await buscarLicencaPorId(ativacao.licenca_id);
    const revogada = await buscarAtivacaoPorId(empresaId, ativacao.id);
    await registrarLogAtivacao(licenca, revogada, 'revogar_ativacao', 'revogada', 'Ativacao revogada pelo portal.', revogada);

    return revogada;
}

async function criarOuAtualizarPdv({ licenca, filial, codigoPdv, tokenHash, payload, terminalUuid }) {
    const existente = await buscarUm(
        `SELECT id FROM pdvs
         WHERE empresa_id = ?
           AND (codigo_pdv = ? OR (machine_id IS NOT NULL AND machine_id = ?))
         ORDER BY id DESC
         LIMIT 1`,
        [licenca.empresa_id, codigoPdv, terminalUuid]
    );

    if (existente) {
        await executarComando(
            `UPDATE pdvs
             SET filial_id = ?, nome = ?, codigo_pdv = ?, status = 'offline',
                 ultimo_sync = CURRENT_TIMESTAMP, versao_app = ?, ativo = 1,
                 device_token_hash = ?, machine_id = ?, dispositivo_nome = ?,
                 licenciamento_status = 'ativo', registrado_at = COALESCE(registrado_at, CURRENT_TIMESTAMP),
                 ultimo_acesso = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND empresa_id = ?`,
            [
                filial.id,
                limpar(payload.nome_pdv || payload.nome) || 'PDV Desktop',
                codigoPdv,
                limpar(payload.versao_app),
                tokenHash,
                terminalUuid,
                limpar(payload.hostname || payload.dispositivo_nome),
                existente.id,
                licenca.empresa_id
            ]
        );
        return buscarPdvPorId(licenca.empresa_id, existente.id);
    }

    const result = await executarComando(
        `INSERT INTO pdvs (
            empresa_id, filial_id, nome, codigo_pdv, status, ultimo_sync,
            versao_app, ativo, device_token_hash, machine_id, dispositivo_nome,
            licenciamento_status, registrado_at, ultimo_acesso
         ) VALUES (?, ?, ?, ?, 'offline', CURRENT_TIMESTAMP, ?, 1, ?, ?, ?, 'ativo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
            licenca.empresa_id,
            filial.id,
            limpar(payload.nome_pdv || payload.nome) || 'PDV Desktop',
            codigoPdv,
            limpar(payload.versao_app),
            tokenHash,
            terminalUuid,
            limpar(payload.hostname || payload.dispositivo_nome)
        ]
    );
    return buscarPdvPorId(licenca.empresa_id, result.lastInsertRowid);
}

async function criarAtivacao({ licenca, pdv, codigoPdv, terminalUuid, hostname, versaoApp, tokenHash }) {
    const result = await executarComando(
        `INSERT INTO licenca_ativacoes (
            licenca_id, empresa_id, pdv_id, codigo_pdv, terminal_uuid,
            hostname, versao_app, device_token_hash, status,
            ativado_at, ultimo_heartbeat_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativa', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [licenca.id, licenca.empresa_id, pdv?.id || null, codigoPdv, terminalUuid, limpar(hostname), limpar(versaoApp), tokenHash]
    );

    return buscarAtivacaoPorId(licenca.empresa_id, result.lastInsertRowid);
}

async function atualizarAtivacao(id, campos) {
    await executarComando(
        `UPDATE licenca_ativacoes
         SET pdv_id = COALESCE(?, pdv_id),
             codigo_pdv = COALESCE(?, codigo_pdv),
             terminal_uuid = COALESCE(?, terminal_uuid),
             hostname = COALESCE(?, hostname),
             versao_app = COALESCE(?, versao_app),
             device_token_hash = ?,
             status = 'ativa',
             revogado_at = NULL,
             ultimo_heartbeat_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
            campos.pdvId,
            campos.codigoPdv,
            campos.terminalUuid,
            limpar(campos.hostname),
            limpar(campos.versaoApp),
            campos.tokenHash,
            id
        ]
    );
    const row = await buscarUm('SELECT empresa_id FROM licenca_ativacoes WHERE id = ?', [id]);
    return buscarAtivacaoPorId(row.empresa_id, id);
}

async function buscarAtivacaoPorId(empresaId, id) {
    return buscarUm(
        `SELECT a.*, p.nome AS pdv_nome, p.filial_id, f.nome AS filial_nome
         FROM licenca_ativacoes a
         LEFT JOIN pdvs p ON p.id = a.pdv_id AND p.empresa_id = a.empresa_id
         LEFT JOIN filiais f ON f.id = p.filial_id AND f.empresa_id = a.empresa_id
         WHERE a.id = ? AND a.empresa_id = ?`,
        [id, empresaId]
    );
}

async function buscarAtivacaoExistente({ empresaId, licencaId = null, terminalUuid = null, codigoPdv = null }) {
    const params = [empresaId];
    const filtros = ['empresa_id = ?'];
    if (licencaId) {
        filtros.push('licenca_id = ?');
        params.push(licencaId);
    }

    const identidade = [];
    if (terminalUuid) {
        identidade.push('terminal_uuid = ?');
        params.push(terminalUuid);
    }
    if (codigoPdv) {
        identidade.push('codigo_pdv = ?');
        params.push(codigoPdv);
    }
    if (!identidade.length) return null;

    return buscarUm(
        `SELECT * FROM licenca_ativacoes
         WHERE ${filtros.join(' AND ')}
           AND (${identidade.join(' OR ')})
         ORDER BY id DESC
         LIMIT 1`,
        params
    );
}

async function buscarAtivacaoParaHeartbeat(payload, deviceToken) {
    if (deviceToken) {
        return buscarUm(
            `SELECT * FROM licenca_ativacoes
             WHERE device_token_hash = ?
             ORDER BY id DESC
             LIMIT 1`,
            [hashToken(deviceToken)]
        );
    }

    const licenca = await buscarLicencaPorCodigo(payload.codigo_licenca || payload.codigo_empresa);
    if (!licenca) return null;
    return buscarAtivacaoExistente({
        empresaId: licenca.empresa_id,
        licencaId: licenca.id,
        terminalUuid: limpar(payload.terminal_uuid || payload.machine_id),
        codigoPdv: limpar(payload.codigo_pdv)
    });
}

async function validarLimitePdvs(licenca) {
    const ativos = await contar(
        "SELECT COUNT(*) AS total FROM licenca_ativacoes WHERE licenca_id = ? AND empresa_id = ? AND status = 'ativa'",
        [licenca.id, licenca.empresa_id]
    );
    if (ativos >= Number(licenca.limite_pdvs || 0)) {
        const error = new Error('Limite de PDVs da licenca excedido.');
        error.status = 403;
        throw error;
    }
}

async function validarLimiteFiliais(licenca, filialId) {
    const usadas = await contar('SELECT COUNT(*) AS total FROM filiais WHERE empresa_id = ? AND ativo = 1', [licenca.empresa_id]);
    const limite = Number(licenca.limite_filiais || 0);
    if (filialId && usadas > limite) {
        const error = new Error('Limite de filiais da licenca excedido.');
        error.status = 403;
        throw error;
    }
}

async function garantirCodigoLicenca(licenca) {
    if (!licenca || licenca.codigo_licenca) return licenca;
    const codigo = gerarCodigoLicenca();
    await executarComando('UPDATE licencas SET codigo_licenca = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [codigo, licenca.id]);
    return { ...licenca, codigo_licenca: codigo };
}

async function buscarPdvPorId(empresaId, id) {
    return buscarUm(
        `SELECT p.id, p.empresa_id, p.filial_id, f.nome AS filial_nome,
                p.nome, p.codigo_pdv, p.status, p.ultimo_sync, p.versao_app,
                p.machine_id, p.dispositivo_nome, p.licenciamento_status,
                p.registrado_at, p.ultimo_acesso, p.ultimo_usuario,
                p.ultima_tentativa_sync, p.ultimo_sync_sucesso, p.ultimo_erro_sync,
                p.eventos_pendentes, p.eventos_enviados,
                p.ativo, p.created_at, p.updated_at
         FROM pdvs p
         JOIN filiais f ON f.id = p.filial_id AND f.empresa_id = p.empresa_id
         WHERE p.id = ? AND p.empresa_id = ?`,
        [id, empresaId]
    );
}

async function buscarEmpresaPorId(id) {
    return buscarUm('SELECT * FROM empresas WHERE id = ?', [id]);
}

async function contar(sql, params) {
    const row = await buscarUm(sql, params);
    return Number(row?.total || 0);
}

async function registrarLogAtivacao(licenca, ativacao, evento, status, mensagem, payload = {}) {
    await registrarLog({
        licencaId: licenca?.id || ativacao?.licenca_id || null,
        empresaId: licenca?.empresa_id || ativacao?.empresa_id || null,
        ativacaoId: ativacao?.id || null,
        evento,
        status,
        mensagem,
        terminalUuid: payload.terminal_uuid || payload.machine_id || ativacao?.terminal_uuid,
        hostname: payload.hostname || payload.dispositivo_nome || ativacao?.hostname,
        versaoApp: payload.versao_app || ativacao?.versao_app
    });
}

async function registrarLog({ licencaId = null, empresaId = null, ativacaoId = null, evento, status, mensagem = null, terminalUuid = null, hostname = null, versaoApp = null }) {
    await executarComando(
        `INSERT INTO licenca_logs (
            licenca_id, empresa_id, ativacao_id, evento, status, mensagem,
            terminal_uuid, hostname, versao_app
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [licencaId, empresaId, ativacaoId, evento, status, mensagem, limpar(terminalUuid), limpar(hostname), limpar(versaoApp)]
    );
}

function calcularStatusLicenca(empresa, licenca) {
    if (!empresa || empresa.status !== 'ativa') return 'bloqueado';
    if (!licenca || licenca.status === 'aguardando_ativacao') return 'aguardando_ativacao';
    if (licenca.expira_em && new Date(licenca.expira_em) < new Date()) return 'expirado';
    if (licenca.status !== 'ativa') return licenca.status === 'expirada' ? 'expirado' : 'bloqueado';
    if (!licenca.plano) return 'bloqueado';
    return 'ativo';
}

function empresaFromLicenca(licenca) {
    return {
        id: licenca.empresa_id,
        nome_fantasia: licenca.empresa_nome,
        documento: licenca.empresa_documento,
        status: licenca.empresa_status
    };
}

function empresaSeguro(empresa) {
    return {
        id: empresa.id,
        nome: empresa.nome_fantasia || empresa.nome,
        documento: empresa.documento || null,
        status: empresa.status || 'ativa'
    };
}

function licencaSeguro(licenca) {
    return {
        id: licenca?.id || null,
        codigo_licenca: licenca?.codigo_licenca || null,
        plano: licenca?.plano || null,
        status: licenca?.status || 'bloqueada',
        expira_em: licenca?.expira_em || null,
        limite_usuarios: Number(licenca?.limite_usuarios || 0),
        limite_produtos: Number(licenca?.limite_produtos || 0),
        limite_vendas_mes: Number(licenca?.limite_vendas_mes || 0),
        limite_pdvs: Number(licenca?.limite_pdvs || 0),
        limite_filiais: Number(licenca?.limite_filiais || 0),
        created_at: licenca?.created_at || null,
        updated_at: licenca?.updated_at || null
    };
}

function ativacaoSeguro(ativacao) {
    return {
        id: ativacao?.id || null,
        pdv_id: ativacao?.pdv_id || null,
        codigo_pdv: ativacao?.codigo_pdv || null,
        terminal_uuid: ativacao?.terminal_uuid || null,
        hostname: ativacao?.hostname || null,
        versao_app: ativacao?.versao_app || null,
        status: ativacao?.status || null,
        ativado_at: ativacao?.ativado_at || null,
        ultimo_heartbeat_at: ativacao?.ultimo_heartbeat_at || null,
        revogado_at: ativacao?.revogado_at || null
    };
}

function limitesPlano(plano) {
    return PLANOS[planoNormalizado(plano)] || PLANOS.basico;
}

function planoNormalizado(plano) {
    return plano === 'profissional' ? 'profissional' : 'basico';
}

function gerarCodigoLicenca() {
    return crypto.randomUUID();
}

function gerarDeviceToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function gerarCodigoPdv(nome, terminalUuid) {
    const base = limpar(nome || 'PDV').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase() || 'PDV';
    const suffix = crypto.createHash('sha1').update(String(terminalUuid || Date.now())).digest('hex').slice(0, 6).toUpperCase();
    return `${base}-${suffix}`;
}

function normalizarStatus(status) {
    const value = limpar(status) || 'online';
    return ['online', 'offline', 'sincronizando', 'erro', 'bloqueado'].includes(value) ? value : 'online';
}

function documentoSql(params, documento) {
    const normalizado = String(documento || '').replace(/\D/g, '');
    if (!normalizado) return '';
    params.push(normalizado);
    return "AND REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(e.documento, ''), '.', ''), '/', ''), '-', ''), ' ', '') = ?";
}

function dataIso(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
}

function limpar(value) {
    const text = String(value || '').trim();
    return text || null;
}

module.exports = {
    criarLicenca,
    buscarLicencaPorId,
    buscarLicencaPorEmpresa,
    buscarLicencaPorCodigo,
    resumoPortal,
    listarAtivacoes,
    regenerarLicenca,
    verificarLicenca,
    ativarPdv,
    heartbeat,
    revogarAtivacao,
    calcularStatusLicenca,
    licencaSeguro,
    ativacaoSeguro,
    PLANOS
};
