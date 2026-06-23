const { executarComando, executarQuery, buscarUm } = require('../database');

const RECEBER_STATUS = new Set(['pendente', 'recebido', 'cancelado']);
const PAGAR_STATUS = new Set(['pendente', 'pago', 'cancelado']);
const CATEGORIA_TIPOS = new Set(['receita', 'despesa']);
const LANCAMENTO_TIPOS = new Set(['entrada', 'saida', 'transferencia']);

async function listarContasReceber({ empresaId, status, pagina = 1, limite = 50 }) {
    return listarContas('contas_receber', empresaId, status, pagina, limite);
}

async function criarContaReceber(empresaId, payload) {
    validarContaReceber(payload);
    const result = await executarComando(
        `INSERT INTO contas_receber (empresa_id, descricao, categoria, valor, vencimento, status, cliente, observacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, limpar(payload.descricao), limpar(payload.categoria), numero(payload.valor), payload.vencimento, payload.status || 'pendente', limpar(payload.cliente), limpar(payload.observacao)]
    );
    return buscarConta('contas_receber', empresaId, result.lastInsertRowid);
}

async function atualizarContaReceber(empresaId, id, payload) {
    const atual = await buscarConta('contas_receber', empresaId, id);
    if (!atual) return null;
    const dados = { ...atual, ...payload };
    validarContaReceber(dados);
    await executarComando(
        `UPDATE contas_receber
         SET descricao = ?, categoria = ?, valor = ?, vencimento = ?, status = ?, cliente = ?, observacao = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [limpar(dados.descricao), limpar(dados.categoria), numero(dados.valor), dados.vencimento, dados.status, limpar(dados.cliente), limpar(dados.observacao), id, empresaId]
    );
    return buscarConta('contas_receber', empresaId, id);
}

async function listarContasPagar({ empresaId, status, pagina = 1, limite = 50 }) {
    return listarContas('contas_pagar', empresaId, status, pagina, limite);
}

async function criarContaPagar(empresaId, payload) {
    validarContaPagar(payload);
    const result = await executarComando(
        `INSERT INTO contas_pagar (empresa_id, descricao, categoria, fornecedor, valor, vencimento, status, observacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, limpar(payload.descricao), limpar(payload.categoria), limpar(payload.fornecedor), numero(payload.valor), payload.vencimento, payload.status || 'pendente', limpar(payload.observacao)]
    );
    return buscarConta('contas_pagar', empresaId, result.lastInsertRowid);
}

async function atualizarContaPagar(empresaId, id, payload) {
    const atual = await buscarConta('contas_pagar', empresaId, id);
    if (!atual) return null;
    const dados = { ...atual, ...payload };
    validarContaPagar(dados);
    await executarComando(
        `UPDATE contas_pagar
         SET descricao = ?, categoria = ?, fornecedor = ?, valor = ?, vencimento = ?, status = ?, observacao = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [limpar(dados.descricao), limpar(dados.categoria), limpar(dados.fornecedor), numero(dados.valor), dados.vencimento, dados.status, limpar(dados.observacao), id, empresaId]
    );
    return buscarConta('contas_pagar', empresaId, id);
}

async function listarCategorias({ empresaId, tipo, incluirInativas = false }) {
    const params = [empresaId];
    const where = ['empresa_id = ?'];
    if (tipo) {
        where.push('tipo = ?');
        params.push(tipo);
    }
    if (!incluirInativas) where.push('ativo = 1');
    return executarQuery(
        `SELECT * FROM financeiro_categorias WHERE ${where.join(' AND ')} ORDER BY tipo, nome`,
        params
    );
}

async function criarCategoria(empresaId, payload) {
    validarCategoria(payload);
    const result = await executarComando(
        'INSERT INTO financeiro_categorias (empresa_id, nome, tipo) VALUES (?, ?, ?)',
        [empresaId, limpar(payload.nome), payload.tipo]
    );
    return buscarUm('SELECT * FROM financeiro_categorias WHERE id = ? AND empresa_id = ?', [result.lastInsertRowid, empresaId]);
}

async function atualizarCategoria(empresaId, id, payload) {
    const atual = await buscarUm('SELECT * FROM financeiro_categorias WHERE id = ? AND empresa_id = ?', [id, empresaId]);
    if (!atual) return null;
    const dados = { ...atual, ...payload };
    validarCategoria(dados);
    await executarComando(
        'UPDATE financeiro_categorias SET nome = ?, tipo = ?, ativo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?',
        [limpar(dados.nome), dados.tipo, Number(Boolean(dados.ativo)), id, empresaId]
    );
    return buscarUm('SELECT * FROM financeiro_categorias WHERE id = ? AND empresa_id = ?', [id, empresaId]);
}

async function desativarCategoria(empresaId, id) {
    return atualizarCategoria(empresaId, id, { ativo: false });
}

