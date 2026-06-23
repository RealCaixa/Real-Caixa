class SyncQueue {
    constructor({ logger = console } = {}) {
        this.logger = logger;
        this.items = [];
    }

    adicionarEvento(tipo, payload = {}) {
        const id = payload.uuid || `${Date.now()}-${this.items.length + 1}`;
        const existente = this.items.find((item) => item.id === id && item.tipo === tipo);
        if (existente) {
            return existente;
        }

        const item = {
            id,
            tipo,
            payload,
            status: 'pendente',
            tentativas: 0,
            erro: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.items.push(item);
        return item;
    }

    pendentes() {
        return this.items.filter((item) => item.status === 'pendente' || item.status === 'erro');
    }

    marcarEnviado(id) {
        return this.atualizar(id, { status: 'enviado', erro: null });
    }

    marcarErro(id, erro) {
        const atual = this.items.find((item) => item.id === id);
        return this.atualizar(id, {
            status: 'erro',
            erro: erro.message || String(erro),
            tentativas: (atual?.tentativas || 0) + 1
        });
    }

    registrar(tipo, payload = {}) {
        const item = {
            id: `${Date.now()}-${this.items.length + 1}`,
            tipo,
            payload,
            created_at: new Date().toISOString()
        };
        this.items.push(item);

        if (tipo === 'erro') {
            this.logger.error('[pdv-sync]', payload);
        } else {
            this.logger.log('[pdv-sync]', tipo, payload);
        }

        return item;
    }

    listar() {
        return [...this.items];
    }

    limpar() {
        this.items = [];
    }

    atualizar(id, patch) {
        const item = this.items.find((entry) => entry.id === id);
        if (!item) return null;
        Object.assign(item, patch, { updated_at: new Date().toISOString() });
        return item;
    }
}

module.exports = SyncQueue;
