const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { executarComando, executarQuery, buscarUm } = require('../database');
const usuarios = require('../users/repository');
const security = require('../config/security');

async function criarContador({ nome, email, senha }) {
    const nomeLimpo = limpar(nome);
    const emailLimpo = usuarios.normalizarEmail(email);
    const senhaTexto = String(senha || '');

    if (!nomeLimpo || !emailLimpo || senhaTexto.length < 6) {
        erro('Nome, email e senha com ao menos 6 caracteres sao obrigatorios.', 400);
    }
    if (await buscarContadorPorEmail(emailLimpo)) {
        erro('Este contador ja esta cadastrado.', 409);
    }

    const senhaHash = await bcrypt.hash(senhaTexto, 10);
    const result = await executarComando(
        'INSERT INTO contadores (nome, email, senha_hash) VALUES (?, ?, ?)',
        [nomeLimpo, emailLimpo, senhaHash]
    );
    return contadorSeguro(await buscarContadorPorId(result.lastInsertRowid));
}

async function loginContador({ email, senha }) {
    const contador = await buscarContadorPorEmail(email);
    if (!contador || contador.status !== 'ativo') {
        erro('Email ou senha invalidos.', 401);
    }
    const senhaValida = await bcrypt.compare(String(senha || ''), contador.senha_hash);
    if (!senhaValida) {
        erro('Email ou senha invalidos.', 401);
    }

    return {
        token: gerarTokenContador(contador),
        contador: contadorSeguro(contador)
    };
}

async function convidarContador({ empresaId, email, nome }) {
    const emailLimpo = usuarios.normalizarEmail(email);
    if (!emailLimpo) erro('Email do contador e obrigatorio.', 400);

    let contador = await buscarContadorPorEmail(emailLimpo);
    if (!contador) {
        const senhaTemporaria = Math.random().toString(36).slice(2, 10);
        const senhaHash = bcrypt.hashSync(senhaTemporaria, 10);
        const result = await executarComando(
            'INSERT INTO contadores (nome, email, senha_hash, status) VALUES (?, ?, ?, ?)',
            [limpar(nome) || emailLimpo, emailLimpo, senhaHash, 'ativo']
        );
        contador = await buscarContadorPorId(result.lastInsertRowid);
    }

    const existente = await buscarVinculo(contador.id, empresaId);
    if (existente) {
        await executarComando(
            'UPDATE contador_empresas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE contador_id = ? AND empresa_id = ?',
            ['pendente', contador.id, empresaId]
        );
    } else {
        await executarComando(
            'INSERT INTO contador_empresas (contador_id, empresa_id, status) VALUES (?, ?, ?)',
            [contador.id, empresaId, 'pendente']
        );
    }

    return buscarVinculoDetalhado(contador.id, empresaId);
}

async function aceitarConvite({ contadorId, empresaId }) {
    const vinculo = await buscarVinculo(contadorId, empresaId);
    if (!vinculo || vinculo.status === 'removido') {
        erro('Convite nao encontrado.', 404);
    }
    await executarComando(
        'UPDATE contador_empresas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE contador_id = ? AND empresa_id = ?',
        ['ativo', contadorId, empresaId]
    );
    return buscarVinculoDetalhado(contadorId, empresaId);
}

async function removerContador({ empresaId, contadorId }) {
    const vinculo = await buscarVinculo(contadorId, empresaId);
    if (!vinculo) return null;
    await executarComando(
        'UPDATE contador_empresas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE contador_id = ? AND empresa_id = ?',
        ['removido', contadorId, empresaId]
    );
    return buscarVinculoDetalhado(contadorId, empresaId);
}

async function listarContadoresEmpresa(empresaId) {
    return executarQuery(
        `SELECT c.id, c.nome, c.email, ce.status, ce.created_at, ce.updated_at
         FROM contador_empresas ce
         JOIN contadores c ON c.id = ce.contador_id
         WHERE ce.empresa_id = ? AND ce.status <> 'removido'
         ORDER BY ce.created_at DESC`,
        [empresaId]
    );
}

async function listarEmpresasDoContador(contadorId, incluirPendentes = true) {
    const params = [contadorId];
    const where = ['ce.contador_id = ?', "ce.status <> 'removido'"];
    if (!incluirPendentes) {
        where.push("ce.status = 'ativo'");
    }
    return executarQuery(
        `SELECT e.id, e.nome_fantasia AS nome, e.documento, e.status AS empresa_status,
                ce.status, ce.created_at, ce.updated_at
         FROM contador_empresas ce
         JOIN empresas e ON e.id = ce.empresa_id
         WHERE ${where.join(' AND ')}
         ORDER BY e.nome_fantasia ASC`,
        params
    );
}

