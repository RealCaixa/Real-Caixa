const SESSION_KEY = 'realcaixa_cloud_session';

const modules = {
    dashboard: {
        path: '/dashboard',
        label: 'Dashboard',
        icon: 'D',
        section: 'Visao Geral',
        title: 'Dashboard',
        description: 'Visao executiva da operacao, vendas, estoque e licenca.',
        type: 'dashboard'
    },
    produtos: {
        path: '/produtos',
        label: 'Produtos',
        icon: 'P',
        section: 'Gestao',
        title: 'Produtos',
        description: 'Cadastre e organize o catalogo comercial da empresa.',
        type: 'produtos',
        columns: ['Produto', 'Categoria', 'Status']
    },
    categorias: {
        path: '/categorias',
        label: 'Categorias',
        icon: 'C',
        section: 'Gestao',
        title: 'Categorias',
        description: 'Organizacao comercial para produtos, relatorios e leitura de desempenho.',
        type: 'categorias',
        columns: ['Categoria', 'Produtos', 'Status']
    },
    estoque: {
        path: '/estoque',
        label: 'Estoque',
        icon: 'E',
        section: 'Gestao',
        title: 'Estoque',
        description: 'Controle saldos, estoque minimo, entradas, perdas e inventario.',
        type: 'estoque',
        columns: ['Item', 'Saldo', 'Situacao']
    },
    estoqueEntrada: {
        path: '/estoque/entrada',
        label: 'Entrada de Mercadorias',
        icon: 'EN',
        title: 'Entrada de Mercadorias',
        description: 'Registre compras e reposicoes de estoque.',
        type: 'estoqueMovimento',
        movimento: 'entrada',
        hidden: true
    },
    estoqueAjuste: {
        path: '/estoque/ajuste',
        label: 'Ajuste de Estoque',
        icon: 'AJ',
        title: 'Ajuste de Estoque',
        description: 'Corrija saldos e justifique divergencias.',
        type: 'estoqueMovimento',
        movimento: 'ajuste',
        hidden: true
    },
    estoquePerdas: {
        path: '/estoque/perdas',
        label: 'Perdas e Quebras',
        icon: 'PQ',
        title: 'Perdas e Quebras',
        description: 'Registre perdas, quebras e descartes.',
        type: 'estoqueMovimento',
        movimento: 'perda',
        hidden: true
    },
    estoqueInventario: {
        path: '/estoque/inventario',
        label: 'Inventario',
        icon: 'IN',
        title: 'Inventario',
        description: 'Informe contagem fisica e gere ajuste automatico.',
        type: 'estoqueMovimento',
        movimento: 'inventario',
        hidden: true
    },
    estoqueMovimentacoes: {
        path: '/estoque/movimentacoes',
        label: 'Historico de Estoque',
        icon: 'HM',
        title: 'Historico de Movimentacoes',
        description: 'Consulte entradas, saidas, ajustes, perdas e inventarios.',
        type: 'estoqueHistorico',
        hidden: true
    },
    financeiro: {
        path: '/financeiro',
        label: 'Financeiro',
        icon: '$',
        section: 'Gestao',
        title: 'Financeiro',
        description: 'Acompanhe contas, lancamentos, saldo e indicadores financeiros.',
        type: 'financeiro',
        columns: ['Movimento', 'Valor', 'Status']
    },
    financeiroCategorias: {
        path: '/financeiro/categorias',
        label: 'Categorias Financeiras',
        icon: 'FC',
        title: 'Categorias Financeiras',
        description: 'Classifique receitas e despesas para leitura gerencial.',
        type: 'financeiroCategorias',
        hidden: true
    },
    financeiroLancamentos: {
        path: '/financeiro/lancamentos',
        label: 'Lancamentos Financeiros',
        icon: 'FL',
        title: 'Lancamentos Financeiros',
        description: 'Registre entradas, saidas e transferencias internas.',
        type: 'financeiroLancamentos',
        hidden: true
    },
    relatorios: {
        path: '/relatorios',
        label: 'Relatorios',
        icon: 'R',
        section: 'Gestao',
        title: 'Relatorios',
        description: 'Central de indicadores para vendas, estoque, operadores e resultados.',
        type: 'placeholder',
        columns: ['Relatorio', 'Periodo', 'Status']
    },
    assistente: {
        path: '/assistente',
        label: 'Assistente IA',
        icon: 'IA',
        section: 'Gestao',
        title: 'Assistente Empresarial',
        description: 'Consultas inteligentes simuladas sobre vendas, estoque e financeiro.',
        type: 'assistente'
    },
    pdvs: {
        path: '/pdvs',
        label: 'PDVs',
        icon: 'V',
        section: 'Operacao',
        title: 'PDVs',
        description: 'Acompanhe pontos de venda, dispositivos e futuras atualizacoes do desktop.',
        type: 'pdvs',
        columns: ['PDV', 'Ultima conexao', 'Status']
    },
    sincronizacao: {
        path: '/sincronizacao',
        label: 'Sincronizacao',
        icon: 'S',
        section: 'Operacao',
        title: 'Sincronizacao',
        description: 'Monitore o fluxo entre Portal Cloud e PDV offline.',
        type: 'sincronizacao',
        columns: ['Fluxo', 'Direcao', 'Status']
    },
    filiais: {
        path: '/filiais',
        label: 'Filiais',
        icon: 'F',
        section: 'Operacao',
        title: 'Filiais',
        description: 'Estrutura para multiplas lojas, pontos de venda e unidades operacionais.',
        type: 'filiais',
        columns: ['Filial', 'Cidade', 'Status']
    },
    usuarios: {
        path: '/usuarios',
        label: 'Usuarios',
        icon: 'U',
        section: 'Administracao',
        title: 'Usuarios',
        description: 'Base para gerir operadores, gerentes, administradores e permissoes.',
        type: 'placeholder',
        columns: ['Usuario', 'Perfil', 'Status']
    },
    permissoes: {
        path: '/permissoes',
        label: 'Permissoes',
        icon: 'P',
        section: 'Administracao',
        title: 'Permissoes',
        description: 'Organize perfis, acessos e responsabilidades de cada usuario.',
        type: 'placeholder',
        columns: ['Perfil', 'Acesso', 'Status']
    },
    licenca: {
        path: '/licenca',
        label: 'Licenca',
        icon: 'L',
        section: 'Administracao',
        title: 'Licenca',
        description: 'Consulte plano contratado, limites e situacao da assinatura.',
        type: 'placeholder',
        columns: ['Plano', 'Limite', 'Status']
    },
    configuracoes: {
        path: '/configuracoes',
        label: 'Configuracoes',
        icon: 'A',
        section: 'Administracao',
        title: 'Configuracoes',
        description: 'Dados empresariais, preferencias, licenca e parametros do portal.',
        type: 'placeholder',
        columns: ['Configuracao', 'Valor', 'Status']
    }
};

function currentModuleKey() {
    const path = window.location.pathname.replace(/\/$/, '') || '/dashboard';
    return Object.keys(modules).find((key) => modules[key].path === path) || 'dashboard';
}

function getStoredSession() {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
}

function saveSession(session) {
    if (localStorage.getItem(SESSION_KEY)) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('cadastroPendente');
}

function getToken() {
    return getStoredSession()?.token;
}

function authHeaders() {
    return { Authorization: `Bearer ${getToken()}` };
}

async function requestJson(url) {
    const response = await fetch(url, { headers: authHeaders() });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(body.erro || 'Nao foi possivel carregar os dados.');
        error.status = response.status;
        throw error;
    }
    return body;
}

