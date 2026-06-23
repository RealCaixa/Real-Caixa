const { executarComando, executarQuery, buscarUm, transacao } = require('../database');

async function listarProdutosAlterados(empresaId, lastSyncAt, paginacao = paginacaoPadrao()) {
    const { where, params } = montarFiltroEmpresaAtualizacao(empresaId, lastSyncAt, 'p');

    const rows = await executarQuery(
        `SELECT p.id, p.empresa_id, p.categoria_id, c.nome AS categoria_nome,
                p.codigo_interno, p.codigo_barras, p.descricao, p.custo,
                p.preco_venda, p.estoque_atual, p.estoque_minimo, p.unidade,
                p.ativo, p.created_at, p.updated_at
         FROM produtos p
         LEFT JOIN categorias c ON c.id = p.categoria_id AND c.empresa_id = p.empresa_id
         WHERE ${where}
         ORDER BY p.updated_at ASC, p.id ASC
         LIMIT ? OFFSET ?`,
        [...params, paginacao.limit + 1, paginacao.cursor]
    );
    return pagina(rows, paginacao);
}

async function listarCategoriasAlteradas(empresaId, lastSyncAt, paginacao = paginacaoPadrao()) {
    const { where, params } = montarFiltroEmpresaAtualizacao(empresaId, lastSyncAt);

    const rows = await executarQuery(
        `SELECT id, empresa_id, nome, ativo, created_at, updated_at
         FROM categorias
         WHERE ${where}
         ORDER BY updated_at ASC, id ASC
         LIMIT ? OFFSET ?`,
        [...params, paginacao.limit + 1, paginacao.cursor]
    );
    return pagina(rows, paginacao);
}

async function listarUsuariosAlterados(empresaId, lastSyncAt, paginacao = paginacaoPadrao()) {
    const { where, params } = montarFiltroEmpresaAtualizacao(empresaId, lastSyncAt);

    const rows = (await executarQuery(
        `SELECT id, empresa_id, nome, email, perfil, permissoes, status, created_at, updated_at
         FROM usuarios
         WHERE ${where}
         ORDER BY updated_at ASC, id ASC
         LIMIT ? OFFSET ?`,
        [...params, paginacao.limit + 1, paginacao.cursor]
    )).map((usuario) => ({
        ...usuario,
        permissoes: normalizarJson(usuario.permissoes, [])
    }));
    return pagina(rows, paginacao);
}

async function listarConfiguracoesAlteradas(empresaId, lastSyncAt, paginacao = paginacaoPadrao()) {
    const empresa = await buscarUm(
        `SELECT id, nome_fantasia, razao_social, documento, telefone, email, status,
                created_at, updated_at
         FROM empresas
         WHERE id = ?
           AND (? IS NULL OR datetime(updated_at) >= datetime(?))`,
        [empresaId, lastSyncAt || null, lastSyncAt || null]
    );

    const licenca = await buscarUm(
        `SELECT id, empresa_id, plano, status, limite_usuarios, limite_produtos,
                limite_vendas_mes, expira_em, created_at, updated_at
         FROM licencas
         WHERE empresa_id = ?
           AND (? IS NULL OR datetime(updated_at) >= datetime(?))`,
        [empresaId, lastSyncAt || null, lastSyncAt || null]
    );

    if (!empresa && !licenca) {
        return pagina([], paginacao);
    }

    return pagina([{
        empresa: empresa || await buscarEmpresa(empresaId),
        licenca: licenca || await buscarLicenca(empresaId)
    }], paginacao);
}

async function listarFiliaisAlteradas(empresaId, lastSyncAt, paginacao = paginacaoPadrao()) {
    const { where, params } = montarFiltroEmpresaAtualizacao(empresaId, lastSyncAt);

    const rows = await executarQuery(
        `SELECT id, empresa_id, nome, cnpj, ie, endereco, numero, bairro,
                cidade, estado, cep, telefone, ativo, created_at, updated_at
         FROM filiais
         WHERE ${where}
         ORDER BY updated_at ASC, id ASC
         LIMIT ? OFFSET ?`,
        [...params, paginacao.limit + 1, paginacao.cursor]
    );
    return pagina(rows, paginacao);
}

