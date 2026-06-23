const SyncService = require('./syncService');
const SyncLogger = require('./syncLogger');

class SyncController {
    constructor({ activationService, syncServiceFactory, logger } = {}) {
        if (!activationService) {
            throw new Error('activationService e obrigatorio para o controller de sync.');
        }

        this.activationService = activationService;
        this.syncServiceFactory = syncServiceFactory || ((ativacao) => new SyncService({
            apiBaseUrl: activationService.apiBaseUrl,
            deviceToken: ativacao.device_token
        }));
        this.logger = logger || new SyncLogger();
    }

    async iniciarPdv({ versaoApp, usuarioLogado } = {}) {
        const status = await this.activationService.iniciarAplicacao({ versaoApp, usuarioLogado });
        if (status.requer_ativacao) {
            this.logger.info('ativacao_requerida');
            return status;
        }

        if (!status.online) {
            this.logger.info('operacao_offline_liberada', {
                alerta_validacao: status.alerta_validacao,
                mensagem: status.mensagem
            });
            return {
                ...status,
                sincronizacao: {
                    executada: false,
                    offline: true
                }
            };
        }

        try {
            const syncService = this.syncServiceFactory(status.ativacao);
            const sincronizacao = await syncService.sincronizarPortalParaPdv();
            return {
                ...status,
                sincronizacao: {
                    executada: true,
                    offline: false,
                    ...sincronizacao
                }
            };
        } catch (error) {
            this.logger.error('sincronizacao_falhou', { mensagem: error.message });
            return {
                ...status,
                sincronizacao: {
                    executada: false,
                    offline: false,
                    erro: error.message
                }
            };
        }
    }
}

module.exports = SyncController;