async function sendJson(url, method, payload) {
    const response = await fetch(url, {
        method,
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(body.erro || 'Nao foi possivel salvar os dados.');
        error.status = response.status;
        throw error;
    }
    return body;
}

function renderNavigation(activeKey) {
    const nav = document.getElementById('navList');
    const visible = Object.entries(modules).filter(([, item]) => !item.hidden);
    const sections = [...new Set(visible.map(([, item]) => item.section || 'Portal'))];

    nav.innerHTML = sections.map((section) => `
        <div class="nav-section">
            <div class="nav-section-title">${section}</div>
            ${visible.filter(([, item]) => (item.section || 'Portal') === section).map(([key, item]) => `
                <a class="nav-link ${isActiveNav(key, activeKey) ? 'active' : ''}" href="${item.path}">
                    <span class="nav-icon">${item.icon}</span>
                    <span>${item.label}</span>
                </a>
            `).join('')}
        </div>
    `).join('');
}

function isActiveNav(key, activeKey) {
    return key === activeKey
        || (activeKey.startsWith('estoque') && key === 'estoque')
        || (activeKey.startsWith('financeiro') && key === 'financeiro');
}

function renderHeader(module, session) {
    document.title = `${module.title} - Real Caixa`;
    document.getElementById('breadcrumb').textContent = `${module.section || 'Portal'} / ${module.label}`;
    document.getElementById('pageTitle').textContent = module.title;
    document.getElementById('pageDescription').textContent = module.description;
    document.getElementById('userEmail').textContent = session.usuario.email;
}

function renderCompany(session) {
    document.getElementById('companyName').textContent = session.empresa.nome || 'Nao informado';
    document.getElementById('companyDocument').textContent = session.empresa.documento || 'Nao informado';
    document.getElementById('companyPlan').textContent = session.licenca.plano || 'basico';
    document.getElementById('companyLicense').textContent = session.licenca.status || 'ativa';
}

function renderDashboard(data) {
    const indicadores = data.indicadores || {};
    const metrics = [
        ['Vendas do dia', formatCurrency(indicadores.vendas_dia || indicadores.vendas_hoje || 0), 'Operacao de hoje', 'money'],
        ['Vendas do mes', formatCurrency(indicadores.vendas_mes || 0), 'Consolidado mensal', 'money'],
        ['Ticket medio', formatCurrency(indicadores.ticket_medio || 0), 'Media por venda', 'neutral'],
        ['Produtos cadastrados', indicadores.produtos_cadastrados ?? indicadores.produtos ?? 0, 'Catalogo ativo', 'neutral'],
        ['Estoque baixo', indicadores.estoque_baixo || 0, 'Reposicao recomendada', 'warning'],
        ['Contas a pagar', formatCurrency(indicadores.contas_pagar || 0), 'Pendencias financeiras', 'warning'],
        ['Contas a receber', formatCurrency(indicadores.contas_receber || 0), 'Recebiveis previstos', 'money'],
        ['Status da licenca', data.licenca?.status || 'ativa', `Plano ${data.licenca?.plano || 'basico'}`, 'license'],
        ['Filiais', indicadores.total_filiais || 0, 'Lojas ativas', 'neutral'],
        ['PDVs ativos', indicadores.pdvs_ativos || 0, 'Terminais cadastrados', 'money'],
        ['PDVs offline', indicadores.pdvs_offline || 0, 'Precisam de atencao', 'warning'],
        ['Ultima sincronizacao', indicadores.ultima_sincronizacao || 'Sem sync', 'PDVs conectados', 'license']
    ];

    document.getElementById('pageBody').innerHTML = `
        <section class="metric-grid">
            ${metrics.map(([label, value, caption, tone]) => `
                <article class="metric-card ${tone}">
                    <div class="metric-label"><span>${label}</span></div>
                    <div class="metric-value">${value}</div>
                    <div class="metric-caption">${caption}</div>
                </article>
            `).join('')}
        </section>
        <section class="work-grid">
            <article class="panel">
                <h2>Modulos da gestao</h2>
                <div class="module-list">
                    ${Object.entries(modules).filter(([, item]) => !item.hidden && item.type !== 'dashboard').map(([, item]) => `
                        <a class="module-row" href="${item.path}">
                            <span>
                                <strong>${item.label}</strong>
                                <span>${item.description}</span>
                            </span>
                            <span class="tag">${item.section || 'Portal'}</span>
                        </a>
                    `).join('')}
                </div>
            </article>
            <article class="panel">
                <h2>Operacao cloud</h2>
                <div class="module-list">
                    <div class="module-row"><span><strong>Portal -> PDV</strong><span>Produtos, categorias, usuarios e configuracoes</span></span><span class="tag success">Ativo</span></div>
                    <div class="module-row"><span><strong>PDV -> Portal</strong><span>Vendas, caixa e estoque operacional</span></span><span class="tag success">Ativo</span></div>
                    <div class="module-row"><span><strong>Licenca</strong><span>${data.licenca?.status || 'ativa'} no plano ${data.licenca?.plano || 'basico'}</span></span><span class="tag">Cloud</span></div>
                </div>
            </article>
        </section>
    `;
}

async function renderEstoque() {
    const [estoque, indicadores] = await Promise.all([
        requestJson('/api/estoque?limite=100'),
        requestJson('/api/estoque/indicadores')
    ]);
    const cards = indicadores.indicadores;
    const rows = estoque.dados || [];

    document.getElementById('pageBody').innerHTML = `
        <section class="metric-grid">
            <article class="metric-card"><div class="metric-label">Produtos sem estoque</div><div class="metric-value">${cards.produtos_sem_estoque}</div><div class="metric-caption">Saldo zerado</div></article>
            <article class="metric-card"><div class="metric-label">Abaixo do minimo</div><div class="metric-value">${cards.produtos_abaixo_minimo}</div><div class="metric-caption">Precisam de reposicao</div></article>
            <article class="metric-card"><div class="metric-label">Produtos criticos</div><div class="metric-value">${cards.produtos_criticos}</div><div class="metric-caption">Ate 50% do minimo</div></article>
            <article class="metric-card"><div class="metric-label">Itens cadastrados</div><div class="metric-value">${cards.total_itens_cadastrados}</div><div class="metric-caption">Produtos ativos</div></article>
        </section>
        <section class="panel">
            <div class="list-header">
                <h2>Posicao de estoque</h2>
                <div class="row-actions">
                    <a class="primary-button link-button" href="/estoque/entrada">Entrada</a>
                    <a class="secondary-button link-button" href="/estoque/ajuste">Ajuste</a>
                    <a class="secondary-button link-button" href="/estoque/perdas">Perdas</a>
                    <a class="secondary-button link-button" href="/estoque/inventario">Inventario</a>
                    <a class="secondary-button link-button" href="/estoque/movimentacoes">Historico</a>
                </div>
            </div>
            <div class="data-table">
                <div class="data-row stock-row data-head"><span>Produto</span><span>Atual</span><span>Minimo</span><span>Status</span><span>Ultima movimentacao</span></div>
                ${rows.map((item) => `
                    <div class="data-row stock-row">
                        <span><strong>${escapeHtml(item.descricao)}</strong><small>${escapeHtml(item.codigo_interno)}</small></span>
                        <span>${item.estoque_atual} ${escapeHtml(item.unidade)}</span>
                        <span>${item.estoque_minimo} ${escapeHtml(item.unidade)}</span>
                        <span><b class="stock-status ${statusClass(item.status_estoque)}">${item.status_estoque}</b></span>
                        <span>${item.ultima_movimentacao || 'Sem movimentacao'}</span>
                    </div>
                `).join('') || '<div class="empty-state">Nenhum produto ativo encontrado.</div>'}
            </div>
        </section>
    `;
}

async function renderEstoqueMovimento(module) {
    const produtos = await requestJson('/api/produtos?limite=100');
    const options = (produtos.dados || []).map((item) => `<option value="${item.id}">${escapeHtml(item.descricao)} (${item.estoque_atual} ${escapeHtml(item.unidade)})</option>`).join('');
    const movimento = module.movimento;
    const quantidadeLabel = movimento === 'ajuste' ? 'Estoque corrigido' : movimento === 'inventario' ? 'Contagem fisica' : 'Quantidade';
    const custoField = movimento === 'entrada' ? '<label>Custo unitario<input id="estoqueCusto" type="number" min="0" step="0.01" value="0"></label>' : '';

    document.getElementById('pageBody').innerHTML = `
        <section class="crud-layout">
            <article class="panel">
                <h2>${module.title}</h2>
                <form id="estoqueMovForm" class="form-grid">
                    <label>Produto<select id="estoqueProduto" required><option value="">Selecione</option>${options}</select></label>
                    <label>${quantidadeLabel}<input id="estoqueQuantidade" type="number" min="0" step="0.01" required></label>
                    ${custoField}
                    <label>Observacao<input id="estoqueObservacao" placeholder="Justificativa ou referencia"></label>
                    <div class="form-actions">
                        <button class="primary-button" type="submit">Registrar</button>
                        <a class="secondary-button link-button" href="/estoque">Voltar</a>
                    </div>
                </form>
                <div class="feedback-box" id="estoqueFeedback"></div>
            </article>
            <article class="panel">
                <h2>Orientacao</h2>
                <p class="page-description">${estoqueAjuda(movimento)}</p>
            </article>
        </section>
    `;
    document.getElementById('estoqueMovForm').addEventListener('submit', (event) => salvarMovimentoEstoque(event, movimento));
}

async function salvarMovimentoEstoque(event, movimento) {
    event.preventDefault();
    const quantidade = document.getElementById('estoqueQuantidade').value;
    const payload = {
        produto_id: document.getElementById('estoqueProduto').value,
        observacao: document.getElementById('estoqueObservacao').value
    };
    if (movimento === 'ajuste') payload.estoque_corrigido = quantidade;
    else if (movimento === 'inventario') payload.contagem_fisica = quantidade;
    else payload.quantidade = quantidade;
    if (movimento === 'entrada') payload.custo_unitario = document.getElementById('estoqueCusto').value;

    const endpoint = movimento === 'perda' ? '/api/estoque/perda' : `/api/estoque/${movimento}`;
    try {
        await sendJson(endpoint, 'POST', payload);
        showFeedback('estoqueFeedback', 'Movimentacao registrada com sucesso.', 'success');
        document.getElementById('estoqueMovForm').reset();
    } catch (error) {
        showFeedback('estoqueFeedback', error.message, 'error');
    }
}

async function renderEstoqueHistorico() {
    const produtos = await requestJson('/api/produtos?limite=100');
    const options = (produtos.dados || []).map((item) => `<option value="${item.id}">${escapeHtml(item.descricao)}</option>`).join('');
    document.getElementById('pageBody').innerHTML = `
        <section class="panel">
            <div class="list-header history-filter">
                <h2>Filtros</h2>
                <select id="histProduto"><option value="">Todos os produtos</option>${options}</select>
                <select id="histTipo"><option value="">Todos os tipos</option><option value="entrada">Entrada</option><option value="saida">Saida</option><option value="ajuste">Ajuste</option><option value="perda">Perda</option><option value="inventario">Inventario</option></select>
                <input id="histInicio" type="date">
                <input id="histFim" type="date">
                <button class="primary-button" type="button" id="histBuscar">Filtrar</button>
            </div>
            <div class="data-table" id="histTabela"></div>
        </section>
    `;
    document.getElementById('histBuscar').addEventListener('click', carregarHistoricoEstoque);
    await carregarHistoricoEstoque();
}

async function carregarHistoricoEstoque() {
    const params = new URLSearchParams();
    ['Produto', 'Tipo', 'Inicio', 'Fim'].forEach((name) => {
        const value = document.getElementById(`hist${name}`)?.value;
        const map = { Produto: 'produto_id', Tipo: 'tipo', Inicio: 'data_inicio', Fim: 'data_fim' };
        if (value) params.set(map[name], value);
    });
    const data = await requestJson(`/api/estoque/movimentacoes?${params.toString()}`);
    const rows = data.dados || [];
    document.getElementById('histTabela').innerHTML = `
        <div class="data-row movement-row data-head"><span>Data</span><span>Produto</span><span>Tipo</span><span>Quantidade</span><span>Observacao</span></div>
        ${rows.map((item) => `
            <div class="data-row movement-row">
                <span>${item.created_at}</span>
                <span>${escapeHtml(item.produto_descricao)}</span>
                <span>${escapeHtml(item.tipo)}</span>
                <span>${item.quantidade}</span>
                <span>${escapeHtml(item.observacao || '')}</span>
            </div>
        `).join('') || '<div class="empty-state">Nenhuma movimentacao encontrada.</div>'}
    `;
}

function estoqueAjuda(movimento) {
    const textos = {
        entrada: 'Use para compras e reposicoes. O saldo aumenta e o custo do produto pode ser atualizado.',
        ajuste: 'Use para corrigir o saldo atual com uma justificativa administrativa.',
        perda: 'Use para quebras, validade vencida, descarte ou perda operacional.',
        inventario: 'Use apos contagem fisica. O sistema calcula a diferenca e ajusta o saldo.'
    };
    return textos[movimento] || '';
}

function statusClass(status) {
    return String(status || '').toLowerCase().replace(/\s+/g, '-').replace('critico', 'critico');
}

async function renderFinanceiro() {
    const data = await requestJson('/api/financeiro/dashboard');
    const i = data.indicadores;
    document.getElementById('pageBody').innerHTML = `
        <section class="metric-grid">
            <article class="metric-card"><div class="metric-label">Faturamento do mes</div><div class="metric-value">${formatCurrency(i.faturamento_mes)}</div><div class="metric-caption">Receitas confirmadas e lancamentos</div></article>
            <article class="metric-card"><div class="metric-label">Despesas do mes</div><div class="metric-value">${formatCurrency(i.despesas_mes)}</div><div class="metric-caption">Pagamentos e saidas</div></article>
            <article class="metric-card"><div class="metric-label">Lucro operacional</div><div class="metric-value">${formatCurrency(i.lucro_operacional)}</div><div class="metric-caption">Receitas menos despesas</div></article>
            <article class="metric-card"><div class="metric-label">Contas vencidas</div><div class="metric-value">${i.contas_vencidas.total}</div><div class="metric-caption">Receber: ${i.contas_vencidas.receber} | Pagar: ${i.contas_vencidas.pagar}</div></article>
            <article class="metric-card"><div class="metric-label">Contas a vencer</div><div class="metric-value">${formatCurrency(i.contas_a_vencer.total)}</div><div class="metric-caption">Receber ${formatCurrency(i.contas_a_vencer.receber)} / pagar ${formatCurrency(i.contas_a_vencer.pagar)}</div></article>
            <article class="metric-card"><div class="metric-label">Saldo atual</div><div class="metric-value">${formatCurrency(i.saldo_atual)}</div><div class="metric-caption">Saldo realizado</div></article>
        </section>
        <section class="work-grid">
            <article class="panel">
                <div class="list-header">
                    <h2>Fluxo de caixa</h2>
                    <div class="row-actions">
                        <a class="primary-button link-button" href="/financeiro/lancamentos">Lancamentos</a>
                        <a class="secondary-button link-button" href="/financeiro/categorias">Categorias</a>
                    </div>
                </div>
                <div class="data-table">
                    <div class="data-row"><span>Entradas</span><strong>${formatCurrency(i.entradas)}</strong><span>Periodo atual</span></div>
                    <div class="data-row"><span>Saidas</span><strong>${formatCurrency(i.saidas)}</strong><span>Periodo atual</span></div>
                    <div class="data-row"><span>Saldo projetado</span><strong>${formatCurrency(i.saldo_projetado)}</strong><span>Com contas pendentes</span></div>
                </div>
            </article>
            <article class="panel">
                <h2>Graficos financeiros</h2>
                ${renderChartList('Receitas por mes', data.graficos.receitas_por_mes)}
                ${renderChartList('Despesas por mes', data.graficos.despesas_por_mes)}
                ${renderChartList('Evolucao de caixa', data.graficos.evolucao_caixa)}
            </article>
        </section>
    `;
}

function renderChartList(title, rows) {
    return `
        <div class="chart-list">
            <strong>${title}</strong>
            ${(rows || []).map((row) => `<div><span>${row.mes}</span><b>${formatCurrency(row.valor)}</b></div>`).join('') || '<p class="page-description">Sem dados para exibir.</p>'}
        </div>
    `;
}

async function renderFinanceiroCategorias() {
    document.getElementById('pageBody').innerHTML = `
        <section class="crud-layout">
            <article class="panel">
                <h2 id="finCatTitle">Nova categoria financeira</h2>
                <form id="finCatForm" class="form-grid">
                    <input type="hidden" id="finCatId">
                    <label>Nome<input id="finCatNome" required placeholder="Ex: Vendas"></label>
                    <label>Tipo<select id="finCatTipo"><option value="receita">Receita</option><option value="despesa">Despesa</option></select></label>
                    <label class="check-row"><input type="checkbox" id="finCatAtivo" checked> Categoria ativa</label>
                    <div class="form-actions"><button class="primary-button" type="submit">Salvar</button><button class="secondary-button" type="button" onclick="resetFinCatForm()">Limpar</button></div>
                </form>
                <div class="feedback-box" id="finCatFeedback"></div>
            </article>
            <article class="panel">
                <h2>Categorias cadastradas</h2>
                <div class="data-table" id="finCatTabela"></div>
            </article>
        </section>
    `;
    document.getElementById('finCatForm').addEventListener('submit', salvarFinCategoria);
    await carregarFinCategorias();
}

async function carregarFinCategorias() {
    const data = await requestJson('/api/financeiro/categorias?incluir_inativas=1');
    document.getElementById('finCatTabela').innerHTML = `
        <div class="data-row data-head"><span>Nome</span><span>Tipo</span><span>Acoes</span></div>
        ${(data.dados || []).map((item) => `
            <div class="data-row">
                <span><strong>${escapeHtml(item.nome)}</strong><small>${item.ativo ? 'Ativa' : 'Inativa'}</small></span>
                <span>${escapeHtml(item.tipo)}</span>
                <span class="row-actions"><button onclick='editarFinCategoria(${JSON.stringify(item)})'>Editar</button><button class="danger-link" onclick="excluirFinCategoria(${item.id})">Desativar</button></span>
            </div>
        `).join('') || '<div class="empty-state">Nenhuma categoria financeira.</div>'}
    `;
}

async function salvarFinCategoria(event) {
    event.preventDefault();
    const id = document.getElementById('finCatId').value;
    const payload = {
        nome: document.getElementById('finCatNome').value,
        tipo: document.getElementById('finCatTipo').value,
        ativo: document.getElementById('finCatAtivo').checked
    };
    try {
        await sendJson(id ? `/api/financeiro/categorias/${id}` : '/api/financeiro/categorias', id ? 'PUT' : 'POST', payload);
        showFeedback('finCatFeedback', 'Categoria financeira salva.', 'success');
        resetFinCatForm();
        await carregarFinCategorias();
    } catch (error) {
        showFeedback('finCatFeedback', error.message, 'error');
    }
}

function editarFinCategoria(item) {
    document.getElementById('finCatTitle').textContent = 'Editar categoria financeira';
    document.getElementById('finCatId').value = item.id;
    document.getElementById('finCatNome').value = item.nome;
    document.getElementById('finCatTipo').value = item.tipo;
    document.getElementById('finCatAtivo').checked = Boolean(item.ativo);
}

function resetFinCatForm() {
    document.getElementById('finCatTitle').textContent = 'Nova categoria financeira';
    document.getElementById('finCatId').value = '';
    document.getElementById('finCatNome').value = '';
    document.getElementById('finCatTipo').value = 'receita';
    document.getElementById('finCatAtivo').checked = true;
}

async function excluirFinCategoria(id) {
    if (!window.confirm('Deseja desativar esta categoria financeira?')) return;
    await sendJson(`/api/financeiro/categorias/${id}`, 'DELETE', {});
    await carregarFinCategorias();
}

async function renderFinanceiroLancamentos() {
    const hoje = new Date().toISOString().slice(0, 10);
    document.getElementById('pageBody').innerHTML = `
        <section class="crud-layout">
            <article class="panel">
                <h2>Novo lancamento</h2>
                <form id="finLancForm" class="form-grid">
                    <label>Tipo<select id="finLancTipo"><option value="entrada">Entrada</option><option value="saida">Saida</option><option value="transferencia">Transferencia interna</option></select></label>
                    <label>Descricao<input id="finLancDescricao" required placeholder="Ex: Venda balcão"></label>
                    <label>Categoria<input id="finLancCategoria" placeholder="Ex: Vendas"></label>
                    <label>Valor<input id="finLancValor" type="number" min="0" step="0.01" required></label>
                    <label>Data<input id="finLancData" type="date" value="${hoje}" required></label>
                    <label>Observacao<input id="finLancObs"></label>
                    <div class="form-actions"><button class="primary-button" type="submit">Registrar</button></div>
                </form>
                <div class="feedback-box" id="finLancFeedback"></div>
            </article>
            <article class="panel">
                <h2>Ultimos lancamentos</h2>
                <div class="data-table" id="finLancTabela"></div>
            </article>
        </section>
    `;
    document.getElementById('finLancForm').addEventListener('submit', salvarFinLancamento);
    await carregarFinLancamentos();
}

async function salvarFinLancamento(event) {
    event.preventDefault();
    const payload = {
        tipo: document.getElementById('finLancTipo').value,
        descricao: document.getElementById('finLancDescricao').value,
        categoria: document.getElementById('finLancCategoria').value,
        valor: document.getElementById('finLancValor').value,
        data: document.getElementById('finLancData').value,
        observacao: document.getElementById('finLancObs').value
    };
    try {
        await sendJson('/api/financeiro/lancamentos', 'POST', payload);
        showFeedback('finLancFeedback', 'Lancamento registrado.', 'success');
        document.getElementById('finLancForm').reset();
        await carregarFinLancamentos();
    } catch (error) {
        showFeedback('finLancFeedback', error.message, 'error');
    }
}

async function carregarFinLancamentos() {
    const data = await requestJson('/api/financeiro/lancamentos?limite=50');
    document.getElementById('finLancTabela').innerHTML = `
        <div class="data-row movement-row data-head"><span>Data</span><span>Descricao</span><span>Tipo</span><span>Valor</span><span>Categoria</span></div>
        ${(data.dados || []).map((item) => `
            <div class="data-row movement-row"><span>${item.data}</span><span>${escapeHtml(item.descricao)}</span><span>${item.tipo}</span><span>${formatCurrency(item.valor)}</span><span>${escapeHtml(item.categoria || '')}</span></div>
        `).join('') || '<div class="empty-state">Nenhum lancamento financeiro.</div>'}
    `;
}

async function renderAssistente() {
    const sugestoes = [
        'Quanto vendi hoje?',
        'Qual produto mais vendeu?',
        'Qual produto mais lucrativo?',
        'Quais produtos estao com estoque baixo?',
        'Quanto tenho de contas vencidas?',
        'Qual meu ticket medio?'
    ];
    const historico = carregarHistoricoAssistente();

    document.getElementById('pageBody').innerHTML = `
        <section class="assistant-layout">
            <article class="panel assistant-chat">
                <div class="list-header">
                    <h2>Consulta empresarial</h2>
                    <button class="secondary-button" type="button" id="assistantClear">Limpar historico</button>
                </div>
                <div class="assistant-history" id="assistantHistory">
                    ${renderAssistenteHistorico(historico)}
                </div>
                <form id="assistantForm" class="assistant-form">
                    <input id="assistantQuestion" placeholder="Pergunte sobre vendas, produtos, estoque ou financeiro" autocomplete="off" required>
                    <button class="primary-button" type="submit">Perguntar</button>
                </form>
                <div class="feedback-box" id="assistantFeedback"></div>
            </article>
            <article class="panel">
                <h2>Perguntas prontas</h2>
                <div class="assistant-suggestions">
                    ${sugestoes.map((sugestao) => `<button class="secondary-button" type="button" data-question="${escapeHtml(sugestao)}">${escapeHtml(sugestao)}</button>`).join('')}
                </div>
            </article>
        </section>
    `;

    document.getElementById('assistantForm').addEventListener('submit', enviarPerguntaAssistente);
    document.getElementById('assistantClear').addEventListener('click', limparHistoricoAssistente);
    document.querySelectorAll('[data-question]').forEach((button) => {
        button.addEventListener('click', () => {
            document.getElementById('assistantQuestion').value = button.dataset.question;
            document.getElementById('assistantForm').requestSubmit();
        });
    });
}

async function enviarPerguntaAssistente(event) {
    event.preventDefault();
    const input = document.getElementById('assistantQuestion');
    const pergunta = input.value.trim();
    if (!pergunta) return;

    showFeedback('assistantFeedback', 'Consultando indicadores internos...', 'success');
    try {
        const resposta = await sendJson('/api/assistente/perguntar', 'POST', { pergunta });
        const historico = carregarHistoricoAssistente();
        historico.push({
            pergunta,
            resposta: resposta.resposta,
            created_at: new Date().toISOString()
        });
        salvarHistoricoAssistente(historico);
        document.getElementById('assistantHistory').innerHTML = renderAssistenteHistorico(historico);
        input.value = '';
        document.getElementById('assistantFeedback').style.display = 'none';
    } catch (error) {
        showFeedback('assistantFeedback', error.message, 'error');
    }
}

function renderAssistenteHistorico(historico) {
    if (!historico.length) {
        return '<div class="empty-state">Comece com uma pergunta pronta ou digite uma consulta sobre a empresa.</div>';
    }

    return historico.slice(-12).map((item) => `
        <div class="assistant-message question">
            <strong>Voce</strong>
            <p>${escapeHtml(item.pergunta)}</p>
        </div>
        <div class="assistant-message answer">
            <strong>${escapeHtml(item.resposta.titulo)}</strong>
            <p>${escapeHtml(item.resposta.texto)}</p>
            <div class="assistant-cards">
                ${(item.resposta.cards || []).map((card) => `
                    <span><b>${escapeHtml(card.value)}</b><small>${escapeHtml(card.label)}</small></span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function carregarHistoricoAssistente() {
    try {
        return JSON.parse(localStorage.getItem(assistenteHistoricoKey()) || '[]');
    } catch (_) {
        return [];
    }
}

function salvarHistoricoAssistente(historico) {
    localStorage.setItem(assistenteHistoricoKey(), JSON.stringify(historico.slice(-20)));
}

function limparHistoricoAssistente() {
    localStorage.removeItem(assistenteHistoricoKey());
    document.getElementById('assistantHistory').innerHTML = renderAssistenteHistorico([]);
}

function assistenteHistoricoKey() {
    const session = getStoredSession();
    return `realcaixa_assistente_history_${session?.empresa?.id || 'local'}`;
}

function renderPlaceholder(module, protectedInfo) {
    const columns = module.columns || ['Registro', 'Resumo', 'Status'];
    document.getElementById('pageBody').innerHTML = `
        <section class="placeholder">
            <article class="placeholder-hero">
                <h2>${module.title}</h2>
                <p>${module.description}</p>
            </article>
            <article class="panel">
                <h2>Estrutura do modulo</h2>
                <div class="table-placeholder">
                    <div class="table-line">
                        <span>${columns[0]}</span>
                        <span>${columns[1]}</span>
                        <span>${columns[2]}</span>
                    </div>
                    <div class="table-line">
                        <span>Dados serao conectados nas proximas fases</span>
                        <span>${protectedInfo.modulo}</span>
                        <span>Protegido por JWT</span>
                    </div>
                    <div class="table-line">
                        <span>Permissoes e regras de negocio</span>
                        <span>Planejado</span>
                        <span>Aguardando fase funcional</span>
                    </div>
                </div>
            </article>
        </section>
    `;
}

async function renderSincronizacao() {
    const data = await requestJson('/api/sync/auditoria');
    const pdvs = data.pdvs || [];
    const logs = data.logs || [];
    const pendentes = pdvs.reduce((total, item) => total + Number(item.eventos_pendentes || 0), 0);
    const enviados = pdvs.reduce((total, item) => total + Number(item.eventos_enviados || 0), 0);
    const comErro = pdvs.filter((item) => item.ultimo_erro_sync).length;
    const ultimoSync = pdvs.map((item) => item.ultimo_sync_sucesso || item.ultimo_sync).filter(Boolean).sort().at(-1);

    document.getElementById('pageBody').innerHTML = `
        <section class="metric-grid">
            <article class="metric-card"><div class="metric-label">PDVs monitorados</div><div class="metric-value">${pdvs.length}</div><div class="metric-caption">Terminais registrados</div></article>
            <article class="metric-card warning"><div class="metric-label">Eventos pendentes</div><div class="metric-value">${pendentes}</div><div class="metric-caption">Aguardando envio</div></article>
            <article class="metric-card"><div class="metric-label">Eventos enviados</div><div class="metric-value">${enviados}</div><div class="metric-caption">Confirmados no portal</div></article>
            <article class="metric-card ${comErro ? 'warning' : 'license'}"><div class="metric-label">Ultimo sync</div><div class="metric-value">${ultimoSync ? formatDateTime(ultimoSync) : 'Sem sync'}</div><div class="metric-caption">${comErro} PDV(s) com erro</div></article>
        </section>
        <section class="work-grid">
            <article class="panel">
                <div class="list-header">
                    <h2>Status por PDV</h2>
                </div>
                <div class="data-table">
                    <div class="data-row sync-row data-head"><span>PDV</span><span>Ultima tentativa</span><span>Status</span><span>Pendentes</span><span>Erro</span></div>
                    ${pdvs.map((item) => `
                        <div class="data-row sync-row">
                            <span><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.codigo_pdv)} - ${escapeHtml(item.filial_nome || '')}<br>Versao ${escapeHtml(item.versao_app || 'nao informada')}</small></span>
                            <span>${formatDateTime(item.ultima_tentativa_sync || item.ultimo_sync || item.ultimo_sync_sucesso)}</span>
                            <span>${syncStatusBadge(item)}</span>
                            <span>${Number(item.eventos_pendentes || 0)}<small>Enviados: ${Number(item.eventos_enviados || 0)}</small></span>
                            <span>${escapeHtml(item.ultimo_erro_sync || 'Sem erro')}</span>
                        </div>
                    `).join('') || '<div class="empty-state">Nenhum PDV registrado.</div>'}
                </div>
            </article>
            <article class="panel">
                <h2>Logs recentes</h2>
                <div class="module-list">
                    ${logs.map((log) => `
                        <div class="module-row">
                            <span>
                                <strong>${escapeHtml(log.recurso)} - ${escapeHtml(log.status)}</strong>
                                <span>${formatDateTime(log.created_at)}${log.erro ? ` - ${escapeHtml(log.erro)}` : ''}</span>
                            </span>
                            <span class="tag ${log.status === 'concluida' ? 'success' : ''}">${Number(log.total_registros || 0)}</span>
                        </div>
                    `).join('') || '<div class="empty-state">Nenhum log de sincronizacao.</div>'}
                </div>
            </article>
        </section>
    `;
}

async function renderFiliais() {
    document.getElementById('pageBody').innerHTML = `
        <section class="crud-layout">
            <article class="panel">
                <h2 id="filialFormTitle">Nova filial</h2>
                <form id="filialForm" class="form-grid">
                    <input type="hidden" id="filialId">
                    <label>Nome<input id="filialNome" required placeholder="Ex: Loja Centro"></label>
                    <label>CNPJ<input id="filialCnpj" placeholder="Opcional"></label>
                    <label>IE<input id="filialIe" placeholder="Inscricao estadual"></label>
                    <label>Endereco<input id="filialEndereco"></label>
                    <label>Numero<input id="filialNumero"></label>
                    <label>Bairro<input id="filialBairro"></label>
                    <label>Cidade<input id="filialCidade"></label>
                    <label>Estado<input id="filialEstado" maxlength="2"></label>
                    <label>CEP<input id="filialCep"></label>
                    <label>Telefone<input id="filialTelefone"></label>
                    <label class="check-row"><input type="checkbox" id="filialAtivo" checked> Filial ativa</label>
                    <div class="form-actions">
                        <button class="primary-button" type="submit">Salvar filial</button>
                        <button class="secondary-button" type="button" onclick="resetFilialForm()">Limpar</button>
                    </div>
                </form>
                <div class="feedback-box" id="filialFeedback"></div>
            </article>
            <article class="panel">
                <div class="list-header">
                    <h2>Filiais cadastradas</h2>
                    <input id="filialBusca" placeholder="Buscar filial, CNPJ ou cidade">
                </div>
                <div class="data-table" id="filiaisTabela"></div>
            </article>
        </section>
    `;

    document.getElementById('filialForm').addEventListener('submit', salvarFilial);
    document.getElementById('filialBusca').addEventListener('input', debounce(carregarFiliais, 250));
    await carregarFiliais();
}

async function carregarFiliais() {
    const busca = encodeURIComponent(document.getElementById('filialBusca')?.value || '');
    const data = await requestJson(`/api/filiais?busca=${busca}&incluir_inativas=1`);
    document.getElementById('filiaisTabela').innerHTML = `
        <div class="data-row data-head">
            <span>Filial</span><span>Status</span><span>Acoes</span>
        </div>
        ${(data.dados || []).map((item) => `
            <div class="data-row">
                <span><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml([item.cidade, item.estado].filter(Boolean).join(' / ') || item.cnpj || 'Sem endereco')}</small></span>
                <span>${item.ativo ? '<b class="status-badge">Ativa</b>' : '<b class="status-badge muted">Inativa</b>'}</span>
                <span class="row-actions">
                    <button type="button" onclick='editarFilial(${JSON.stringify(item)})'>Editar</button>
                    <button type="button" class="danger-link" onclick="excluirFilial(${item.id})">Desativar</button>
                </span>
            </div>
        `).join('') || '<div class="empty-state">Nenhuma filial cadastrada.</div>'}
    `;
}

