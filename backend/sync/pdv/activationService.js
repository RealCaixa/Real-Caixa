class ActivationService {
    constructor({ apiBaseUrl, fetchImpl = global.fetch, storage } = {}) {
        if (!apiBaseUrl) {
            throw new Error('apiBaseUrl e obrigatorio para ativacao.');
        }
        if (!fetchImpl) {
            throw new Error('fetch nao esta disponivel neste ambiente.');
        }
        if (!storage) {
            throw new Error('storage local e obrigatorio para ativacao.');
        }

        this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
        this.fetch = fetchImpl;
        this.storage = storage;
    }

    async verificarAtivacaoLocal() {
        return this.storage.obterAtivacao();
    }

    async iniciarAplicacao({ versaoApp, usuarioLogado } = {}) {
        const ativacaoLocal = await this.storage.obterAtivacao();
        if (!ativacaoLocal?.device_token || !ativacaoLocal?.pdv_id) {
            return {
                ativado: false,
                requer_ativacao: true,
                online: false,
                mensagem: 'PDV ainda nao ativado.'
            };
        }

        try {
            const validada = await this.validarOnline();
            await this.heartbeat({ versaoApp, status: 'online', usuarioLogado }).catch(() => null);
            return {
                ativado: true,
                requer_ativacao: false,
                online: true,
                autorizado: validada.status_licenca === 'ativo',
                status_licenca: validada.status_licenca,
                ativacao: validada
            };
        } catch (error) {
            return {
                ativado: true,
                requer_ativacao: false,
                online: false,
                autorizado: true,
                status_licenca: ativacaoLocal.status_licenca,
                alerta_validacao: await this.deveAlertarValidacao(),
                mensagem: 'Portal indisponivel. Funcionamento offline liberado para PDV ja ativado.',
                erro_validacao: error.message,
                ativacao: ativacaoLocal
            };
        }
    }

    async ativar({ cnpj, codigoLicenca, nomePdv, filialId, codigoPdv, machineId, dispositivoNome, versaoApp }) {
        const response = await this.fetch(`${this.apiBaseUrl}/api/pdvs/registrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                cnpj,
                codigo_licenca: codigoLicenca,
                nome_pdv: nomePdv,
                filial_id: filialId,
                codigo_pdv: codigoPdv,
                machine_id: machineId,
                dispositivo_nome: dispositivoNome,
                versao_app: versaoApp
            })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body.erro || 'Nao foi possivel ativar este PDV.');
        }

        const ativacao = {
            empresa_id: body.empresa.id,
            filial_id: body.filial.id,
            pdv_id: body.pdv.id,
            codigo_pdv: body.pdv.codigo_pdv,
            device_token: body.device_token,
            cnpj: body.empresa.documento,
            plano: body.licenca.plano,
            status_licenca: body.status || body.pdv.licenciamento_status,
            alerta_offline_dias: body.alerta_offline_dias,
            ultima_validacao: new Date().toISOString()
        };
        await this.storage.salvarAtivacao(ativacao);
        return ativacao;
    }

    async validarOnline() {
        const ativacao = await this.storage.obterAtivacao();
        if (!ativacao?.device_token || !ativacao?.codigo_pdv) {
            return null;
        }

        const response = await this.fetch(`${this.apiBaseUrl}/api/pdvs/status/${ativacao.codigo_pdv}`, {
            headers: {
                Authorization: `Device ${ativacao.device_token}`,
                Accept: 'application/json'
            }
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body.erro || 'Nao foi possivel validar a licenca.');
        }

        const atualizado = {
            ...ativacao,
            plano: body.licenca.plano,
            status_licenca: body.status,
            ultima_validacao: body.ultima_validacao,
            alerta_offline_dias: body.alerta_offline_dias
        };
        await this.storage.salvarAtivacao(atualizado);
        return atualizado;
    }

    async heartbeat({ versaoApp, status = 'online', usuarioLogado } = {}) {
        const ativacao = await this.storage.obterAtivacao();
        if (!ativacao?.device_token || !ativacao?.pdv_id) {
            throw new Error('PDV ainda nao ativado.');
        }

        const response = await this.fetch(`${this.apiBaseUrl}/api/pdvs/heartbeat`, {
            method: 'POST',
            headers: {
                Authorization: `Device ${ativacao.device_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                pdv_id: ativacao.pdv_id,
                versao_app: versaoApp,
                data_hora: new Date().toISOString(),
                status,
                usuario_logado: usuarioLogado
            })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body.erro || 'Nao foi possivel enviar heartbeat.');
        }
        return body;
    }

    async deveAlertarValidacao() {
        const ativacao = await this.storage.obterAtivacao();
        if (!ativacao?.ultima_validacao) return false;
        const limiteDias = Number(ativacao.alerta_offline_dias || 7);
        const diffMs = Date.now() - new Date(ativacao.ultima_validacao).getTime();
        return diffMs > limiteDias * 24 * 60 * 60 * 1000;
    }

    async resetarAtivacaoLocal() {
        return this.storage.removerAtivacao();
    }
}

module.exports = ActivationService;