async function dashboardContador(contadorId) {
    const empresasBase = await listarEmpresasDoContador(contadorId, false);
    const empresas = [];
    for (const empresa of empresasBase) {
        empresas.push({
            ...empresa,
            resumo: await resumoEmpresa(empresa.id)
        });
    }
    return { empresas, total_empresas: empresas.length };
}

async function fechamentoMensal({ contadorId, empresaId, mes }) {
    await exigirAcesso(contadorId, empresaId);
    const periodo = normalizarMes(mes);
    return {
        empresa: await buscarEmpresa(empresaId),
        periodo,
        faturamento: await faturamentoPeriodo(empresaId, periodo),
        financeiro: await financeiroPeriodo(empresaId, periodo),
        vendas: await vendasPeriodo(empresaId, periodo),
        caixa: await caixaPeriodo(empresaId, periodo),
        estoque: await estoqueResumo(empresaId)
    };
}

async function relatorio({ contadorId, empresaId, tipo = 'financeiro', mes }) {
    const fechamento = await fechamentoMensal({ contadorId, empresaId, mes });
    return {
        tipo,
        ...fechamento
    };
}

async function exportarFechamento({ contadorId, empresaId, mes, formato }) {
    const fechamento = await fechamentoMensal({ contadorId, empresaId, mes });
    if (formato === 'pdf') {
        const linhas = [
            'Real Caixa - Fechamento mensal',
            `Empresa: ${fechamento.empresa.nome_fantasia}`,
            `Mes: ${fechamento.periodo.mes}`,
            `Faturamento: ${fechamento.faturamento.total}`,
            `Entradas: ${fechamento.financeiro.entradas}`,
            `Saidas: ${fechamento.financeiro.saidas}`,
            `Vendas: ${fechamento.vendas.quantidade}`,
            `Movimentos de caixa: ${fechamento.caixa.movimentos}`
        ];
        return {
            contentType: 'application/pdf',
            filename: `fechamento-${empresaId}-${fechamento.periodo.mes}.pdf`,
            body: criarPdfSimples(linhas)
        };
    }

    const csv = [
        'campo,valor',
        `empresa,"${fechamento.empresa.nome_fantasia}"`,
        `mes,${fechamento.periodo.mes}`,
        `faturamento,${fechamento.faturamento.total}`,
        `entradas,${fechamento.financeiro.entradas}`,
        `saidas,${fechamento.financeiro.saidas}`,
        `vendas,${fechamento.vendas.quantidade}`,
        `caixa_movimentos,${fechamento.caixa.movimentos}`
    ].join('\n');
    return {
        contentType: 'text/csv; charset=utf-8',
        filename: `fechamento-${empresaId}-${fechamento.periodo.mes}.csv`,
        body: csv
    };
}

async function autenticarToken(token) {
    try {
        const payload = jwt.verify(token, security.jwtSecret());
        if (payload.perfil !== 'contador') throw new Error('perfil invalido');
        const contador = await buscarContadorPorId(payload.id);
        if (!contador || contador.status !== 'ativo') throw new Error('contador invalido');
        return contadorSeguro(contador);
    } catch (_) {
        erro('Sessao do contador invalida.', 401);
    }
}

async function exigirAcesso(contadorId, empresaId) {
    const vinculo = await buscarVinculo(contadorId, empresaId);
    if (!vinculo || vinculo.status !== 'ativo') {
        erro('Contador sem acesso a esta empresa.', 403);
    }
}

async function resumoEmpresa(empresaId) {
    const periodo = normalizarMes();
    return {
        faturamento_mensal: (await faturamentoPeriodo(empresaId, periodo)).total,
        vendas: (await vendasPeriodo(empresaId, periodo)).quantidade,
        estoque: await estoqueResumo(empresaId),
        financeiro: await financeiroPeriodo(empresaId, periodo),
        situacao_fiscal: 'regular'
    };
}

async function faturamentoPeriodo(empresaId, periodo) {
    const row = await buscarUm(
        `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS quantidade
         FROM sync_vendas
         WHERE empresa_id = ? AND date(data_venda) BETWEEN date(?) AND date(?)`,
        [empresaId, periodo.inicio, periodo.fim]
    );
    return { total: row.total || 0, quantidade: row.quantidade || 0 };
}