async function salvarFilial(event) {
    event.preventDefault();
    const id = document.getElementById('filialId').value;
    const payload = filialPayload();
    try {
        await sendJson(id ? `/api/filiais/${id}` : '/api/filiais', id ? 'PUT' : 'POST', payload);
        showFeedback('filialFeedback', 'Filial salva com sucesso.', 'success');
        resetFilialForm();
        await carregarFiliais();
    } catch (error) {
        showFeedback('filialFeedback', error.message, 'error');
    }
}

function filialPayload() {
    return {
        nome: document.getElementById('filialNome').value,
        cnpj: document.getElementById('filialCnpj').value,
        ie: document.getElementById('filialIe').value,
        endereco: document.getElementById('filialEndereco').value,
        numero: document.getElementById('filialNumero').value,
        bairro: document.getElementById('filialBairro').value,
        cidade: document.getElementById('filialCidade').value,
        estado: document.getElementById('filialEstado').value,
        cep: document.getElementById('filialCep').value,
        telefone: document.getElementById('filialTelefone').value,
        ativo: document.getElementById('filialAtivo').checked
    };
}

function editarFilial(item) {
    document.getElementById('filialFormTitle').textContent = 'Editar filial';
    document.getElementById('filialId').value = item.id;
    document.getElementById('filialNome').value = item.nome || '';
    document.getElementById('filialCnpj').value = item.cnpj || '';
    document.getElementById('filialIe').value = item.ie || '';
    document.getElementById('filialEndereco').value = item.endereco || '';
    document.getElementById('filialNumero').value = item.numero || '';
    document.getElementById('filialBairro').value = item.bairro || '';
    document.getElementById('filialCidade').value = item.cidade || '';
    document.getElementById('filialEstado').value = item.estado || '';
    document.getElementById('filialCep').value = item.cep || '';
    document.getElementById('filialTelefone').value = item.telefone || '';
    document.getElementById('filialAtivo').checked = Boolean(item.ativo);
}