async function listarLicencaAlterada(empresaId, lastSyncAt, paginacao = paginacaoPadrao()) {
    const licenca = await buscarUm(
        `SELECT id, empresa_id, plano, status, limite_usuarios, limite_produtos,
                limite_vendas_mes, expira_em, created_at, updated_at
         FROM licencas
         WHERE empresa_id = ?
           AND (? IS NULL OR datetime(updated_at) >= datetime(?))
         ORDER BY updated_at ASC, id ASC
         LIMIT 1`,
        [empresaId, lastSyncAt || null, lastSyncAt || null]
    );

    return pagina(licenca ? [licenca] : [], paginacao);
}

async function listarPermissoesAlteradas(empresaId, lastSyncAt, paginacao = paginacaoPadrao()) {
    const usuarios = await listarUsuariosAlterados(empresaId, lastSyncAt, paginacao);
    return {
        ...usuarios,
        dados: usuarios.dados.map((usuario) => ({
        usuario_id: usuario.id,
        empresa_id: usuario.empresa_id,
        email: usuario.email,
        perfil: usuario.perfil,
        permissoes: usuario.permissoes,
        status: usuario.status,
        updated_at: usuario.updated_at
        }))
    };
}

async function registrarLog({ empresaId, usuarioId, recurso, status, lastSyncAt = null, total = 0, erro = null }) {
    return executarComando(
        `INSERT INTO sync_logs (
            empresa_id, usuario_id, recurso, status, last_sync_at, total_registros, erro
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, usuarioId || null, recurso, status, lastSyncAt, total, erro]
    );
}

async function receberVendas({ empresaId, usuarioId, pdvId, filialId, vendas }) {
    validarPdvId(pdvId);
    const lista = normalizarLista(vendas, 'venda');

    return transacao(async () => {
        const resultados = [];
        for (const venda of lista) {
            resultados.push(await receberVenda({ empresaId, usuarioId, pdvId, filialId, venda }));
        }
        return resumoRecebimento(resultados);
    });
}

async function receberCaixa({ empresaId, pdvId, filialId, movimentacoes = [], fechamentos = [] }) {
    validarPdvId(pdvId);
    if (!normalizarArray(movimentacoes).length && !normalizarArray(fechamentos).length) {
        const error = new Error('Informe movimentacoes ou fechamentos de caixa.');
        error.status = 400;
        throw error;
    }

    return transacao(async () => {
        const movimentos = [];
        for (const movimento of normalizarArray(movimentacoes)) {
            movimentos.push(await receberMovimentoCaixa({ empresaId, pdvId, filialId, movimento }));
        }
        const caixasFechados = [];
        for (const fechamento of normalizarArray(fechamentos)) {
            caixasFechados.push(await receberFechamentoCaixa({ empresaId, pdvId, filialId, fechamento }));
        }
        const resultados = [...movimentos, ...caixasFechados];
        return resumoRecebimento(resultados);
    });
}

async function receberEstoqueMovimentacoes({ empresaId, usuarioId, pdvId, filialId, movimentacoes }) {
    validarPdvId(pdvId);
    const lista = normalizarLista(movimentacoes, 'movimentacao');

    return transacao(async () => {
        const resultados = [];
        for (const movimento of lista) {
            resultados.push(await receberMovimentoEstoque({ empresaId, usuarioId, pdvId, filialId, movimento }));
        }
        return resumoRecebimento(resultados);
    });
}

async function receberVenda({ empresaId, usuarioId, pdvId, filialId, venda }) {
    validarUuid(venda.uuid, 'UUID da venda');

    const existente = await buscarUm(
        'SELECT id, uuid FROM sync_vendas WHERE empresa_id = ? AND uuid = ?',
        [empresaId, venda.uuid]
    );
    if (existente) {
        return { uuid: venda.uuid, status: 'duplicado', id: existente.id };
    }

    const itens = normalizarArray(venda.itens);
    const pagamentos = normalizarArray(venda.pagamentos);
    const dataVenda = dataIso(venda.data_venda || venda.data || venda.created_at);
    const subtotal = numero(venda.subtotal ?? itens.reduce((total, item) => total + numero(item.total), 0));
    const desconto = numero(venda.desconto);
    const total = numero(venda.total ?? subtotal - desconto);

    const result = await executarComando(
        `INSERT INTO sync_vendas (
            empresa_id, pdv_id, uuid, numero, data_venda, status, subtotal,
            desconto, total, operador_nome, payload, filial_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            empresaId,
            pdvId,
            venda.uuid,
            limpar(venda.numero),
            dataVenda,
            limpar(venda.status) || 'finalizada',
            subtotal,
            desconto,
            total,
            limpar(venda.operador_nome || venda.operador),
            JSON.stringify(venda),
            filialId || null
        ]
    );

    for (const item of itens) await inserirItemVenda({ empresaId, vendaId: result.lastInsertRowid, item });
    for (const pagamento of pagamentos) await inserirPagamentoVenda({ empresaId, vendaId: result.lastInsertRowid, pagamento });
    for (const item of itens) await aplicarSaidaEstoquePorVenda({ empresaId, usuarioId, pdvId, filialId, vendaUuid: venda.uuid, item });
    await criarLancamentoFinanceiroDaVenda({
        empresaId,
        usuarioId,
        pdvId,
        filialId,
        venda,
        total,
        dataVenda,
        pagamentos
    });

    return { uuid: venda.uuid, status: 'recebido', id: result.lastInsertRowid };
}

