const { executarQuery, buscarUm } = require('../database');
const logger = require('../logger');

async function indicadoresEmpresa(empresaId, periodo = periodoHoje()) {
    return {
        periodo,
        faturamento: await indicadorSeguro('faturamento', () => faturamentoPorPeriodo(empresaId, periodo), { total: 0, vendas: 0 }),
        lucro_bruto_estimado: await indicadorSeguro('lucro_bruto_estimado', () => lucroBrutoEstimado(empresaId, periodo), { receita: 0, custo: 0, lucro: 0 }),
        margem_por_produto: await indicadorSeguro('margem_por_produto', () => margemPorProduto(empresaId, periodo), []),
        produtos_mais_vendidos: await indicadorSeguro('produtos_mais_vendidos', () => produtosMaisVendidos(empresaId, periodo), []),
        produtos_mais_lucrativos: await indicadorSeguro('produtos_mais_lucrativos', () => produtosMaisLucrativos(empresaId, periodo), []),
        estoque_baixo: await indicadorSeguro('estoque_baixo', () => estoqueBaixo(empresaId), []),
        previsao_ruptura: await indicadorSeguro('previsao_ruptura', () => previsaoRupturaEstoque(empresaId), []),
        contas_vencidas: await indicadorSeguro('contas_vencidas', () => contasVencidas(empresaId), fallbackContas()),
        contas_a_vencer: await indicadorSeguro('contas_a_vencer', () => contasAVencer(empresaId), fallbackContas()),
        ticket_medio: await indicadorSeguro('ticket_medio', () => ticketMedio(empresaId, periodo), { valor: 0, vendas: 0 }),
        vendas_por_forma_pagamento: await indicadorSeguro('vendas_por_forma_pagamento', () => vendasPorFormaPagamento(empresaId, periodo), [])
    };
}

async function faturamentoPorPeriodo(empresaId, periodo) {
    const row = await buscarUm(
        `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS vendas
         FROM sync_vendas
         WHERE empresa_id = ? AND date(data_venda) BETWEEN date(?) AND date(?)`,
        [empresaId, periodo.inicio, periodo.fim]
    ) || {};
    return { total: numero(row.total), vendas: Number(row.vendas || 0) };
}

async function lucroBrutoEstimado(empresaId, periodo) {
    const row = await buscarUm(
        `SELECT
            COALESCE(SUM(i.total), 0) AS receita,
            COALESCE(SUM(i.quantidade * COALESCE(p.custo, 0)), 0) AS custo
         FROM sync_venda_itens i
         JOIN sync_vendas v ON v.id = i.venda_id AND v.empresa_id = i.empresa_id
         LEFT JOIN produtos p ON p.id = i.produto_id AND p.empresa_id = i.empresa_id
         WHERE i.empresa_id = ? AND date(v.data_venda) BETWEEN date(?) AND date(?)`,
        [empresaId, periodo.inicio, periodo.fim]
    ) || {};
    const receita = numero(row.receita);
    const custo = numero(row.custo);
    return { receita, custo, lucro: receita - custo };
}

async function margemPorProduto(empresaId, periodo) {
    return (await executarQuery(
        `SELECT
            COALESCE(p.id, i.produto_id) AS produto_id,
            COALESCE(p.descricao, i.descricao) AS descricao,
            COALESCE(SUM(i.total), 0) AS receita,
            COALESCE(SUM(i.quantidade * COALESCE(p.custo, 0)), 0) AS custo,
            COALESCE(SUM(i.total) - SUM(i.quantidade * COALESCE(p.custo, 0)), 0) AS lucro
         FROM sync_venda_itens i
         JOIN sync_vendas v ON v.id = i.venda_id AND v.empresa_id = i.empresa_id
         LEFT JOIN produtos p ON p.id = i.produto_id AND p.empresa_id = i.empresa_id
         WHERE i.empresa_id = ? AND date(v.data_venda) BETWEEN date(?) AND date(?)
         GROUP BY COALESCE(p.id, i.produto_id), COALESCE(p.descricao, i.descricao)
         ORDER BY lucro DESC, receita DESC
         LIMIT 20`,
        [empresaId, periodo.inicio, periodo.fim]
    )).map((item) => ({
        ...item,
        receita: numero(item.receita),
        custo: numero(item.custo),
        lucro: numero(item.lucro),
        margem_percentual: numero(item.receita) > 0 ? (numero(item.lucro) / numero(item.receita)) * 100 : 0
    }));
}

async function produtosMaisVendidos(empresaId, periodo) {
    return (await executarQuery(
        `SELECT
            COALESCE(p.id, i.produto_id) AS produto_id,
            COALESCE(p.descricao, i.descricao) AS descricao,
            COALESCE(SUM(i.quantidade), 0) AS quantidade,
            COALESCE(SUM(i.total), 0) AS total
         FROM sync_venda_itens i
         JOIN sync_vendas v ON v.id = i.venda_id AND v.empresa_id = i.empresa_id
         LEFT JOIN produtos p ON p.id = i.produto_id AND p.empresa_id = i.empresa_id
         WHERE i.empresa_id = ? AND date(v.data_venda) BETWEEN date(?) AND date(?)
         GROUP BY COALESCE(p.id, i.produto_id), COALESCE(p.descricao, i.descricao)
         ORDER BY quantidade DESC, total DESC
         LIMIT 10`,
        [empresaId, periodo.inicio, periodo.fim]
    )).map((item) => ({ ...item, quantidade: numero(item.quantidade), total: numero(item.total) }));
}