function resetFilialForm() {
    document.getElementById('filialFormTitle').textContent = 'Nova filial';
    document.getElementById('filialForm').reset();
    document.getElementById('filialId').value = '';
    document.getElementById('filialAtivo').checked = true;
}

async function excluirFilial(id) {
    if (!window.confirm('Deseja desativar esta filial?')) return;
    try {
        await sendJson(`/api/filiais/${id}`, 'DELETE', {});
        showFeedback('filialFeedback', 'Filial desativada com sucesso.', 'success');
        await carregarFiliais();
    } catch (error) {
        showFeedback('filialFeedback', error.message, 'error');
    }
}

async function renderPdvs() {
    const filiais = await requestJson('/api/filiais');
    const options = (filiais.dados || []).map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}</option>`).join('');
    document.getElementById('pageBody').innerHTML = `
        <section class="crud-layout">
            <article class="panel">
                <h2 id="pdvFormTitle">Novo PDV</h2>
                <form id="pdvForm" class="form-grid">
                    <input type="hidden" id="pdvId">
                    <label>Filial<select id="pdvFilial" required><option value="">Selecione</option>${options}</select></label>
                    <label>Nome<input id="pdvNome" required placeholder="Ex: Caixa 01"></label>
                    <label>Codigo PDV<input id="pdvCodigo" required placeholder="Ex: PDV-01"></label>
                    <label>Status<select id="pdvStatus"><option value="offline">Offline</option><option value="online">Online</option><option value="sincronizando">Sincronizando</option><option value="erro">Erro</option><option value="bloqueado">Bloqueado</option></select></label>
                    <label>Ultimo sync<input id="pdvUltimoSync" type="datetime-local"></label>
                    <label>Versao app<input id="pdvVersao" placeholder="Ex: 2.1.0"></label>
                    <label class="check-row"><input type="checkbox" id="pdvAtivo" checked> PDV ativo</label>
                    <div class="form-actions">
                        <button class="primary-button" type="submit">Salvar PDV</button>
                        <button class="secondary-button" type="button" onclick="resetPdvForm()">Limpar</button>
                    </div>
                </form>
                <div class="feedback-box" id="pdvFeedback"></div>
            </article>
            <article class="panel">
                <div class="list-header">
                    <h2>PDVs cadastrados</h2>
                    <input id="pdvBusca" placeholder="Buscar por PDV, codigo ou filial">
                </div>
                <div class="data-table" id="pdvsTabela"></div>
            </article>
        </section>
    `;

    document.getElementById('pdvForm').addEventListener('submit', salvarPdv);
    document.getElementById('pdvBusca').addEventListener('input', debounce(carregarPdvs, 250));
    await carregarPdvs();
}

async function carregarPdvs() {
    const busca = encodeURIComponent(document.getElementById('pdvBusca')?.value || '');
    const data = await requestJson(`/api/pdvs?busca=${busca}&incluir_inativos=1`);
    document.getElementById('pdvsTabela').innerHTML = `
        <div class="data-row pdv-row data-head">
            <span>PDV</span><span>Conexao</span><span>Licenca</span><span>Dispositivo</span><span>Acoes</span>
        </div>
        ${(data.dados || []).map((item) => `
            <div class="data-row pdv-row">
                <span><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.codigo_pdv)} - ${escapeHtml(item.filial_nome || '')}</small></span>
                <span>${pdvStatusBadge(item)}<small>${escapeHtml(item.ultimo_sync || item.ultimo_acesso || 'Sem conexao')}</small></span>
                <span>${pdvLicenseBadge(item)}<small>${escapeHtml(item.registrado_at || 'Aguardando ativacao')}</small></span>
                <span>${escapeHtml(item.dispositivo_nome || item.machine_id || 'Nao informado')}<small>Versao ${escapeHtml(item.versao_app || 'nao informada')}</small></span>
                <span class="row-actions">
                    <button type="button" onclick='editarPdv(${JSON.stringify(item)})'>Editar</button>
                    <button type="button" class="danger-link" onclick="excluirPdv(${item.id})">Desativar</button>
                </span>
            </div>
        `).join('') || '<div class="empty-state">Nenhum PDV cadastrado.</div>'}
    `;
}

async function salvarPdv(event) {
    event.preventDefault();
    const id = document.getElementById('pdvId').value;
    const payload = pdvPayload();
    try {
        await sendJson(id ? `/api/pdvs/${id}` : '/api/pdvs', id ? 'PUT' : 'POST', payload);
        showFeedback('pdvFeedback', 'PDV salvo com sucesso.', 'success');
        resetPdvForm();
        await carregarPdvs();
    } catch (error) {
        showFeedback('pdvFeedback', error.message, 'error');
    }
}

function pdvPayload() {
    return {
        filial_id: document.getElementById('pdvFilial').value,
        nome: document.getElementById('pdvNome').value,
        codigo_pdv: document.getElementById('pdvCodigo').value,
        status: document.getElementById('pdvStatus').value,
        ultimo_sync: normalizarDatetimeLocal(document.getElementById('pdvUltimoSync').value),
        versao_app: document.getElementById('pdvVersao').value,
        ativo: document.getElementById('pdvAtivo').checked
    };
}

function editarPdv(item) {
    document.getElementById('pdvFormTitle').textContent = 'Editar PDV';
    document.getElementById('pdvId').value = item.id;
    document.getElementById('pdvFilial').value = item.filial_id;
    document.getElementById('pdvNome').value = item.nome || '';
    document.getElementById('pdvCodigo').value = item.codigo_pdv || '';
    document.getElementById('pdvStatus').value = item.status || 'offline';
    document.getElementById('pdvUltimoSync').value = item.ultimo_sync ? item.ultimo_sync.slice(0, 16) : '';
    document.getElementById('pdvVersao').value = item.versao_app || '';
    document.getElementById('pdvAtivo').checked = Boolean(item.ativo);
}

function resetPdvForm() {
    document.getElementById('pdvFormTitle').textContent = 'Novo PDV';
    document.getElementById('pdvForm').reset();
    document.getElementById('pdvId').value = '';
    document.getElementById('pdvAtivo').checked = true;
}

async function excluirPdv(id) {
    if (!window.confirm('Deseja desativar este PDV?')) return;
    try {
        await sendJson(`/api/pdvs/${id}`, 'DELETE', {});
        showFeedback('pdvFeedback', 'PDV desativado com sucesso.', 'success');
        await carregarPdvs();
    } catch (error) {
        showFeedback('pdvFeedback', error.message, 'error');
    }
}

function pdvStatusBadge(item) {
    const status = item.ativo ? item.status : 'inativo';
    const classe = status === 'online' ? '' : status === 'offline' || status === 'inativo' ? 'muted' : 'warning';
    return `<b class="status-badge ${classe}">${escapeHtml(statusLabel(status))}</b>`;
}

function pdvLicenseBadge(item) {
    const status = item.ativo ? (item.licenciamento_status || 'aguardando_ativacao') : 'bloqueado';
    const classe = status === 'ativo' ? '' : status === 'aguardando_ativacao' ? 'warning' : 'danger';
    return `<b class="status-badge ${classe}">${escapeHtml(statusLabel(status))}</b>`;
}

function statusLabel(status) {
    const labels = {
        online: 'Ativo',
        offline: 'Offline',
        sincronizando: 'Sincronizando',
        erro: 'Erro',
        bloqueado: 'Bloqueado',
        inativo: 'Inativo',
        ativo: 'Ativo',
        expirado: 'Expirado',
        aguardando_ativacao: 'Aguardando ativacao'
    };
    return labels[status] || status || 'Indefinido';
}

function normalizarDatetimeLocal(value) {
    return value ? new Date(value).toISOString() : null;
}

async function renderCategorias() {
    document.getElementById('pageBody').innerHTML = `
        <section class="crud-layout">
            <article class="panel">
                <h2 id="categoriaFormTitle">Nova categoria</h2>
                <form id="categoriaForm" class="form-grid">
                    <input type="hidden" id="categoriaId">
                    <label>
                        Nome
                        <input id="categoriaNome" required placeholder="Ex: Sorvetes">
                    </label>
                    <label class="check-row">
                        <input type="checkbox" id="categoriaAtivo" checked>
                        Categoria ativa
                    </label>
                    <div class="form-actions">
                        <button class="primary-button" type="submit">Salvar categoria</button>
                        <button class="secondary-button" type="button" onclick="resetCategoriaForm()">Limpar</button>
                    </div>
                </form>
                <div class="feedback-box" id="categoriaFeedback"></div>
            </article>

            <article class="panel">
                <div class="list-header">
                    <h2>Categorias cadastradas</h2>
                    <input id="categoriaBusca" placeholder="Buscar categoria">
                </div>
                <div class="data-table" id="categoriasTabela"></div>
            </article>
        </section>
    `;

    document.getElementById('categoriaForm').addEventListener('submit', salvarCategoria);
    document.getElementById('categoriaBusca').addEventListener('input', debounce(carregarCategorias, 250));
    await carregarCategorias();
}

async function carregarCategorias() {
    const busca = encodeURIComponent(document.getElementById('categoriaBusca')?.value || '');
    const data = await requestJson(`/api/categorias?busca=${busca}&incluir_inativas=1&limite=100`);
    const rows = data.dados || [];
    document.getElementById('categoriasTabela').innerHTML = `
        <div class="data-row data-head">
            <span>Nome</span><span>Status</span><span>Acoes</span>
        </div>
        ${rows.map((item) => `
            <div class="data-row">
                <span><strong>${escapeHtml(item.nome)}</strong></span>
                <span>${item.ativo ? '<b class="status-badge">Ativa</b>' : '<b class="status-badge muted">Inativa</b>'}</span>
                <span class="row-actions">
                    <button type="button" onclick='editarCategoria(${JSON.stringify(item)})'>Editar</button>
                    <button type="button" class="danger-link" onclick="excluirCategoria(${item.id})">Excluir</button>
                </span>
            </div>
        `).join('') || '<div class="empty-state">Nenhuma categoria encontrada.</div>'}
    `;
}

async function salvarCategoria(event) {
    event.preventDefault();
    const id = document.getElementById('categoriaId').value;
    const payload = {
        nome: document.getElementById('categoriaNome').value,
        ativo: document.getElementById('categoriaAtivo').checked
    };

    try {
        await sendJson(id ? `/api/categorias/${id}` : '/api/categorias', id ? 'PUT' : 'POST', payload);
        showFeedback('categoriaFeedback', 'Categoria salva com sucesso.', 'success');
        resetCategoriaForm();
        await carregarCategorias();
    } catch (error) {
        showFeedback('categoriaFeedback', error.message, 'error');
    }
}

function editarCategoria(item) {
    document.getElementById('categoriaFormTitle').textContent = 'Editar categoria';
    document.getElementById('categoriaId').value = item.id;
    document.getElementById('categoriaNome').value = item.nome;
    document.getElementById('categoriaAtivo').checked = Boolean(item.ativo);
}

function resetCategoriaForm() {
    document.getElementById('categoriaFormTitle').textContent = 'Nova categoria';
    document.getElementById('categoriaId').value = '';
    document.getElementById('categoriaNome').value = '';
    document.getElementById('categoriaAtivo').checked = true;
}

async function excluirCategoria(id) {
    if (!window.confirm('Deseja desativar esta categoria?')) return;
    try {
        await sendJson(`/api/categorias/${id}`, 'DELETE', {});
        showFeedback('categoriaFeedback', 'Categoria desativada com sucesso.', 'success');
        await carregarCategorias();
    } catch (error) {
        showFeedback('categoriaFeedback', error.message, 'error');
    }
}

async function renderProdutos() {
    const categorias = await requestJson('/api/categorias?limite=100');
    const options = (categorias.dados || []).map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}</option>`).join('');

    document.getElementById('pageBody').innerHTML = `
        <section class="crud-layout">
            <article class="panel">
                <h2 id="produtoFormTitle">Novo produto</h2>
                <form id="produtoForm" class="form-grid product-form">
                    <input type="hidden" id="produtoId">
                    <label>Descricao<input id="produtoDescricao" required placeholder="Ex: Acai 500ml"></label>
                    <label>Codigo interno<input id="produtoCodigoInterno" required placeholder="Ex: ACI500"></label>
                    <label>Codigo de barras<input id="produtoCodigoBarras" placeholder="Opcional"></label>
                    <label>Categoria<select id="produtoCategoria"><option value="">Sem categoria</option>${options}</select></label>
                    <label>Custo<input id="produtoCusto" type="number" min="0" step="0.01" value="0"></label>
                    <label>Preco venda<input id="produtoPrecoVenda" type="number" min="0" step="0.01" value="0"></label>
                    <label>Estoque atual<input id="produtoEstoqueAtual" type="number" min="0" step="0.01" value="0"></label>
                    <label>Estoque minimo<input id="produtoEstoqueMinimo" type="number" min="0" step="0.01" value="0"></label>
                    <label>Unidade<input id="produtoUnidade" value="UN" required></label>
                    <label class="check-row"><input type="checkbox" id="produtoAtivo" checked> Produto ativo</label>
                    <div class="form-actions wide">
                        <button class="primary-button" type="submit">Salvar produto</button>
                        <button class="secondary-button" type="button" onclick="resetProdutoForm()">Limpar</button>
                    </div>
                </form>
                <div class="feedback-box" id="produtoFeedback"></div>
            </article>

            <article class="panel">
                <div class="list-header">
                    <h2>Produtos cadastrados</h2>
                    <input id="produtoBusca" placeholder="Buscar por descricao, codigo ou categoria">
                </div>
                <div class="data-table products-table" id="produtosTabela"></div>
            </article>
        </section>
    `;

    document.getElementById('produtoForm').addEventListener('submit', salvarProduto);
    document.getElementById('produtoBusca').addEventListener('input', debounce(carregarProdutos, 250));
    await carregarProdutos();
}