async function criarLancamentoFinanceiroDaVenda({ empresaId, usuarioId, pdvId, filialId, venda, total, dataVenda, pagamentos }) {
    const existente = await buscarUm(
        'SELECT id FROM financeiro_lancamentos WHERE empresa_id = ? AND venda_uuid = ?',
        [empresaId, venda.uuid]
    );
    if (existente) {
        return existente;
    }

    const formas = normalizarArray(pagamentos)
        .map((pagamento) => limpar(pagamento.forma || pagamento.tipo))
        .filter(Boolean)
        .join(', ') || null;

    const result = await executarComando(
        `INSERT INTO financeiro_lancamentos (
            empresa_id, tipo, descricao, categoria, valor, data, observacao,
            usuario_id, origem, filial_id, pdv_id, venda_uuid, forma_pagamento
         ) VALUES (?, 'entrada', ?, 'Vendas PDV', ?, ?, ?, ?, 'pdv_sync', ?, ?, ?, ?)`,
        [
            empresaId,
            `Venda PDV ${limpar(venda.numero) || venda.uuid}`,
            total,
            dataVenda.slice(0, 10),
            `Venda sincronizada do PDV ${pdvId}`,
            usuarioId || await buscarUsuarioPadrao(empresaId),
            filialId || null,
            String(pdvId),
            venda.uuid,
            formas
        ]
    );

    return { id: result.lastInsertRowid };
}

