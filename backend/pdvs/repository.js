const crypto = require('crypto');
const { executarComando, executarQuery, buscarUm } = require('../database');
const filiais = require('../filiais/repository');

const STATUS = new Set(['online', 'offline', 'sincronizando', 'erro', 'bloqueado']);
const LICENCIAMENTO_STATUS = new Set(['ativo', 'bloqueado', 'expirado', 'aguardando_ativacao']);

async function listarPdvs({ empresaId, filialId, busca = '', incluirInativos = false }) {
    const params = [empresaId];
    const where = ['p.empresa_id = ?'];

    if (!incluirInativos) {
        where.push('p.ativo = 1');
    }
    if (filialId) {
        where.push('p.filial_id = ?');
        params.push(Number(filialId));
    }
    if (busca) {
        where.push('(p.nome LIKE ? OR p.codigo_pdv LIKE ? OR f.nome LIKE ?)');
        params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }

    return executarQuery(
        `SELECT p.id, p.empresa_id, p.filial_id, f.nome AS filial_nome,
                p.nome, p.codigo_pdv, p.status, p.ultimo_sync, p.versao_app,
                p.machine_id, p.dispositivo_nome, p.licenciamento_status,
                p.registrado_at, p.ultimo_acesso, p.ultimo_usuario,
                p.ultima_tentativa_sync, p.ultimo_sync_sucesso, p.ultimo_erro_sync,
                p.eventos_pendentes, p.eventos_enviados,
                p.ativo, p.created_at, p.updated_at
         FROM pdvs p
         JOIN filiais f ON f.id = p.filial_id AND f.empresa_id = p.empresa_id
         WHERE ${where.join(' AND ')}
         ORDER BY f.nome ASC, p.nome ASC`,
        params
    );
}

async function criarPdv({ empresaId, campos }) {
    validarCamposObrigatorios(campos);
    await validarFilial(empresaId, campos.filial_id);
    await validarCodigoDuplicado(empresaId, campos.codigo_pdv);

    const result = await executarComando(
        `INSERT INTO pdvs (
            empresa_id, filial_id, nome, codigo_pdv, status, ultimo_sync, versao_app
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            empresaId,
            Number(campos.filial_id),
            limpar(campos.nome),
            limpar(campos.codigo_pdv),
            normalizarStatus(campos.status),
            limpar(campos.ultimo_sync),
            limpar(campos.versao_app)
        ]
    );

    return buscarPdvPorId(empresaId, result.lastInsertRowid);
}

async function atualizarPdv({ empresaId, id, campos }) {
    const atual = await buscarPdvPorId(empresaId, id);
    if (!atual) return null;

    if (campos.filial_id !== undefined) await validarFilial(empresaId, campos.filial_id);
    const proximo = normalizarCampos({ ...atual, ...campos });

    if (proximo.codigo_pdv !== atual.codigo_pdv) {
        await validarCodigoDuplicado(empresaId, proximo.codigo_pdv, id);
    }

    await executarComando(
        `UPDATE pdvs
         SET filial_id = ?, nome = ?, codigo_pdv = ?, status = ?,
             ultimo_sync = ?, versao_app = ?, ativo = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [
            Number(proximo.filial_id),
            proximo.nome,
            proximo.codigo_pdv,
            proximo.status,
            proximo.ultimo_sync,
            proximo.versao_app,
            Number(Boolean(proximo.ativo)),
            id,
            empresaId
        ]
    );

    return buscarPdvPorId(empresaId, id);
}