async function listarLancamentos({ empresaId, tipo, dataInicio, dataFim, pagina = 1, limite = 50 }) {
    const page = Math.max(Number(pagina) || 1, 1);
    const limit = Math.min(Math.max(Number(limite) || 50, 1), 100);
    const offset = (page - 1) * limit;
    const params = [empresaId];
    const where = ['fl.empresa_id = ?'];
    if (tipo) {
        where.push('fl.tipo = ?');
        params.push(tipo);
    }
    if (dataInicio) {
        where.push('date(fl.data) >= date(?)');
        params.push(dataInicio);
    }
    if (dataFim) {
        where.push('date(fl.data) <= date(?)');
        params.push(dataFim);
    }
    const whereSql = where.join(' AND ');
    const total = (await buscarUm(`SELECT COUNT(*) AS total FROM financeiro_lancamentos fl WHERE ${whereSql}`, params)).total;
    const dados = await executarQuery(
        `SELECT fl.*, u.nome AS usuario_nome
         FROM financeiro_lancamentos fl
         JOIN usuarios u ON u.id = fl.usuario_id AND u.empresa_id = fl.empresa_id
         WHERE ${whereSql}
         ORDER BY fl.data DESC, fl.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    return { dados, paginacao: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) || 1 } };
}

async function criarLancamento({ empresaId, usuarioId, payload }) {
    validarLancamento(payload);
    const result = await executarComando(
        `INSERT INTO financeiro_lancamentos (empresa_id, tipo, descricao, categoria, valor, data, observacao, usuario_id, origem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, payload.tipo, limpar(payload.descricao), limpar(payload.categoria), numero(payload.valor), payload.data, limpar(payload.observacao), usuarioId, payload.origem || 'manual']
    );
    return buscarUm('SELECT * FROM financeiro_lancamentos WHERE id = ? AND empresa_id = ?', [result.lastInsertRowid, empresaId]);
}

async function dashboard({ empresaId, periodo = 'mes', dataInicio, dataFim }) {
    const range = periodoRange(periodo, dataInicio, dataFim);
    const [lancamentos, recebidos, pagos, saldoAtual, contasVencidas, contasAVencer, graficos] = await Promise.all([
        resumoLancamentos(empresaId, range),
        somaTabela('contas_receber', empresaId, "status = 'recebido'", range),
        somaTabela('contas_pagar', empresaId, "status = 'pago'", range),
        saldoAteHoje(empresaId),
        contarVencidas(empresaId),
        contarAVencer(empresaId),
        graficosMensais(empresaId)
    ]);
    const entradas = lancamentos.entradas + recebidos;
    const saidas = lancamentos.saidas + pagos;

    return {
        periodo: range,
        indicadores: {
            faturamento_mes: entradas,
            despesas_mes: saidas,
            lucro_operacional: entradas - saidas,
            contas_vencidas: contasVencidas,
            contas_a_vencer: contasAVencer,
            saldo_atual: saldoAtual,
            entradas,
            saidas,
            saldo_projetado: saldoAtual + contasAVencer.receber - contasAVencer.pagar
        },
        graficos
    };
}

async function listarContas(table, empresaId, status, pagina, limite) {
    const page = Math.max(Number(pagina) || 1, 1);
    const limit = Math.min(Math.max(Number(limite) || 50, 1), 100);
    const offset = (page - 1) * limit;
    const params = [empresaId];
    const where = ['empresa_id = ?'];
    if (status) {
        where.push('status = ?');
        params.push(status);
    }
    const whereSql = where.join(' AND ');
    const total = (await buscarUm(`SELECT COUNT(*) AS total FROM ${table} WHERE ${whereSql}`, params)).total;
    const dados = await executarQuery(
        `SELECT * FROM ${table} WHERE ${whereSql} ORDER BY vencimento ASC, id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    return { dados, paginacao: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) || 1 } };
}

async function buscarConta(table, empresaId, id) {
    return buscarUm(`SELECT * FROM ${table} WHERE id = ? AND empresa_id = ?`, [id, empresaId]);
}

async function resumoLancamentos(empresaId, range) {
    const row = await buscarUm(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS saidas
         FROM financeiro_lancamentos
         WHERE empresa_id = ? AND date(data) BETWEEN date(?) AND date(?)`,
        [empresaId, range.inicio, range.fim]
    );
    return { entradas: row.entradas || 0, saidas: row.saidas || 0 };
}

async function somaTabela(table, empresaId, statusSql, range) {
    const dateField = table === 'contas_receber' ? 'vencimento' : 'vencimento';
    return (await buscarUm(
        `SELECT COALESCE(SUM(valor), 0) AS total FROM ${table}
         WHERE empresa_id = ? AND ${statusSql} AND date(${dateField}) BETWEEN date(?) AND date(?)`,
        [empresaId, range.inicio, range.fim]
    )).total || 0;
}

