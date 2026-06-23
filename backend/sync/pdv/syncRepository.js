class SyncRepository {
    constructor({ db } = {}) {
        this.db = db;
        this.memoria = {
            produtos: [],
            categorias: [],
            usuarios: [],
            permissoes: [],
            configuracoes: [],
            filiais: [],
            licenca: [],
            lastSyncAt: null
        };
    }

    obterLastSyncAt() {
        return this.memoria.lastSyncAt;
    }

    salvarLastSyncAt(lastSyncAt) {
        this.memoria.lastSyncAt = lastSyncAt;
        return this.memoria.lastSyncAt;
    }

    salvarProdutos(produtos) {
        return this.salvarColecao('produtos', produtos);
    }

    salvarCategorias(categorias) {
        return this.salvarColecao('categorias', categorias);
    }

    salvarUsuarios(usuarios) {
        return this.salvarColecao('usuarios', usuarios);
    }

    salvarPermissoes(permissoes) {
        return this.salvarColecao('permissoes', permissoes);
    }

    salvarConfiguracoes(configuracoes) {
        return this.salvarColecao('configuracoes', configuracoes);
    }

    salvarFiliais(filiais) {
        return this.salvarColecao('filiais', filiais);
    }

    salvarLicenca(licenca) {
        return this.salvarColecao('licenca', licenca);
    }

    salvarColecao(nome, registros) {
        if (this.db) {
            throw new Error('Persistencia SQLite do PDV deve ser conectada no REALCAIXA-PRO.');
        }

        const porId = new Map(this.memoria[nome].map((item) => [item.id, item]));
        registros.forEach((registro) => {
            const chave = registro.id || JSON.stringify(registro);
            porId.set(chave, registro);
        });
        this.memoria[nome] = Array.from(porId.values());
        return registros.length;
    }
}

module.exports = SyncRepository;