async function carregarProdutos() {
    const busca = encodeURIComponent(document.getElementById('produtoBusca')?.value || '');
    const data = await requestJson(`/api/produtos?busca=${busca}&incluir_inativos=1&limite=100`);
    const rows = data.dados || [];
    document.getElementById('produtosTabela').innerHTML = `
        <div class="data-row data-head product-row">
            <span>Produto</span><span>Codigos</span><span>Categoria</span><span>Preco</span><span>Estoque</span><span>Acoes</span>
        </div>
        ${rows.map((item) => `
            <div class="data-row product-row">
                <span><strong>${escapeHtml(item.descricao)}</strong><small>${item.ativo ? 'Ativo' : 'Inativo'}</small></span>
                <span>${escapeHtml(item.codigo_interno)}<small>${escapeHtml(item.codigo_barras || 'Sem barras')}</small></span>
                <span>${escapeHtml(item.categoria_nome || 'Sem categoria')}</span>
                <span>${formatCurrency(item.preco_venda)}</span>
                <span>${item.estoque_atual} ${escapeHtml(item.unidade)}<small>Min. ${item.estoque_minimo}</small></span>
                <span class="row-actions">
                    <button type="button" onclick='editarProduto(${JSON.stringify(item)})'>Editar</button>
                    <button type="button" class="danger-link" onclick="excluirProduto(${item.id})">Excluir</button>
                </span>
            </div>
        `).join('') || '<div class="empty-state">Nenhum produto encontrado.</div>'}
    `;
}