async function inserirItemVenda({ empresaId, vendaId, item }) {
    const produto = await localizarProduto(empresaId, item);
    const quantidade = numero(item.quantidade);
    const precoUnitario = numero(item.preco_unitario ?? item.preco);
    const desconto = numero(item.desconto);
    const total = numero(item.total ?? ((quantidade * precoUnitario) - desconto));

    if (!(quantidade > 0)) {
        const error = new Error('Quantidade do item da venda deve ser maior que zero.');
        error.status = 400;
        throw error;
    }

    await executarComando(
        `INSERT INTO sync_venda_itens (
            empresa_id, venda_id, produto_id, codigo_interno, codigo_barras,
            descricao, quantidade, preco_unitario, desconto, total
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            empresaId,
            vendaId,
            produto?.id || null,
            limpar(item.codigo_interno || produto?.codigo_interno),
            limpar(item.codigo_barras || produto?.codigo_barras),
            limpar(item.descricao || produto?.descricao || 'Produto PDV'),
            quantidade,
            precoUnitario,
            desconto,
            total
        ]
    );
}

async function inserirPagamentoVenda({ empresaId, vendaId, pagamento }) {
    const valor = numero(pagamento.valor);
    if (!(valor > 0)) {
        const error = new Error('Valor do pagamento deve ser maior que zero.');
        error.status = 400;
        throw error;
    }

    await executarComando(
        `INSERT INTO sync_venda_pagamentos (
            empresa_id, venda_id, forma, valor, nsu, autorizacao
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
            empresaId,
            vendaId,
            limpar(pagamento.forma || pagamento.tipo || 'dinheiro'),
            valor,
            limpar(pagamento.nsu),
            limpar(pagamento.autorizacao)
        ]
    );
}

async function aplicarSaidaEstoquePorVenda({ empresaId, usuarioId, pdvId, filialId, vendaUuid, item }) {
    const produto = await localizarProduto(empresaId, item);
    if (!produto) {
        return;
    }

    const quantidade = numero(item.quantidade);
    const novoSaldo = numero(produto.estoque_atual) - quantidade;

    await executarComando(
        'UPDATE produtos SET estoque_atual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?',
        [novoSaldo, produto.id, empresaId]
    );

    await executarComando(
        `INSERT INTO estoque_movimentacoes (
            empresa_id, produto_id, tipo, quantidade, custo_unitario, observacao, usuario_id, filial_id
         ) VALUES (?, ?, 'saida', ?, ?, ?, ?, ?)`,
        [
            empresaId,
            produto.id,
            quantidade,
            null,
            `Venda sincronizada do PDV ${pdvId}: ${vendaUuid}`,
            usuarioId || await buscarUsuarioPadrao(empresaId),
            filialId || null
        ]
    );
}

async function receberMovimentoCaixa({ empresaId, pdvId, filialId, movimento }) {
    validarUuid(movimento.uuid, 'UUID da movimentacao de caixa');
    const tipo = limpar(movimento.tipo);
    if (!['abertura', 'venda', 'sangria', 'suprimento', 'fechamento'].includes(tipo)) {
        const error = new Error('Tipo de movimentacao de caixa invalido.');
        error.status = 400;
        throw error;
    }

    const existente = await buscarUm(
        'SELECT id FROM sync_caixa_movimentacoes WHERE empresa_id = ? AND uuid = ?',
        [empresaId, movimento.uuid]
    );
    if (existente) {
        return { uuid: movimento.uuid, status: 'duplicado', id: existente.id };
    }

    const result = await executarComando(
        `INSERT INTO sync_caixa_movimentacoes (
            empresa_id, pdv_id, uuid, tipo, valor, forma_pagamento,
            observacao, operador_nome, data_movimento, payload, filial_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            empresaId,
            pdvId,
            movimento.uuid,
            tipo,
            numero(movimento.valor),
            limpar(movimento.forma_pagamento),
            limpar(movimento.observacao),
            limpar(movimento.operador_nome || movimento.operador),
            dataIso(movimento.data_movimento || movimento.data || movimento.created_at),
            JSON.stringify(movimento),
            filialId || null
        ]
    );

    return { uuid: movimento.uuid, status: 'recebido', id: result.lastInsertRowid };
}

async function receberFechamentoCaixa({ empresaId, pdvId, filialId, fechamento }) {
    validarUuid(fechamento.uuid, 'UUID do fechamento de caixa');
    const existente = await buscarUm(
        'SELECT id FROM sync_caixa_fechamentos WHERE empresa_id = ? AND uuid = ?',
        [empresaId, fechamento.uuid]
    );
    if (existente) {
        return { uuid: fechamento.uuid, status: 'duplicado', id: existente.id };
    }

    const result = await executarComando(
        `INSERT INTO sync_caixa_fechamentos (
            empresa_id, pdv_id, uuid, data_abertura, data_fechamento, saldo_inicial,
            total_vendas, total_sangrias, total_suprimentos, saldo_final,
            operador_nome, payload, filial_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            empresaId,
            pdvId,
            fechamento.uuid,
            fechamento.data_abertura ? dataIso(fechamento.data_abertura) : null,
            dataIso(fechamento.data_fechamento || fechamento.data || fechamento.created_at),
            numero(fechamento.saldo_inicial),
            numero(fechamento.total_vendas),
            numero(fechamento.total_sangrias),
            numero(fechamento.total_suprimentos),
            numero(fechamento.saldo_final),
            limpar(fechamento.operador_nome || fechamento.operador),
            JSON.stringify(fechamento),
            filialId || null
        ]
    );

    return { uuid: fechamento.uuid, status: 'recebido', id: result.lastInsertRowid };
}

