const SyncQueue = require('./syncQueue');
const SyncRepository = require('./syncRepository');
const SyncLogger = require('./syncLogger');

const RECURSOS = ['produtos', 'categorias', 'usuarios', 'permissoes', 'configuracoes', 'filiais', 'licenca'];

class SyncService {
    constructor({ apiBaseUrl, token, deviceToken, repository, queue, logger, fetchImpl = global.fetch } = {}) {
        if (!apiBaseUrl) {
            throw new Error('apiBaseUrl e obrigatorio para sincronizacao.');
        }
        if (!token && !deviceToken) {
            throw new Error('token JWT ou device_token e obrigatorio para sincronizacao.');
        }
        if (!fetchImpl) {
            throw new Error('fetch nao esta disponivel neste ambiente.');
        }

        this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
        this.token = token;
        this.deviceToken = deviceToken;
        this.fetch = fetchImpl;
        this.repository = repository || new SyncRepository();
        this.queue = queue || new SyncQueue();
        this.logger = logger || new SyncLogger();
    }

    async sincronizarPortalParaPdv({ lastSyncAt } = {}) {
        const inicio = lastSyncAt || this.repository.obterLastSyncAt();
        this.queue.registrar('sincronizacao_iniciada', { direcao: 'portal_para_pdv', last_sync_at: inicio });
        this.logger.info('sincronizacao_iniciada', { direcao: 'portal_para_pdv', last_sync_at: inicio });

        try {
            const resultado = {};
            for (const recurso of RECURSOS) {
                const resposta = await this.buscarRecursoCompleto(recurso, inicio);
                resultado[recurso] = resposta;
                this.persistir(recurso, resposta.dados);
            }

            const serverSyncAt = calcularServerSyncAt(resultado);
            this.repository.salvarLastSyncAt(serverSyncAt);
            const totais = Object.fromEntries(RECURSOS.map((recurso) => [recurso, resultado[recurso].total]));
            this.queue.registrar('sincronizacao_concluida', {
                direcao: 'portal_para_pdv',
                server_sync_at: serverSyncAt,
                totais
            });
            this.logger.info('sincronizacao_concluida', { direcao: 'portal_para_pdv', server_sync_at: serverSyncAt, totais });

            return {
                server_sync_at: serverSyncAt,
                resultado
            };
        } catch (error) {
            this.queue.registrar('erro', { direcao: 'portal_para_pdv', mensagem: error.message });
            this.logger.error('sincronizacao_erro', { direcao: 'portal_para_pdv', mensagem: error.message });
            throw error;
        }
    }

    enfileirarVenda(venda) {
        return this.registrarVendaFinalizada(venda);
    }

    enfileirarCaixa(payload) {
        return this.queue.adicionarEvento(payload.tipo || 'caixa_movimentacao', payload);
    }

    enfileirarEstoqueMovimentacao(movimentacao) {
        return this.registrarEstoqueMovimentado(movimentacao);
    }

    registrarVendaFinalizada(venda) {
        return this.queue.adicionarEvento('venda_finalizada', venda);
    }

    registrarCaixaAberto(movimento) {
        return this.queue.adicionarEvento('caixa_aberto', { ...movimento, tipo: 'abertura' });
    }

    registrarSangria(movimento) {
        return this.queue.adicionarEvento('sangria', { ...movimento, tipo: 'sangria' });
    }

    registrarSuprimento(movimento) {
        return this.queue.adicionarEvento('suprimento', { ...movimento, tipo: 'suprimento' });
    }

    registrarCaixaFechado(fechamento) {
        return this.queue.adicionarEvento('caixa_fechado', fechamento);
    }

    registrarEstoqueMovimentado(movimentacao) {
        return this.queue.adicionarEvento('estoque_movimentado', movimentacao);
    }

    async sincronizarPdvParaPortal({ pdvId } = {}) {
        if (!pdvId) {
            throw new Error('pdvId e obrigatorio para enviar eventos ao Portal.');
        }

        const pendentes = this.queue.pendentes();
        this.queue.registrar('sincronizacao_iniciada', {
            direcao: 'pdv_para_portal',
            pendentes: pendentes.length
        });

        const resultados = [];
        for (const item of pendentes) {
            try {
                const resposta = await this.enviarEventoPdv(item, pdvId);
                this.queue.marcarEnviado(item.id);
                resultados.push({ id: item.id, tipo: item.tipo, status: 'enviado', resposta });
            } catch (error) {
                this.queue.marcarErro(item.id, error);
                resultados.push({ id: item.id, tipo: item.tipo, status: 'erro', erro: error.message });
            }
        }

        this.queue.registrar('sincronizacao_concluida', {
            direcao: 'pdv_para_portal',
            enviados: resultados.filter((item) => item.status === 'enviado').length,
            erros: resultados.filter((item) => item.status === 'erro').length
        });

        return resultados;
    }