async function saldoAteHoje(empresaId) {
    const row = await buscarUm(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor WHEN tipo = 'saida' THEN -valor ELSE 0 END), 0) AS saldo
         FROM financeiro_lancamentos
         WHERE empresa_id = ? AND date(data) <= date('now')`,
        [empresaId]
    );
    const recebidos = (await buscarUm("SELECT COALESCE(SUM(valor), 0) AS total FROM contas_receber WHERE empresa_id = ? AND status = 'recebido' AND date(vencimento) <= date('now')", [empresaId])).total || 0;
    const pagos = (await buscarUm("SELECT COALESCE(SUM(valor), 0) AS total FROM contas_pagar WHERE empresa_id = ? AND status = 'pago' AND date(vencimento) <= date('now')", [empresaId])).total || 0;
    return (row.saldo || 0) + recebidos - pagos;
}

async function contarVencidas(empresaId) {
    const receber = (await buscarUm("SELECT COUNT(*) AS total FROM contas_receber WHERE empresa_id = ? AND status = 'pendente' AND date(vencimento) < date('now')", [empresaId])).total || 0;
    const pagar = (await buscarUm("SELECT COUNT(*) AS total FROM contas_pagar WHERE empresa_id = ? AND status = 'pendente' AND date(vencimento) < date('now')", [empresaId])).total || 0;
    return { receber, pagar, total: receber + pagar };
}

async function contarAVencer(empresaId) {
    const receber = (await buscarUm("SELECT COALESCE(SUM(valor), 0) AS total FROM contas_receber WHERE empresa_id = ? AND status = 'pendente' AND date(vencimento) >= date('now')", [empresaId])).total || 0;
    const pagar = (await buscarUm("SELECT COALESCE(SUM(valor), 0) AS total FROM contas_pagar WHERE empresa_id = ? AND status = 'pendente' AND date(vencimento) >= date('now')", [empresaId])).total || 0;
    return { receber, pagar, total: receber + pagar };
}

async function graficosMensais(empresaId) {
    const rows = await executarQuery(
        `SELECT substr(data, 1, 7) AS mes,
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS receitas,
                COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS despesas
         FROM financeiro_lancamentos
         WHERE empresa_id = ?
         GROUP BY substr(data, 1, 7)
         ORDER BY mes ASC
         LIMIT 12`,
        [empresaId]
    );
    return {
        receitas_por_mes: rows.map((row) => ({ mes: row.mes, valor: row.receitas })),
        despesas_por_mes: rows.map((row) => ({ mes: row.mes, valor: row.despesas })),
        evolucao_caixa: rows.map((row) => ({ mes: row.mes, valor: row.receitas - row.despesas }))
    };
}

function periodoRange(periodo, inicio, fim) {
    if (periodo === 'hoje') return { inicio: hoje(), fim: hoje() };
    if (periodo === 'semana') return { inicio: offsetDate(-7), fim: hoje() };
    if (periodo === 'personalizado' && inicio && fim) return { inicio, fim };
    return { inicio: `${hoje().slice(0, 7)}-01`, fim: hoje() };
}

function hoje() {
    return new Date().toISOString().slice(0, 10);
}

function offsetDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function validarContaReceber(payload) {
    if (!limpar(payload.descricao)) erro('Descricao e obrigatoria.');
    if (!(numero(payload.valor) > 0)) erro('Valor deve ser maior que zero.');
    if (!payload.vencimento) erro('Vencimento e obrigatorio.');
    if (payload.status && !RECEBER_STATUS.has(payload.status)) erro('Status de conta a receber invalido.');
}

function validarContaPagar(payload) {
    if (!limpar(payload.descricao)) erro('Descricao e obrigatoria.');
    if (!(numero(payload.valor) > 0)) erro('Valor deve ser maior que zero.');
    if (!payload.vencimento) erro('Vencimento e obrigatorio.');
    if (payload.status && !PAGAR_STATUS.has(payload.status)) erro('Status de conta a pagar invalido.');
}

function validarCategoria(payload) {
    if (!limpar(payload.nome)) erro('Nome da categoria e obrigatorio.');
    if (!CATEGORIA_TIPOS.has(payload.tipo)) erro('Tipo de categoria financeira invalido.');
}

function validarLancamento(payload) {
    if (!LANCAMENTO_TIPOS.has(payload.tipo)) erro('Tipo de lancamento invalido.');
    if (!limpar(payload.descricao)) erro('Descricao e obrigatoria.');
    if (!(numero(payload.valor) > 0)) erro('Valor deve ser maior que zero.');
    if (!payload.data) erro('Data e obrigatoria.');
}

function erro(message) {
    const error = new Error(message);
    error.status = 400;
    throw error;
}

function limpar(value) {
    return String(value || '').trim();
}

function numero(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = {
    listarContasReceber,
    criarContaReceber,
    atualizarContaReceber,
    listarContasPagar,
    criarContaPagar,
    atualizarContaPagar,
    listarCategorias,
    criarCategoria,
    atualizarCategoria,
    desativarCategoria,
    listarLancamentos,
    criarLancamento,
    dashboard
};
