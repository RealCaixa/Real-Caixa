const { executarComando, executarQuery, buscarUm, transacao } = require('../database');
const produtos = require('../produtos/repository');

const TIPOS = new Set(['entrada', 'saida', 'ajuste', 'perda', 'inventario']);

async function listarEstoque({ empresaId, busca = '', pagina = 1, limite = 50 }) {
    const page = Math.max(Number(pagina) || 1, 1);
    const limit = Math.min(Math.max(Number(limite) || 50, 1), 100);
    const offset = (page - 1) * limit;
    const params = [empresaId];
    const where = ['p.empresa_id = ?', 'p.ativo = 1'];

    if (busca) {
        where.push('(p.descricao LIKE ? OR p.codigo_interno LIKE ? OR p.codigo_barras LIKE ?)');
        params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }

    const whereSql = where.join(' AND ');
    const total = (await buscarUm(`SELECT COUNT(*) AS total FROM produtos p WHERE ${whereSql}`, params)).total;
    const dados = (await executarQuery(
        `SELECT p.id, p.descricao, p.codigo_interno, p.codigo_barras, p.estoque_atual,
                p.estoque_minimo, p.unidade, p.custo, p.preco_venda,
                (
                    SELECT em.created_at
                    FROM estoque_movimentacoes em
                    WHERE em.empresa_id = p.empresa_id AND em.produto_id = p.id
                    ORDER BY em.created_at DESC, em.id DESC
                    LIMIT 1
                ) AS ultima_movimentacao
         FROM produtos p
         WHERE ${whereSql}
         ORDER BY p.descricao ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    )).map((item) => ({ ...item, status_estoque: statusEstoque(item) }));

    return {
        dados,
        paginacao: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) || 1 }
    };
}

async function indicadores(empresaId) {
    const total = (await buscarUm('SELECT COUNT(*) AS total FROM produtos WHERE empresa_id = ? AND ativo = 1', [empresaId])).total;
    const semEstoque = (await buscarUm('SELECT COUNT(*) AS total FROM produtos WHERE empresa_id = ? AND ativo = 1 AND estoque_atual <= 0', [empresaId])).total;
    const abaixoMinimo = (await buscarUm('SELECT COUNT(*) AS total FROM produtos WHERE empresa_id = ? AND ativo = 1 AND estoque_atual > 0 AND estoque_atual <= estoque_minimo', [empresaId])).total;
    const criticos = (await buscarUm(
        `SELECT COUNT(*) AS total
         FROM produtos
         WHERE empresa_id = ? AND ativo = 1 AND estoque_atual > 0 AND estoque_minimo > 0 AND estoque_atual <= (estoque_minimo * 0.5)`,
        [empresaId]
    )).total;

    return {
        total_itens_cadastrados: total,
        produtos_sem_estoque: semEstoque,
        produtos_abaixo_minimo: abaixoMinimo,
        produtos_criticos: criticos
    };
}

async function registrarEntrada({ empresaId, usuarioId, produtoId, quantidade, custoUnitario, observacao }) {
    return movimentar({ empresaId, usuarioId, produtoId, tipo: 'entrada', quantidade, custoUnitario, observacao });
}

async function registrarSaida({ empresaId, usuarioId, produtoId, quantidade, observacao }) {
    return movimentar({ empresaId, usuarioId, produtoId, tipo: 'saida', quantidade, observacao });
}

async function registrarPerda({ empresaId, usuarioId, produtoId, quantidade, observacao }) {
    return movimentar({ empresaId, usuarioId, produtoId, tipo: 'perda', quantidade, observacao });
}

async function registrarAjuste({ empresaId, usuarioId, produtoId, estoqueCorrigido, observacao }) {
    return ajustarSaldo({ empresaId, usuarioId, produtoId, tipo: 'ajuste', novoSaldo: estoqueCorrigido, observacao });
}

async function registrarInventario({ empresaId, usuarioId, produtoId, contagemFisica, observacao }) {
    return ajustarSaldo({ empresaId, usuarioId, produtoId, tipo: 'inventario', novoSaldo: contagemFisica, observacao });
}

async function listarMovimentacoes({ empresaId, produtoId, tipo, dataInicio, dataFim, pagina = 1, limite = 50 }) {
    const page = Math.max(Number(pagina) || 1, 1);
    const limit = Math.min(Math.max(Number(limite) || 50, 1), 100);
    const offset = (page - 1) * limit;
    const params = [empresaId];
    const where = ['em.empresa_id = ?'];

    if (produtoId) {
        where.push('em.produto_id = ?');
        params.push(Number(produtoId));
    }
    if (tipo) {
        where.push('em.tipo = ?');
        params.push(tipo);
    }
    if (dataInicio) {
        where.push('date(em.created_at) >= date(?)');
        params.push(dataInicio);
    }
    if (dataFim) {
        where.push('date(em.created_at) <= date(?)');
        params.push(dataFim);
    }

    const whereSql = where.join(' AND ');
    const total = (await buscarUm(`SELECT COUNT(*) AS total FROM estoque_movimentacoes em WHERE ${whereSql}`, params)).total;
    const dados = await executarQuery(
        `SELECT em.*, p.descricao AS produto_descricao, p.codigo_interno, u.nome AS usuario_nome
         FROM estoque_movimentacoes em
         JOIN produtos p ON p.id = em.produto_id AND p.empresa_id = em.empresa_id
         JOIN usuarios u ON u.id = em.usuario_id AND u.empresa_id = em.empresa_id
         WHERE ${whereSql}
         ORDER BY em.created_at DESC, em.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return {
        dados,
        paginacao: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) || 1 }
    };
}

