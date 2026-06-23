class SyncLogger {
    constructor({ logger = console } = {}) {
        this.logger = logger;
        this.logs = [];
    }

    info(evento, payload = {}) {
        return this.registrar('info', evento, payload);
    }

    error(evento, payload = {}) {
        return this.registrar('erro', evento, payload);
    }

    registrar(nivel, evento, payload = {}) {
        const log = {
            nivel,
            evento,
            payload,
            created_at: new Date().toISOString()
        };
        this.logs.push(log);

        const method = nivel === 'erro' ? 'error' : 'log';
        this.logger[method]('[pdv-sync]', evento, payload);
        return log;
    }

    listar() {
        return [...this.logs];
    }
}

module.exports = SyncLogger;