async function receberMovimentoEstoque({ empresaId, usuarioId, pdvId, filialId, movimento }) {
    const produto = await localizarProduto(empresaId, movimento);
    if (!produto) {
        const error = new Error('Produto da movimentacao de estoque nao encontrado.');
        error.status = 404;
        throw error;
    }

    const uuid = limpar(movimento.uuid);
    if (uuid) {
        const existente = await buscarUm(
            `SELECT id FROM estoque_movimentacoes
             WHERE empresa_id = ? AND observacao LIKE ?`,
            [empresaId, `%${uuid}%`]
        );
        if (existente) {
            return { uuid, status: 'duplicado', id: existente.id };
        }
    }

    const tipo = limpar(movimento.tipo);
    if (!['entrada', 'saida', 'ajuste', 'perda', 'inventario'].includes(tipo)) {
        const error = new Error('Tipo de movimentacao de estoque invalido.');
        error.status = 400;
        throw error;
    }

    const quantidade = numero(movimento.quantidade);
    if (!(quantidade > 0) && !['ajuste', 'inventario'].includes(tipo)) {
        const error = new Error('Quantidade da movimentacao de estoque deve ser maior que zero.');
        error.status = 400;
        throw error;
    }

    const saldoAtual = numero(produto.estoque_atual);
    const novoSaldo = calcularNovoSaldoEstoque({ saldoAtual, tipo, quantidade, saldoInformado: movimento.estoque_atual });

    await executarComando(
        'UPDATE produtos SET estoque_atual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?',
        [novoSaldo, produto.id, empresaId]
    );

    const result = await executarComando(
        `INSERT INTO estoque_movimentacoes (
            empresa_id, produto_id, tipo, quantidade, custo_unitario, observacao, usuario_id, filial_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            empresaId,
            produto.id,
            tipo,
            quantidade,
            movimento.custo_unitario === undefined ? null : numero(movimento.custo_unitario),
            limpar(`${movimento.observacao || 'Movimentacao sincronizada do PDV'}${uuid ? ` (${pdvId}:${uuid})` : ''}`),
            usuarioId || await buscarUsuarioPadrao(empresaId),
            filialId || null
        ]
    );

    return { uuid: uuid || String(result.lastInsertRowid), status: 'recebido', id: result.lastInsertRowid };
}

async function localizarProduto(empresaId, item) {
    if (item.produto_id) {
        const porId = await buscarUm(
            'SELECT * FROM produtos WHERE empresa_id = ? AND id = ?',
            [empresaId, Number(item.produto_id)]
        );
        if (porId) return porId;
    }

    if (item.codigo_interno) {
        const porCodigo = await buscarUm(
            'SELECT * FROM produtos WHERE empresa_id = ? AND codigo_interno = ?',
            [empresaId, limpar(item.codigo_interno)]
        );
        if (porCodigo) return porCodigo;
    }

    if (item.codigo_barras) {
        return buscarUm(
            'SELECT * FROM produtos WHERE empresa_id = ? AND codigo_barras = ?',
            [empresaId, limpar(item.codigo_barras)]
        );
    }

    return null;
}

function calcularNovoSaldoEstoque({ saldoAtual, tipo, quantidade, saldoInformado }) {
    if (tipo === 'entrada') return saldoAtual + quantidade;
    if (['saida', 'perda'].includes(tipo)) return saldoAtual - quantidade;
    if (['ajuste', 'inventario'].includes(tipo)) return numero(saldoInformado);
    return saldoAtual;
}

function resumoRecebimento(resultados) {
    return {
        total: resultados.length,
        recebidos: resultados.filter((item) => item.status === 'recebido').length,
        duplicados: resultados.filter((item) => item.status === 'duplicado').length,
        resultados
    };
}

function normalizarLista(value, nome) {
    const lista = normalizarArray(value);
    if (!lista.length) {
        const error = new Error(`Informe ao menos uma ${nome}.`);
        error.status = 400;
        throw error;
    }
    return lista;
}

function normalizarArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return [value];
    return [];
}

function validarPdvId(pdvId) {
    if (!limpar(pdvId)) {
        const error = new Error('pdv_id e obrigatorio.');
        error.status = 400;
        throw error;
    }
}

function validarUuid(uuid, label) {
    if (!limpar(uuid)) {
        const error = new Error(`${label} e obrigatorio.`);
        error.status = 400;
        throw error;
    }
}

function dataIso(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
        const error = new Error('Data invalida na sincronizacao.');
        error.status = 400;
        throw error;
    }
    return date.toISOString();
}

function numero(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function limpar(value) {
    return String(value || '').trim();
}

function montarFiltroEmpresaAtualizacao(empresaId, lastSyncAt, alias = '') {
    const prefixo = alias ? `${alias}.` : '';
    const where = [`${prefixo}empresa_id = ?`];
    const params = [empresaId];

    if (lastSyncAt) {
        where.push(`datetime(${prefixo}updated_at) >= datetime(?)`);
        params.push(lastSyncAt);
    }

    return { where: where.join(' AND '), params };
}

function paginacaoPadrao() {
    return { limit: 100, cursor: 0 };
}

function pagina(rows, paginacao) {
    const dados = rows.slice(0, paginacao.limit);
    const hasMore = rows.length > paginacao.limit;
    return {
        dados,
        next_cursor: hasMore ? String(paginacao.cursor + paginacao.limit) : null
    };
}

async function buscarEmpresa(empresaId) {
    return buscarUm(
        `SELECT id, nome_fantasia, razao_social, documento, telefone, email, status,
                created_at, updated_at
         FROM empresas
         WHERE id = ?`,
        [empresaId]
    );
}

async function buscarLicenca(empresaId) {
    return buscarUm(
        `SELECT id, empresa_id, plano, status, limite_usuarios, limite_produtos,
                limite_vendas_mes, expira_em, created_at, updated_at
         FROM licencas
         WHERE empresa_id = ?`,
        [empresaId]
    );
}

async function buscarUsuarioPadrao(empresaId) {
    const usuario = await buscarUm(
        `SELECT id
         FROM usuarios
         WHERE empresa_id = ? AND status = 'ativo'
         ORDER BY CASE WHEN perfil = 'cliente_admin' THEN 0 ELSE 1 END, id ASC
         LIMIT 1`,
        [empresaId]
    );

    if (!usuario) {
        const error = new Error('Empresa sem usuario ativo para registrar sincronizacao.');
        error.status = 400;
        throw error;
    }

    return usuario.id;
}

function normalizarJson(value, fallback) {
    try {
        return JSON.parse(value || '');
    } catch (_) {
        return fallback;
    }
}

module.exports = {
    listarProdutosAlterados,
    listarCategoriasAlteradas,
    listarUsuariosAlterados,
    listarConfiguracoesAlteradas,
    listarFiliaisAlteradas,
    listarLicencaAlterada,
    listarPermissoesAlteradas,
    receberVendas,
    receberCaixa,
    receberEstoqueMovimentacoes,
    registrarLog
};