async function produtosMaisLucrativos(empresaId, periodo) {
    return (await margemPorProduto(empresaId, periodo)).slice(0, 10);
}

async function estoqueBaixo(empresaId) {
    return (await executarQuery(
        `SELECT id, descricao, codigo_interno, estoque_atual, estoque_minimo, unidade
         FROM produtos
         WHERE empresa_id = ? AND ativo = 1 AND estoque_atual <= estoque_minimo
         ORDER BY estoque_atual ASC, descricao ASC
         LIMIT 50`,
        [empresaId]
    )).map((item) => ({
        ...item,
        estoque_atual: numero(item.estoque_atual),
        estoque_minimo: numero(item.estoque_minimo)
    }));
}

async function previsaoRupturaEstoque(empresaId) {
    return (await executarQuery(
        `SELECT id, descricao, estoque_atual, unidade, media_diaria
         FROM (
            SELECT
                p.id,
                p.descricao,
                p.estoque_atual,
                p.unidade,
                COALESCE(SUM(CASE WHEN v.id IS NOT NULL THEN i.quantidade ELSE 0 END), 0) / 30.0 AS media_diaria
            FROM produtos p
            LEFT JOIN sync_venda_itens i ON i.produto_id = p.id AND i.empresa_id = p.empresa_id
            LEFT JOIN sync_vendas v ON v.id = i.venda_id AND v.empresa_id = i.empresa_id
                AND date(v.data_venda) >= date('now', '-30 day')
            WHERE p.empresa_id = ? AND p.ativo = 1
            GROUP BY p.id, p.descricao, p.estoque_atual, p.unidade
         ) previsao
         WHERE media_diaria > 0
         ORDER BY (estoque_atual / media_diaria) ASC
         LIMIT 20`,
        [empresaId]
    )).map((item) => ({
        ...item,
        estoque_atual: numero(item.estoque_atual),
        media_diaria: numero(item.media_diaria),
        dias_ate_ruptura: numero(item.media_diaria) > 0 ? numero(item.estoque_atual) / numero(item.media_diaria) : null
    }));
}

async function contasVencidas(empresaId) {
    return {
        receber: await somaConta('contas_receber', empresaId, "status = 'pendente' AND date(vencimento) < date('now')"),
        pagar: await somaConta('contas_pagar', empresaId, "status = 'pendente' AND date(vencimento) < date('now')")
    };
}

async function contasAVencer(empresaId) {
    return {
        receber: await somaConta('contas_receber', empresaId, "status = 'pendente' AND date(vencimento) >= date('now')"),
        pagar: await somaConta('contas_pagar', empresaId, "status = 'pendente' AND date(vencimento) >= date('now')")
    };
}

async function ticketMedio(empresaId, periodo) {
    const faturamento = await faturamentoPorPeriodo(empresaId, periodo);
    return {
        valor: faturamento.vendas > 0 ? faturamento.total / faturamento.vendas : 0,
        vendas: faturamento.vendas
    };
}

async function vendasPorFormaPagamento(empresaId, periodo) {
    return (await executarQuery(
        `SELECT p.forma, COALESCE(SUM(p.valor), 0) AS total, COUNT(*) AS pagamentos
         FROM sync_venda_pagamentos p
         JOIN sync_vendas v ON v.id = p.venda_id AND v.empresa_id = p.empresa_id
         WHERE p.empresa_id = ? AND date(v.data_venda) BETWEEN date(?) AND date(?)
         GROUP BY p.forma
         ORDER BY total DESC`,
        [empresaId, periodo.inicio, periodo.fim]
    )).map((item) => ({ ...item, total: numero(item.total), pagamentos: Number(item.pagamentos || 0) }));
}

async function somaConta(tabela, empresaId, filtro) {
    const row = await buscarUm(
        `SELECT COUNT(*) AS quantidade, COALESCE(SUM(valor), 0) AS total
         FROM ${tabela}
         WHERE empresa_id = ? AND ${filtro}`,
        [empresaId]
    ) || {};
    return { quantidade: Number(row.quantidade || 0), total: numero(row.total) };
}

async function indicadorSeguro(nome, callback, fallback) {
    try {
        return await callback();
    } catch (error) {
        logger.warn('Indicador do assistente indisponivel', {
            indicador: nome,
            erro: error.message
        });
        return fallback;
    }
}

function fallbackContas() {
    return {
        receber: { quantidade: 0, total: 0 },
        pagar: { quantidade: 0, total: 0 }
    };
}

function periodoHoje() {
    const hoje = new Date().toISOString().slice(0, 10);
    return { inicio: hoje, fim: hoje, label: 'hoje' };
}

function periodoMesAtual() {
    const hoje = new Date().toISOString().slice(0, 10);
    return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje, label: 'mes_atual' };
}

function normalizarPeriodo(periodo) {
    if (periodo === 'mes') return periodoMesAtual();
    return periodoHoje();
}

function numero(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = {
    indicadoresEmpresa,
    faturamentoPorPeriodo,
    lucroBrutoEstimado,
    margemPorProduto,
    produtosMaisVendidos,
    produtosMaisLucrativos,
    estoqueBaixo,
    previsaoRupturaEstoque,
    contasVencidas,
    contasAVencer,
    ticketMedio,
    vendasPorFormaPagamento,
    normalizarPeriodo
};