async function desativarPdv({ empresaId, id }) {
    return atualizarPdv({ empresaId, id, campos: { ativo: false, status: 'bloqueado' } });
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

async function indicadores(empresaId) {
    const totalFiliais = (await buscarUm('SELECT COUNT(*) AS total FROM filiais WHERE empresa_id = ? AND ativo = 1', [empresaId]))?.total || 0;
    const pdvsAtivos = (await buscarUm('SELECT COUNT(*) AS total FROM pdvs WHERE empresa_id = ? AND ativo = 1', [empresaId]))?.total || 0;
    const pdvsOffline = (await buscarUm(
        "SELECT COUNT(*) AS total FROM pdvs WHERE empresa_id = ? AND ativo = 1 AND status <> 'online'",
        [empresaId]
    ))?.total || 0;
    const ultima = (await buscarUm(
        `SELECT MAX(ultimo_sync) AS ultima_sincronizacao
         FROM pdvs
         WHERE empresa_id = ? AND ativo = 1`,
        [empresaId]
    ))?.ultima_sincronizacao || null;

    return { total_filiais: totalFiliais, pdvs_ativos: pdvsAtivos, pdvs_offline: pdvsOffline, ultima_sincronizacao: ultima };
}

async function verificarLicenca({ cnpj, codigo }) {
    const empresa = await buscarEmpresaPorDocumento(cnpj, codigo);
    if (!empresa) {
        await registrarLicenciamentoLog({ evento: 'verificar_licenca', status: 'erro', mensagem: 'CNPJ ou codigo nao encontrado.' });
        const error = new Error('Empresa ou licenca nao encontrada.');
        error.status = 404;
        throw error;
    }

    const licenca = await buscarLicencaDaEmpresa(empresa.id);
    const status = calcularStatusLicenca(empresa, licenca);
    await registrarLicenciamentoLog({
        empresaId: empresa.id,
        evento: 'verificar_licenca',
        status,
        mensagem: status === 'ativo' ? 'Licenca valida.' : 'Licenca nao liberada.'
    });

    return respostaLicenca({ empresa, licenca, status });
}

async function registrarPdv(payload) {
    const empresa = await buscarEmpresaPorDocumento(payload.cnpj, payload.codigo_licenca || payload.codigo_empresa);
    if (!empresa) {
        await registrarLicenciamentoLog({
            evento: 'registrar_pdv',
            status: 'erro',
            machineId: payload.machine_id,
            versaoApp: payload.versao_app,
            mensagem: 'CNPJ ou codigo nao encontrado.'
        });
        const error = new Error('Empresa ou licenca nao encontrada.');
        error.status = 404;
        throw error;
    }

    const licenca = await buscarLicencaDaEmpresa(empresa.id);
    const statusLicenca = calcularStatusLicenca(empresa, licenca);
    if (statusLicenca !== 'ativo') {
        await registrarLicenciamentoLog({
            empresaId: empresa.id,
            evento: 'registrar_pdv',
            status: statusLicenca,
            machineId: payload.machine_id,
            versaoApp: payload.versao_app,
            mensagem: 'Licenca nao permite ativacao.'
        });
        const error = new Error('Licenca nao permite ativacao deste PDV.');
        error.status = 403;
        error.licenciamento_status = statusLicenca;
        throw error;
    }

    const filial = await validarFilialParaAtivacao(empresa.id, payload.filial_id);
    const codigoPdv = limpar(payload.codigo_pdv) || gerarCodigoPdv(payload.nome_pdv || payload.nome, payload.machine_id);
    const existente = await buscarUm(
        'SELECT id FROM pdvs WHERE empresa_id = ? AND (codigo_pdv = ? OR (machine_id IS NOT NULL AND machine_id = ?))',
        [empresa.id, codigoPdv, limpar(payload.machine_id)]
    );
    const deviceToken = gerarDeviceToken();
    const tokenHash = hashToken(deviceToken);

    let pdv;
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
                limpar(payload.machine_id),
                limpar(payload.dispositivo_nome),
                existente.id,
                empresa.id
            ]
        );
        pdv = await buscarPdvPorId(empresa.id, existente.id);
    } else {
        const result = await executarComando(
            `INSERT INTO pdvs (
                empresa_id, filial_id, nome, codigo_pdv, status, ultimo_sync,
                versao_app, ativo, device_token_hash, machine_id, dispositivo_nome,
                licenciamento_status, registrado_at, ultimo_acesso
             ) VALUES (?, ?, ?, ?, 'offline', CURRENT_TIMESTAMP, ?, 1, ?, ?, ?, 'ativo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                empresa.id,
                filial.id,
                limpar(payload.nome_pdv || payload.nome) || 'PDV Desktop',
                codigoPdv,
                limpar(payload.versao_app),
                tokenHash,
                limpar(payload.machine_id),
                limpar(payload.dispositivo_nome)
            ]
        );
        pdv = await buscarPdvPorId(empresa.id, result.lastInsertRowid);
    }

    await registrarLicenciamentoLog({
        empresaId: empresa.id,
        filialId: filial.id,
        pdvId: pdv.id,
        codigoPdv: pdv.codigo_pdv,
        evento: 'registrar_pdv',
        status: 'ativo',
        machineId: payload.machine_id,
        versaoApp: payload.versao_app,
        mensagem: 'PDV ativado.'
    });

    return {
        autorizado: true,
        device_token: deviceToken,
        empresa: empresaSeguro(empresa),
        filial,
        pdv,
        licenca: licencaSeguro(licenca),
        alerta_offline_dias: 7
    };
}

async function statusPdv({ codigoPdv, deviceToken }) {
    const pdv = await buscarPdvPorCodigoComToken(codigoPdv, deviceToken);
    validarPdvComToken(pdv, deviceToken);
    const empresa = await buscarEmpresaPorId(pdv.empresa_id);
    const licenca = await buscarLicencaDaEmpresa(pdv.empresa_id);
    const statusLicenca = calcularStatusLicenca(empresa, licenca);
    const status = pdv.ativo ? statusLicenca : 'bloqueado';

    if (status !== pdv.licenciamento_status) {
        await atualizarLicenciamentoStatus(pdv.id, pdv.empresa_id, status);
    }

    await registrarLicenciamentoLog({
        empresaId: pdv.empresa_id,
        filialId: pdv.filial_id,
        pdvId: pdv.id,
        codigoPdv: pdv.codigo_pdv,
        evento: 'status_pdv',
        status,
        machineId: pdv.machine_id,
        versaoApp: pdv.versao_app
    });

    return montarStatusDispositivo({ pdv: { ...pdv, licenciamento_status: status }, empresa, licenca });
}

async function heartbeat(payload, deviceToken) {
    const pdv = payload.pdv_id
        ? await buscarPdvPorIdSemEmpresa(Number(payload.pdv_id))
        : await buscarPdvPorCodigo(payload.codigo_pdv);
    validarPdvComToken(pdv, deviceToken);

    const empresa = await buscarEmpresaPorId(pdv.empresa_id);
    const licenca = await buscarLicencaDaEmpresa(pdv.empresa_id);
    const statusLicenca = calcularStatusLicenca(empresa, licenca);
    const licenciamentoStatus = pdv.ativo ? statusLicenca : 'bloqueado';

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
            limpar(payload.versao_app),
            limpar(payload.usuario_logado),
            licenciamentoStatus,
            pdv.id,
            pdv.empresa_id
        ]
    );

    const atualizado = await buscarPdvPorId(pdv.empresa_id, pdv.id);
    await registrarLicenciamentoLog({
        empresaId: atualizado.empresa_id,
        filialId: atualizado.filial_id,
        pdvId: atualizado.id,
        codigoPdv: atualizado.codigo_pdv,
        evento: 'heartbeat',
        status: licenciamentoStatus,
        machineId: atualizado.machine_id,
        versaoApp: payload.versao_app || atualizado.versao_app,
        mensagem: payload.usuario_logado ? `Usuario: ${payload.usuario_logado}` : null
    });

    return montarStatusDispositivo({ pdv: atualizado, empresa, licenca });
}

async function autenticarDispositivo(deviceToken) {
    if (!deviceToken) {
        const error = new Error('Token de dispositivo nao informado.');
        error.status = 401;
        throw error;
    }

    const pdv = await buscarUm(
        `SELECT p.*, f.nome AS filial_nome
         FROM pdvs p
         JOIN filiais f ON f.id = p.filial_id AND f.empresa_id = p.empresa_id
         WHERE p.device_token_hash = ?
         ORDER BY p.id DESC
         LIMIT 1`,
        [hashToken(deviceToken)]
    );
    validarPdvComToken(pdv, deviceToken);

    const empresa = await buscarEmpresaPorId(pdv.empresa_id);
    const licenca = await buscarLicencaDaEmpresa(pdv.empresa_id);
    const statusLicenca = calcularStatusLicenca(empresa, licenca);
    const status = pdv.ativo ? statusLicenca : 'bloqueado';

    if (status !== 'ativo') {
        await atualizarLicenciamentoStatus(pdv.id, pdv.empresa_id, status);
        const error = new Error('PDV sem licenca ativa para sincronizacao.');
        error.status = 403;
        error.licenciamento_status = status;
        throw error;
    }

    return {
        id: `pdv:${pdv.id}`,
        usuario_id: null,
        empresa_id: pdv.empresa_id,
        filial_id: pdv.filial_id,
        pdv_id: pdv.id,
        codigo_pdv: pdv.codigo_pdv,
        nome: pdv.nome,
        tipo: 'device'
    };
}

async function validarPdvSincronizacao({ empresaId, pdvId, filialId = null }) {
    const identificador = limpar(pdvId);
    if (!identificador) {
        const error = new Error('pdv_id e obrigatorio para sincronizacao.');
        error.status = 400;
        throw error;
    }

    const pdv = await buscarUm(
        `SELECT p.id, p.empresa_id, p.filial_id, p.nome, p.codigo_pdv, p.status,
                p.ativo, p.licenciamento_status
         FROM pdvs p
         WHERE p.empresa_id = ?
           AND (CAST(p.id AS TEXT) = ? OR p.codigo_pdv = ?)
         LIMIT 1`,
        [empresaId, identificador, identificador]
    );

    if (!pdv || !pdv.ativo) {
        const error = new Error('PDV nao registrado ou inativo para esta empresa.');
        error.status = 404;
        throw error;
    }

    if (filialId && Number(filialId) !== Number(pdv.filial_id)) {
        const error = new Error('PDV nao pertence a filial informada.');
        error.status = 403;
        throw error;
    }

    if (pdv.licenciamento_status && pdv.licenciamento_status !== 'ativo') {
        const error = new Error('PDV sem licenca ativa para sincronizacao.');
        error.status = 403;
        throw error;
    }

    return pdv;
}

async function registrarTentativaSync({ empresaId, pdvId, eventosPendentes = null }) {
    const params = [normalizarContador(eventosPendentes), pdvId, empresaId];
    await executarComando(
        `UPDATE pdvs
         SET ultima_tentativa_sync = CURRENT_TIMESTAMP,
             eventos_pendentes = COALESCE(?, eventos_pendentes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        params
    );
}

async function registrarSucessoSync({ empresaId, pdvId, eventosEnviados = 0, eventosPendentes = 0 }) {
    await executarComando(
        `UPDATE pdvs
         SET ultimo_sync_sucesso = CURRENT_TIMESTAMP,
             ultimo_sync = CURRENT_TIMESTAMP,
             status = 'online',
             ultimo_erro_sync = NULL,
             eventos_enviados = eventos_enviados + ?,
             eventos_pendentes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [normalizarContador(eventosEnviados) || 0, normalizarContador(eventosPendentes) || 0, pdvId, empresaId]
    );
}

async function registrarErroSync({ empresaId, pdvId, erro, eventosPendentes = null }) {
    await executarComando(
        `UPDATE pdvs
         SET ultima_tentativa_sync = CURRENT_TIMESTAMP,
             ultimo_erro_sync = ?,
             eventos_pendentes = COALESCE(?, eventos_pendentes),
             status = 'erro',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [limpar(erro), normalizarContador(eventosPendentes), pdvId, empresaId]
    );
}

async function listarAuditoriaSync(empresaId) {
    const pdvsRows = await executarQuery(
        `SELECT p.id, p.empresa_id, p.filial_id, f.nome AS filial_nome,
                p.nome, p.codigo_pdv, p.status, p.ultimo_sync, p.versao_app,
                p.ultima_tentativa_sync, p.ultimo_sync_sucesso, p.ultimo_erro_sync,
                p.eventos_pendentes, p.eventos_enviados, p.licenciamento_status,
                p.ativo
         FROM pdvs p
         JOIN filiais f ON f.id = p.filial_id AND f.empresa_id = p.empresa_id
         WHERE p.empresa_id = ?
         ORDER BY COALESCE(p.ultima_tentativa_sync, p.updated_at) DESC, p.id DESC`,
        [empresaId]
    );

    const logs = await executarQuery(
        `SELECT recurso, status, total_registros, erro, created_at
         FROM sync_logs
         WHERE empresa_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 50`,
        [empresaId]
    );

    return { pdvs: pdvsRows, logs };
}

function validarCamposObrigatorios(campos) {
    if (!limpar(campos.nome)) {
        const error = new Error('Nome do PDV e obrigatorio.');
        error.status = 400;
        throw error;
    }
    if (!limpar(campos.codigo_pdv)) {
        const error = new Error('Codigo do PDV e obrigatorio.');
        error.status = 400;
        throw error;
    }
    if (!campos.filial_id) {
        const error = new Error('Filial do PDV e obrigatoria.');
        error.status = 400;
        throw error;
    }
}

async function validarFilial(empresaId, filialId) {
    const filial = await filiais.buscarFilialPorId(empresaId, Number(filialId));
    if (!filial || !filial.ativo) {
        const error = new Error('Filial nao encontrada para esta empresa.');
        error.status = 404;
        throw error;
    }
}

async function validarCodigoDuplicado(empresaId, codigoPdv, ignorarId = null) {
    const existente = await buscarUm(
        'SELECT id FROM pdvs WHERE empresa_id = ? AND codigo_pdv = ? AND (? IS NULL OR id <> ?)',
        [empresaId, limpar(codigoPdv), ignorarId, ignorarId]
    );
    if (existente) {
        const error = new Error('Ja existe um PDV com este codigo nesta empresa.');
        error.status = 409;
        throw error;
    }
}

function normalizarCampos(campos) {
    return {
        filial_id: campos.filial_id,
        nome: limpar(campos.nome),
        codigo_pdv: limpar(campos.codigo_pdv),
        status: normalizarStatus(campos.status),
        ultimo_sync: limpar(campos.ultimo_sync),
        versao_app: limpar(campos.versao_app),
        ativo: campos.ativo === undefined ? true : Number(Boolean(campos.ativo))
    };
}

function normalizarStatus(status) {
    const value = limpar(status) || 'offline';
    return STATUS.has(value) ? value : 'offline';
}

async function buscarEmpresaPorDocumento(cnpj, codigo) {
    const documento = normalizarDocumento(cnpj);
    const codigoLimpo = limpar(codigo);
    if (!documento) {
        return null;
    }

    const empresa = await buscarUm(
        `SELECT *
         FROM empresas
         WHERE REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(documento, ''), '.', ''), '/', ''), '-', ''), ' ', '') = ?
         ORDER BY id ASC
         LIMIT 1`,
        [documento]
    );

    if (!empresa) {
        return null;
    }

    if (!codigoLimpo) {
        return empresa;
    }

    const licenca = await buscarUm(
        `SELECT id
         FROM licencas
         WHERE empresa_id = ? AND CAST(id AS TEXT) = ?
         LIMIT 1`,
        [empresa.id, codigoLimpo]
    );

    if (String(empresa.id) === codigoLimpo || licenca) {
        return empresa;
    }

    return null;
}

async function buscarEmpresaPorId(id) {
    return buscarUm('SELECT * FROM empresas WHERE id = ?', [id]);
}

async function buscarLicencaDaEmpresa(empresaId) {
    return buscarUm(
        `SELECT * FROM licencas
         WHERE empresa_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [empresaId]
    );
}

async function validarFilialParaAtivacao(empresaId, filialId) {
    const filial = await filiais.buscarFilialPorId(empresaId, Number(filialId));
    if (!filial || !filial.ativo) {
        const error = new Error('Filial nao encontrada para esta empresa.');
        error.status = 404;
        throw error;
    }
    return filial;
}

function calcularStatusLicenca(empresa, licenca) {
    if (!empresa || empresa.status !== 'ativa') return 'bloqueado';
    if (!licenca || licenca.status === 'aguardando_ativacao') return 'aguardando_ativacao';
    if (licenca.expira_em && new Date(licenca.expira_em) < new Date()) return 'expirado';
    if (licenca.status !== 'ativa') return licenca.status === 'expirada' ? 'expirado' : 'bloqueado';
    if (!licenca.plano) return 'bloqueado';
    return 'ativo';
}

function respostaLicenca({ empresa, licenca, status }) {
    return {
        autorizado: status === 'ativo',
        status,
        empresa: empresaSeguro(empresa),
        licenca: licencaSeguro(licenca),
        alerta_offline_dias: 7
    };
}

function montarStatusDispositivo({ pdv, empresa, licenca }) {
    const status = pdv.licenciamento_status || calcularStatusLicenca(empresa, licenca);
    return {
        autorizado: status === 'ativo',
        status,
        alerta_offline_dias: 7,
        ultima_validacao: new Date().toISOString(),
        pdv: pdvSeguro(pdv),
        empresa: empresaSeguro(empresa),
        licenca: licencaSeguro(licenca)
    };
}

function pdvSeguro(pdv) {
    return {
        id: pdv.id,
        empresa_id: pdv.empresa_id,
        filial_id: pdv.filial_id,
        filial_nome: pdv.filial_nome || null,
        nome: pdv.nome,
        codigo_pdv: pdv.codigo_pdv,
        status: pdv.status,
        ultimo_sync: pdv.ultimo_sync,
        versao_app: pdv.versao_app,
        machine_id: pdv.machine_id || null,
        dispositivo_nome: pdv.dispositivo_nome || null,
        licenciamento_status: pdv.licenciamento_status || 'aguardando_ativacao',
        registrado_at: pdv.registrado_at || null,
        ultimo_acesso: pdv.ultimo_acesso || null,
        ultimo_usuario: pdv.ultimo_usuario || null,
        ultima_tentativa_sync: pdv.ultima_tentativa_sync || null,
        ultimo_sync_sucesso: pdv.ultimo_sync_sucesso || null,
        ultimo_erro_sync: pdv.ultimo_erro_sync || null,
        eventos_pendentes: pdv.eventos_pendentes || 0,
        eventos_enviados: pdv.eventos_enviados || 0,
        ativo: pdv.ativo
    };
}

function empresaSeguro(empresa) {
    return {
        id: empresa.id,
        nome: empresa.nome_fantasia,
        documento: empresa.documento,
        status: empresa.status
    };
}

function licencaSeguro(licenca) {
    return {
        id: licenca?.id || null,
        plano: licenca?.plano || null,
        status: licenca?.status || 'bloqueada',
        expira_em: licenca?.expira_em || null,
        limite_usuarios: licenca?.limite_usuarios || 0,
        limite_produtos: licenca?.limite_produtos || 0,
        limite_vendas_mes: licenca?.limite_vendas_mes || 0
    };
}

async function buscarPdvPorCodigo(codigoPdv) {
    return buscarUm(
        `SELECT p.*, f.nome AS filial_nome
         FROM pdvs p
         JOIN filiais f ON f.id = p.filial_id AND f.empresa_id = p.empresa_id
         WHERE p.codigo_pdv = ?
         ORDER BY p.id DESC
         LIMIT 1`,
        [limpar(codigoPdv)]
    );
}

async function buscarPdvPorCodigoComToken(codigoPdv, deviceToken) {
    const tokenHash = deviceToken ? hashToken(deviceToken) : null;
    if (!tokenHash) {
        return buscarPdvPorCodigo(codigoPdv);
    }

    return buscarUm(
        `SELECT p.*, f.nome AS filial_nome
         FROM pdvs p
         JOIN filiais f ON f.id = p.filial_id AND f.empresa_id = p.empresa_id
         WHERE p.codigo_pdv = ? AND p.device_token_hash = ?
         ORDER BY p.id DESC
         LIMIT 1`,
        [limpar(codigoPdv), tokenHash]
    );
}

async function buscarPdvPorIdSemEmpresa(id) {
    return buscarUm(
        `SELECT p.*, f.nome AS filial_nome
         FROM pdvs p
         JOIN filiais f ON f.id = p.filial_id AND f.empresa_id = p.empresa_id
         WHERE p.id = ?`,
        [id]
    );
}

function validarPdvComToken(pdv, token) {
    if (!pdv || !pdv.device_token_hash) {
        const error = new Error('PDV nao registrado.');
        error.status = 404;
        throw error;
    }
    if (!token || hashToken(token) !== pdv.device_token_hash) {
        const error = new Error('Token de dispositivo invalido.');
        error.status = 401;
        throw error;
    }
}

async function atualizarLicenciamentoStatus(id, empresaId, status) {
    await executarComando(
        'UPDATE pdvs SET licenciamento_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?',
        [status, id, empresaId]
    );
}

async function registrarLicenciamentoLog({ empresaId = null, filialId = null, pdvId = null, codigoPdv = null, evento, status, machineId = null, versaoApp = null, mensagem = null }) {
    await executarComando(
        `INSERT INTO pdv_licenciamento_logs (
            empresa_id, filial_id, pdv_id, codigo_pdv, evento, status,
            machine_id, versao_app, mensagem
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, filialId, pdvId, codigoPdv, evento, status, limpar(machineId), limpar(versaoApp), mensagem]
    );
}

function gerarDeviceToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function gerarCodigoPdv(nome, machineId) {
    const base = limpar(nome || 'PDV').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase() || 'PDV';
    const suffix = crypto.createHash('sha1').update(String(machineId || Date.now())).digest('hex').slice(0, 6).toUpperCase();
    return `${base}-${suffix}`;
}

function normalizarDocumento(value) {
    return String(value || '').replace(/\D/g, '');
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

function normalizarContador(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

module.exports = {
    listarPdvs,
    criarPdv,
    atualizarPdv,
    desativarPdv,
    buscarPdvPorId,
    verificarLicenca,
    registrarPdv,
    statusPdv,
    heartbeat,
    autenticarDispositivo,
    validarPdvSincronizacao,
    registrarTentativaSync,
    registrarSucessoSync,
    registrarErroSync,
    listarAuditoriaSync,
    indicadores
};