async function financeiroPeriodo(empresaId, periodo) {
    const row = await buscarUm(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS saidas
         FROM financeiro_lancamentos
         WHERE empresa_id = ? AND date(data) BETWEEN date(?) AND date(?)`,
        [empresaId, periodo.inicio, periodo.fim]
    );
    return { entradas: row.entradas || 0, saidas: row.saidas || 0, saldo: (row.entradas || 0) - (row.saidas || 0) };
}

async function vendasPeriodo(empresaId, periodo) {
    return faturamentoPeriodo(empresaId, periodo);
}

async function caixaPeriodo(empresaId, periodo) {
    const movimentos = await buscarUm(
        `SELECT COUNT(*) AS movimentos, COALESCE(SUM(valor), 0) AS total
         FROM sync_caixa_movimentacoes
         WHERE empresa_id = ? AND date(data_movimento) BETWEEN date(?) AND date(?)`,
        [empresaId, periodo.inicio, periodo.fim]
    );
    const fechamentos = await buscarUm(
        `SELECT COUNT(*) AS fechamentos
         FROM sync_caixa_fechamentos
         WHERE empresa_id = ? AND date(data_fechamento) BETWEEN date(?) AND date(?)`,
        [empresaId, periodo.inicio, periodo.fim]
    );
    return { movimentos: movimentos.movimentos || 0, total: movimentos.total || 0, fechamentos: fechamentos.fechamentos || 0 };
}

async function estoqueResumo(empresaId) {
    const row = await buscarUm(
        `SELECT COUNT(*) AS produtos,
                COALESCE(SUM(CASE WHEN ativo = 1 AND estoque_atual <= estoque_minimo THEN 1 ELSE 0 END), 0) AS baixo
         FROM produtos
         WHERE empresa_id = ?`,
        [empresaId]
    );
    return { produtos: row.produtos || 0, baixo: row.baixo || 0 };
}

async function buscarContadorPorEmail(email) {
    return buscarUm('SELECT * FROM contadores WHERE email = ?', [usuarios.normalizarEmail(email)]);
}

async function buscarContadorPorId(id) {
    return buscarUm('SELECT * FROM contadores WHERE id = ?', [id]);
}

async function buscarEmpresa(id) {
    return buscarUm('SELECT * FROM empresas WHERE id = ?', [id]);
}

async function buscarVinculo(contadorId, empresaId) {
    return buscarUm('SELECT * FROM contador_empresas WHERE contador_id = ? AND empresa_id = ?', [contadorId, empresaId]);
}

async function buscarVinculoDetalhado(contadorId, empresaId) {
    return buscarUm(
        `SELECT c.id AS contador_id, c.nome, c.email, e.id AS empresa_id,
                e.nome_fantasia AS empresa_nome, ce.status, ce.created_at, ce.updated_at
         FROM contador_empresas ce
         JOIN contadores c ON c.id = ce.contador_id
         JOIN empresas e ON e.id = ce.empresa_id
         WHERE ce.contador_id = ? AND ce.empresa_id = ?`,
        [contadorId, empresaId]
    );
}

function gerarTokenContador(contador) {
    return jwt.sign({
        sub: `contador:${contador.id}`,
        id: contador.id,
        email: contador.email,
        perfil: 'contador',
        permissoes: [
            'contador:dashboard',
            'contador:relatorios',
            'contador:fechamentos'
        ]
    }, security.jwtSecret(), { expiresIn: security.jwtExpiresIn() });
}

function contadorSeguro(contador) {
    return {
        id: contador.id,
        nome: contador.nome,
        email: contador.email,
        perfil: 'contador',
        status: contador.status
    };
}

function normalizarMes(mes = new Date().toISOString().slice(0, 7)) {
    const value = /^\d{4}-\d{2}$/.test(String(mes || '')) ? mes : new Date().toISOString().slice(0, 7);
    const inicio = `${value}-01`;
    const fimDate = new Date(`${inicio}T00:00:00.000Z`);
    fimDate.setUTCMonth(fimDate.getUTCMonth() + 1);
    fimDate.setUTCDate(0);
    return { mes: value, inicio, fim: fimDate.toISOString().slice(0, 10) };
}

function limpar(value) {
    return String(value || '').trim();
}

function criarPdfSimples(linhas) {
    const content = [
        'BT',
        '/F1 12 Tf',
        '50 780 Td',
        ...linhas.map((linha, index) => `${index === 0 ? '' : '0 -22 Td '}${escapePdfText(linha)} Tj`),
        'ET'
    ].filter(Boolean).join('\n');

    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(pdf, 'latin1'));
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
        pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
}

function escapePdfText(value) {
    const safe = String(value || '').replace(/[\\()]/g, '\\$&');
    return `(${safe})`;
}

function erro(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

module.exports = {
    criarContador,
    loginContador,
    convidarContador,
    aceitarConvite,
    removerContador,
    listarContadoresEmpresa,
    listarEmpresasDoContador,
    dashboardContador,
    fechamentoMensal,
    relatorio,
    exportarFechamento,
    autenticarToken,
    exigirAcesso
};