async function salvarProduto(event) {
    event.preventDefault();
    const id = document.getElementById('produtoId').value;
    const payload = produtoPayload();

    try {
        await sendJson(id ? `/api/produtos/${id}` : '/api/produtos', id ? 'PUT' : 'POST', payload);
        showFeedback('produtoFeedback', 'Produto salvo com sucesso.', 'success');
        resetProdutoForm();
        await carregarProdutos();
    } catch (error) {
        showFeedback('produtoFeedback', error.message, 'error');
    }
}

function produtoPayload() {
    return {
        descricao: document.getElementById('produtoDescricao').value,
        codigo_interno: document.getElementById('produtoCodigoInterno').value,
        codigo_barras: document.getElementById('produtoCodigoBarras').value,
        categoria_id: document.getElementById('produtoCategoria').value || null,
        custo: document.getElementById('produtoCusto').value,
        preco_venda: document.getElementById('produtoPrecoVenda').value,
        estoque_atual: document.getElementById('produtoEstoqueAtual').value,
        estoque_minimo: document.getElementById('produtoEstoqueMinimo').value,
        unidade: document.getElementById('produtoUnidade').value,
        ativo: document.getElementById('produtoAtivo').checked
    };
}

function editarProduto(item) {
    document.getElementById('produtoFormTitle').textContent = 'Editar produto';
    document.getElementById('produtoId').value = item.id;
    document.getElementById('produtoDescricao').value = item.descricao;
    document.getElementById('produtoCodigoInterno').value = item.codigo_interno;
    document.getElementById('produtoCodigoBarras').value = item.codigo_barras || '';
    document.getElementById('produtoCategoria').value = item.categoria_id || '';
    document.getElementById('produtoCusto').value = item.custo;
    document.getElementById('produtoPrecoVenda').value = item.preco_venda;
    document.getElementById('produtoEstoqueAtual').value = item.estoque_atual;
    document.getElementById('produtoEstoqueMinimo').value = item.estoque_minimo;
    document.getElementById('produtoUnidade').value = item.unidade;
    document.getElementById('produtoAtivo').checked = Boolean(item.ativo);
}

