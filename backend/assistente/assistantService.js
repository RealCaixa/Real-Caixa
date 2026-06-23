const { executarComando } = require('../database');
const { construirContexto } = require('./dataContextBuilder');
const { montarPromptInterno } = require('./promptBuilder');

async function perguntar({ empresaId, usuarioId = null, contadorId = null, origem, pergunta }) {
    const texto = limpar(pergunta);
    if (!texto) {
        erro('Pergunta e obrigatoria.', 400);
    }

    const contexto = await construirContexto({ empresaId, periodo: detectarPeriodo(texto) });
    const prompt = montarPromptInterno({ pergunta: texto, contexto });
    const resposta = responderPorRegra(texto, contexto);

    await registrarAuditoria({
        empresaId,
        usuarioId,
        contadorId,
        origem,
        pergunta: texto,
        tipoResposta: resposta.tipo
    });

    return {
        pergunta: texto,
        modo: 'simulado',
        origem,
        prompt_preview: prompt,
        resposta
    };
}

function responderPorRegra(pergunta, contexto) {
    const normalizada = normalizar(pergunta);
    const indicadores = contexto.indicadores;

    if (incluiAlgum(normalizada, ['quanto vendi hoje', 'vendi hoje', 'faturamento hoje', 'vendas hoje'])) {
        return respostaCard({
            tipo: 'faturamento',
            titulo: 'Faturamento de hoje',
            texto: `Hoje foram registradas ${indicadores.faturamento.vendas} venda(s), somando ${moeda(indicadores.faturamento.total)}.`,
            cards: [
                card('Faturamento', moeda(indicadores.faturamento.total)),
                card('Vendas', indicadores.faturamento.vendas),
                card('Ticket medio', moeda(indicadores.ticket_medio.valor))
            ]
        });
    }

    if (incluiAlgum(normalizada, ['produto mais lucrativo', 'mais lucrativo', 'maior lucro'])) {
        const produto = indicadores.produtos_mais_lucrativos[0];
        return respostaCard({
            tipo: 'produto_mais_lucrativo',
            titulo: 'Produto mais lucrativo',
            texto: produto
                ? `${produto.descricao} lidera lucro bruto estimado com ${moeda(produto.lucro)} e margem de ${percent(produto.margem_percentual)}.`
                : 'Ainda nao ha vendas suficientes para calcular produto mais lucrativo.',
            cards: produto ? [
                card('Produto', produto.descricao),
                card('Lucro estimado', moeda(produto.lucro)),
                card('Margem', percent(produto.margem_percentual))
            ] : []
        });
    }

    if (incluiAlgum(normalizada, ['produto mais vendeu', 'mais vendido', 'mais vendeu'])) {
        const produto = indicadores.produtos_mais_vendidos[0];
        return respostaCard({
            tipo: 'produto_mais_vendido',
            titulo: 'Produto mais vendido',
            texto: produto
                ? `${produto.descricao} foi o produto mais vendido no periodo, com ${produto.quantidade} unidade(s) e ${moeda(produto.total)}.`
                : 'Ainda nao ha vendas suficientes para apontar o produto mais vendido.',
            cards: produto ? [
                card('Produto', produto.descricao),
                card('Quantidade', produto.quantidade),
                card('Total vendido', moeda(produto.total))
            ] : []
        });
    }

    if (incluiAlgum(normalizada, ['estoque baixo', 'produtos baixos', 'baixo estoque', 'ruptura'])) {
        const baixos = indicadores.estoque_baixo;
        return respostaCard({
            tipo: 'estoque_baixo',
            titulo: 'Produtos com estoque baixo',
            texto: baixos.length
                ? `${baixos.length} produto(s) estao no minimo ou abaixo do minimo.`
                : 'Nenhum produto ativo esta abaixo do estoque minimo.',
            cards: baixos.slice(0, 5).map((item) => card(item.descricao, `${item.estoque_atual} ${item.unidade} / min. ${item.estoque_minimo}`)),
            dados: baixos
        });
    }

    if (incluiAlgum(normalizada, ['contas vencidas', 'tenho vencidas', 'vencido'])) {
        const vencidas = indicadores.contas_vencidas;
        const total = vencidas.receber.total + vencidas.pagar.total;
        return respostaCard({
            tipo: 'contas_vencidas',
            titulo: 'Contas vencidas',
            texto: `Ha ${vencidas.receber.quantidade + vencidas.pagar.quantidade} conta(s) vencida(s), somando ${moeda(total)}.`,
            cards: [
                card('A receber vencido', moeda(vencidas.receber.total)),
                card('A pagar vencido', moeda(vencidas.pagar.total)),
                card('Total vencido', moeda(total))
            ]
        });
    }

    if (incluiAlgum(normalizada, ['ticket medio', 'ticket médio', 'media por venda', 'media de venda'])) {
        return respostaCard({
            tipo: 'ticket_medio',
            titulo: 'Ticket medio',
            texto: `O ticket medio do periodo e ${moeda(indicadores.ticket_medio.valor)} em ${indicadores.ticket_medio.vendas} venda(s).`,
            cards: [
                card('Ticket medio', moeda(indicadores.ticket_medio.valor)),
                card('Vendas', indicadores.ticket_medio.vendas)
            ]
        });
    }

    return respostaCard({
        tipo: 'nao_suportada',
        titulo: 'Pergunta ainda nao suportada',
        texto: 'Nesta primeira versao eu respondo sobre faturamento, produto mais vendido, produto mais lucrativo, estoque baixo, contas vencidas e ticket medio.',
        cards: sugestoes().map((sugestao) => card('Sugestao', sugestao))
    });
}

async function registrarAuditoria({ empresaId, usuarioId, contadorId, origem, pergunta, tipoResposta }) {
    await executarComando(
        `INSERT INTO assistente_auditoria (
            empresa_id, usuario_id, contador_id, origem, pergunta, tipo_resposta
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [empresaId, usuarioId, contadorId, origem, pergunta, tipoResposta]
    );
}

function respostaCard({ tipo, titulo, texto, cards = [], dados = null }) {
    return { tipo, titulo, texto, cards, dados, sugestoes: sugestoes() };
}

function sugestoes() {
    return [
        'Quanto vendi hoje?',
        'Qual produto mais vendeu?',
        'Qual produto mais lucrativo?',
        'Quais produtos estao com estoque baixo?',
        'Quanto tenho de contas vencidas?',
        'Qual meu ticket medio?'
    ];
}

function detectarPeriodo(pergunta) {
    return normalizar(pergunta).includes('mes') ? 'mes' : 'hoje';
}

function incluiAlgum(texto, termos) {
    return termos.some((termo) => texto.includes(normalizar(termo)));
}

function card(label, value) {
    return { label, value };
}

function moeda(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function percent(value) {
    return `${Number(value || 0).toFixed(1)}%`;
}

function normalizar(value) {
    return limpar(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function limpar(value) {
    return String(value || '').trim();
}

function erro(message, status) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

module.exports = {
    perguntar,
    responderPorRegra,
    sugestoes
};