    async enviarEventoPdv(item, pdvId) {
        const endpointPorTipo = {
            venda_finalizada: '/api/sync/vendas',
            vendas: '/api/sync/vendas',
            caixa_aberto: '/api/sync/caixa',
            sangria: '/api/sync/caixa',
            suprimento: '/api/sync/caixa',
            caixa_fechado: '/api/sync/caixa',
            caixa: '/api/sync/caixa',
            caixa_movimentacao: '/api/sync/caixa',
            estoque_movimentado: '/api/sync/estoque-movimentacoes',
            'estoque-movimentacoes': '/api/sync/estoque-movimentacoes'
        };
        const endpoint = endpointPorTipo[item.tipo];
        if (!endpoint) {
            throw new Error(`Tipo de evento sem endpoint de sync: ${item.tipo}`);
        }

        const body = montarPayloadPdv(item, pdvId);
        const response = await this.fetch(`${this.apiBaseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                Authorization: this.authHeader(),
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.erro || `Falha ao enviar ${item.tipo}.`);
        }
        return payload;
    }

    async buscarRecurso(recurso, lastSyncAt) {
        const url = new URL(`${this.apiBaseUrl}/api/sync/${recurso}`);
        if (lastSyncAt) {
            url.searchParams.set('last_sync_at', lastSyncAt);
        }
        return this.buscarUrl(url, recurso);
    }

    async buscarRecursoCompleto(recurso, lastSyncAt) {
        let cursor = null;
        let serverSyncAt = null;
        const dados = [];

        do {
            const url = new URL(`${this.apiBaseUrl}/api/sync/${recurso}`);
            if (lastSyncAt) {
                url.searchParams.set('last_sync_at', lastSyncAt);
            }
            if (cursor) {
                url.searchParams.set('cursor', cursor);
            }

            const page = await this.buscarUrl(url, recurso);
            dados.push(...(page.dados || []));
            serverSyncAt = page.server_sync_at || serverSyncAt;
            cursor = page.next_cursor || null;
        } while (cursor);

        return {
            recurso,
            direcao: 'portal_para_pdv',
            last_sync_at: lastSyncAt || null,
            server_sync_at: serverSyncAt || new Date().toISOString(),
            total: dados.length,
            dados
        };
    }

    async buscarUrl(url, recurso) {
        const response = await this.fetch(url, {
            headers: {
                Authorization: this.authHeader(),
                Accept: 'application/json'
            }
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body.erro || `Falha ao sincronizar ${recurso}.`);
        }

        return body;
    }

    persistir(recurso, dados) {
        const handlers = {
            produtos: 'salvarProdutos',
            categorias: 'salvarCategorias',
            usuarios: 'salvarUsuarios',
            permissoes: 'salvarPermissoes',
            configuracoes: 'salvarConfiguracoes',
            filiais: 'salvarFiliais',
            licenca: 'salvarLicenca'
        };
        return this.repository[handlers[recurso]](dados);
    }

    authHeader() {
        return this.deviceToken ? `Device ${this.deviceToken}` : `Bearer ${this.token}`;
    }
}

function montarPayloadPdv(item, pdvId) {
    if (item.tipo === 'venda_finalizada' || item.tipo === 'vendas') {
        return { pdv_id: pdvId, vendas: [item.payload] };
    }
    if (['caixa_aberto', 'sangria', 'suprimento', 'caixa_movimentacao'].includes(item.tipo)) {
        return { pdv_id: pdvId, movimentacoes: [item.payload] };
    }
    if (item.tipo === 'caixa_fechado') {
        return { pdv_id: pdvId, fechamentos: [item.payload] };
    }
    if (item.tipo === 'caixa') {
        return {
            pdv_id: pdvId,
            movimentacoes: item.payload.movimentacoes || [],
            fechamentos: item.payload.fechamentos || []
        };
    }
    if (item.tipo === 'estoque_movimentado' || item.tipo === 'estoque-movimentacoes') {
        return { pdv_id: pdvId, movimentacoes: [item.payload] };
    }
    return { pdv_id: pdvId, ...item.payload };
}

function calcularServerSyncAt(resultado) {
    return RECURSOS
        .map((recurso) => resultado[recurso]?.server_sync_at)
        .filter(Boolean)
        .sort()
        .at(-1) || new Date().toISOString();
}

module.exports = SyncService;