function resetProdutoForm() {
    document.getElementById('produtoFormTitle').textContent = 'Novo produto';
    document.getElementById('produtoForm').reset();
    document.getElementById('produtoId').value = '';
    document.getElementById('produtoCusto').value = 0;
    document.getElementById('produtoPrecoVenda').value = 0;
    document.getElementById('produtoEstoqueAtual').value = 0;
    document.getElementById('produtoEstoqueMinimo').value = 0;
    document.getElementById('produtoUnidade').value = 'UN';
    document.getElementById('produtoAtivo').checked = true;
}

async function excluirProduto(id) {
    if (!window.confirm('Deseja desativar este produto?')) return;
    try {
        await sendJson(`/api/produtos/${id}`, 'DELETE', {});
        showFeedback('produtoFeedback', 'Produto desativado com sucesso.', 'success');
        await carregarProdutos();
    } catch (error) {
        showFeedback('produtoFeedback', error.message, 'error');
    }
}

function showFeedback(id, message, type) {
    const element = document.getElementById(id);
    element.textContent = message;
    element.className = `feedback-box ${type}`;
    element.style.display = 'block';
}

function debounce(fn, wait) {
    let timer;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(fn, wait);
    };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatDateTime(value) {
    if (!value) return 'Sem registro';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR');
}