async function movimentar({ empresaId, usuarioId, produtoId, tipo, quantidade, custoUnitario = null, observacao = '' }) {
    validarTipo(tipo);
    validarQuantidade(quantidade);

    return transacao(async () => {
        const produto = await obterProduto(empresaId, produtoId);
        const sinal = tipo === 'entrada' ? 1 : -1;
        const novoSaldo = Number(produto.estoque_atual) + (Number(quantidade) * sinal);

        if (novoSaldo < 0) {
            const error = new Error('Estoque insuficiente para esta movimentacao.');
            error.status = 400;
            throw error;
        }

        await atualizarSaldoProduto({ empresaId, produtoId, novoSaldo, custoUnitario });
        const movimento = await inserirMovimento({ empresaId, usuarioId, produtoId, tipo, quantidade, custoUnitario, observacao });

        return { produto: await produtos.buscarProdutoPorId(empresaId, produtoId), movimento };
    });
}

async function ajustarSaldo({ empresaId, usuarioId, produtoId, tipo, novoSaldo, observacao = '' }) {
    validarTipo(tipo);
    validarSaldo(novoSaldo);

    return transacao(async () => {
        const produto = await obterProduto(empresaId, produtoId);
        const diferenca = Number(novoSaldo) - Number(produto.estoque_atual);

        await atualizarSaldoProduto({ empresaId, produtoId, novoSaldo });
        const movimento = await inserirMovimento({
            empresaId,
            usuarioId,
            produtoId,
            tipo,
            quantidade: diferenca,
            custoUnitario: null,
            observacao
        });

        return { produto: await produtos.buscarProdutoPorId(empresaId, produtoId), movimento, diferenca };
    });
}

async function inserirMovimento({ empresaId, usuarioId, produtoId, tipo, quantidade, custoUnitario, observacao }) {
    const result = await executarComando(
        `INSERT INTO estoque_movimentacoes (
            empresa_id, produto_id, tipo, quantidade, custo_unitario, observacao, usuario_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, produtoId, tipo, quantidade, custoUnitario, observacao || null, usuarioId]
    );

    return buscarUm('SELECT * FROM estoque_movimentacoes WHERE id = ? AND empresa_id = ?', [result.lastInsertRowid, empresaId]);
}

async function atualizarSaldoProduto({ empresaId, produtoId, novoSaldo, custoUnitario }) {
    await executarComando(
        `UPDATE produtos
         SET estoque_atual = ?,
             custo = CASE WHEN ? IS NULL THEN custo ELSE ? END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND empresa_id = ?`,
        [novoSaldo, custoUnitario ?? null, custoUnitario ?? null, produtoId, empresaId]
    );
}

async function obterProduto(empresaId, produtoId) {
    const produto = await produtos.buscarProdutoPorId(empresaId, produtoId);
    if (!produto || !produto.ativo) {
        const error = new Error('Produto nao encontrado.');
        error.status = 404;
        throw error;
    }
    return produto;
}

function statusEstoque(produto) {
    const atual = Number(produto.estoque_atual);
    const minimo = Number(produto.estoque_minimo);
    if (atual <= 0) return 'Sem estoque';
    if (minimo > 0 && atual <= minimo * 0.5) return 'Critico';
    if (minimo > 0 && atual <= minimo) return 'Baixo';
    return 'Normal';
}

function validarTipo(tipo) {
    if (!TIPOS.has(tipo)) {
        const error = new Error('Tipo de movimentacao invalido.');
        error.status = 400;
        throw error;
    }
}

function validarQuantidade(quantidade) {
    if (!(Number(quantidade) > 0)) {
        const error = new Error('Quantidade deve ser maior que zero.');
        error.status = 400;
        throw error;
    }
}

function validarSaldo(saldo) {
    if (!(Number(saldo) >= 0)) {
        const error = new Error('Saldo informado deve ser maior ou igual a zero.');
        error.status = 400;
        throw error;
    }
}

module.exports = {
    listarEstoque,
    indicadores,
    registrarEntrada,
    registrarSaida,
    registrarPerda,
    registrarAjuste,
    registrarInventario,
    listarMovimentacoes,
    statusEstoque
};