function syncStatusBadge(item) {
    if (item.ultimo_erro_sync) {
        return '<b class="status-badge danger">Erro</b>';
    }
    if (Number(item.eventos_pendentes || 0) > 0) {
        return '<b class="status-badge warning">Pendente</b>';
    }
    if (item.ultimo_sync_sucesso || item.ultimo_sync) {
        return '<b class="status-badge">Sincronizado</b>';
    }
    return '<b class="status-badge muted">Sem sync</b>';
}

async function logout() {
    const token = getToken();
    if (token) {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: authHeaders()
        }).catch(() => {});
    }
    clearSession();
    window.location.href = '/login';
}

async function boot() {
    const moduleKey = currentModuleKey();
    const module = modules[moduleKey];
    const session = getStoredSession();

    if (!session?.token) {
        window.location.href = '/login';
        return;
    }

    renderNavigation(moduleKey);

    const me = await requestJson('/api/auth/me');
    const fullSession = { ...session, ...me };
    saveSession(fullSession);

    renderHeader(module, fullSession);
    renderCompany(fullSession);

    if (module.type === 'dashboard') {
        const dashboard = await requestJson('/api/dashboard');
        renderDashboard(dashboard);
    } else if (module.type === 'categorias') {
        await renderCategorias();
    } else if (module.type === 'produtos') {
        await renderProdutos();
    } else if (module.type === 'estoque') {
        await renderEstoque();
    } else if (module.type === 'estoqueMovimento') {
        await renderEstoqueMovimento(module);
    } else if (module.type === 'estoqueHistorico') {
        await renderEstoqueHistorico();
    } else if (module.type === 'financeiro') {
        await renderFinanceiro();
    } else if (module.type === 'financeiroCategorias') {
        await renderFinanceiroCategorias();
    } else if (module.type === 'financeiroLancamentos') {
        await renderFinanceiroLancamentos();
    } else if (module.type === 'filiais') {
        await renderFiliais();
    } else if (module.type === 'pdvs') {
        await renderPdvs();
    } else if (module.type === 'sincronizacao') {
        await renderSincronizacao();
    } else if (module.type === 'assistente') {
        await renderAssistente();
    } else {
        const info = await requestJson(`/api/modulos/${moduleKey}`);
        renderPlaceholder(module, info);
    }
}

function handleBootError(error) {
    if (error?.status === 401) {
        clearSession();
        window.location.href = '/login';
        return;
    }

    renderPortalError(error);
}

function renderPortalError(error) {
    const moduleKey = currentModuleKey();
    const module = modules[moduleKey] || modules.dashboard;
    const session = getStoredSession();

    renderNavigation(moduleKey);
    renderHeader(module, session || { usuario: { email: 'Sessao local' } });
    if (session?.empresa && session?.licenca) {
        renderCompany(session);
    }

    document.getElementById('pageBody').innerHTML = `
        <section class="panel">
            <h2>Nao foi possivel carregar este modulo</h2>
            <p class="page-description">${escapeHtml(error?.message || 'Tente novamente em instantes.')}</p>
            <div class="form-actions" style="margin-top: 16px;">
                <button class="primary-button" type="button" onclick="window.location.reload()">Recarregar</button>
                <a class="secondary-button link-button" href="/dashboard">Voltar ao dashboard</a>
            </div>
        </section>
    `;
}

document.getElementById('menuToggle').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
});

document.getElementById('logoutButton').addEventListener('click', logout);

boot().catch(handleBootError);

window.editarCategoria = editarCategoria;
window.excluirCategoria = excluirCategoria;
window.resetCategoriaForm = resetCategoriaForm;
window.editarProduto = editarProduto;
window.excluirProduto = excluirProduto;
window.resetProdutoForm = resetProdutoForm;
window.editarFilial = editarFilial;
window.excluirFilial = excluirFilial;
window.resetFilialForm = resetFilialForm;
window.editarPdv = editarPdv;
window.excluirPdv = excluirPdv;
window.resetPdvForm = resetPdvForm;
window.editarFinCategoria = editarFinCategoria;
window.excluirFinCategoria = excluirFinCategoria;
window.resetFinCatForm = resetFinCatForm;
