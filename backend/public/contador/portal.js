const SESSION_KEY = 'realcaixa_contador_session';

const state = {
    session: null,
    empresas: []
};

boot().catch((error) => {
    if (error.status === 401) {
        logout();
        return;
    }
    renderError(error.message || 'Nao foi possivel carregar o portal do contador.');
});

async function boot() {
    state.session = readSession();
    if (!state.session?.token) {
        window.location.href = '/contador/login';
        return;
    }

    document.getElementById('logoutButton').addEventListener('click', logout);
    highlightRoute();

    const me = await api('/api/contador/me');
    state.session.contador = me.contador;
    state.empresas = me.empresas || [];
    document.getElementById('contadorName').textContent = me.contador.nome;

    if (window.location.pathname.includes('/contador/fechamentos')) {
        await renderFechamentos();
    } else {
        await renderDashboard();
    }
}

async function renderDashboard() {
    document.getElementById('pageTitle').textContent = 'Dashboard contador';
    const dashboard = await api('/api/contador/dashboard');
    const empresas = dashboard.empresas || [];
    const totais = empresas.reduce((acc, empresa) => {
        acc.faturamento += Number(empresa.resumo?.faturamento_mensal || 0);
        acc.vendas += Number(empresa.resumo?.vendas || 0);
        acc.produtos += Number(empresa.resumo?.estoque?.produtos || 0);
        acc.financeiro += Number(empresa.resumo?.financeiro?.saldo || 0);
        return acc;
    }, { faturamento: 0, vendas: 0, produtos: 0, financeiro: 0 });

    document.getElementById('appContent').innerHTML = `
        <section class="metric-grid">
            ${metric('Empresas autorizadas', dashboard.total_empresas || 0)}
            ${metric('Faturamento mensal', money(totais.faturamento))}
            ${metric('Vendas no mes', totais.vendas)}
            ${metric('Produtos monitorados', totais.produtos)}
            ${metric('Saldo financeiro', money(totais.financeiro))}
        </section>
        <section class="panel">
            <h2>Empresas vinculadas</h2>
            ${renderEmpresasTable(empresas)}
        </section>
        <section class="panel">
            <h2>Convites pendentes</h2>
            ${renderConvitesPendentes()}
        </section>
    `;

    document.querySelectorAll('[data-accept-company]').forEach((button) => {
        button.addEventListener('click', async () => {
            await api(`/api/contador/convites/${button.dataset.acceptCompany}/aceitar`, { method: 'POST' });
            window.location.reload();
        });
    });
}

async function renderFechamentos() {
    document.getElementById('pageTitle').textContent = 'Fechamento mensal';
    const empresasAtivas = state.empresas.filter((empresa) => empresa.status === 'ativo');
    const mesAtual = new Date().toISOString().slice(0, 7);

    document.getElementById('appContent').innerHTML = `
        <section class="panel">
            <h2>Gerar fechamento</h2>
            <div class="toolbar">
                <label>
                    Empresa
                    <select id="empresaSelect">
                        ${empresasAtivas.map((empresa) => `<option value="${empresa.id}">${escapeHtml(empresa.nome)}</option>`).join('')}
                    </select>
                </label>
                <label>
                    Mes
                    <input type="month" id="mesInput" value="${mesAtual}">
                </label>
                <button type="button" id="loadClosingButton">Carregar</button>
                <button type="button" class="secondary" data-export="csv">CSV</button>
                <button type="button" class="secondary" data-export="pdf">PDF</button>
            </div>
            <div id="closingResult" class="empty-state">Selecione uma empresa para visualizar o fechamento.</div>
        </section>
    `;

    const load = async () => {
        const empresaId = document.getElementById('empresaSelect').value;
        const mes = document.getElementById('mesInput').value;
        if (!empresaId) {
            renderClosing(null);
            return;
        }
        const fechamento = await api(`/api/contador/fechamentos?empresa_id=${empresaId}&mes=${encodeURIComponent(mes)}`);
        renderClosing(fechamento);
    };

    document.getElementById('loadClosingButton').addEventListener('click', load);
    document.querySelectorAll('[data-export]').forEach((button) => {
        button.addEventListener('click', () => exportarFechamento(button.dataset.export));
    });

    if (empresasAtivas.length) await load();
}

function renderClosing(fechamento) {
    const target = document.getElementById('closingResult');
    if (!fechamento) {
        target.innerHTML = 'Nenhuma empresa autorizada para fechamento.';
        return;
    }

    target.className = 'panel';
    target.innerHTML = `
        <section class="metric-grid">
            ${metric('Faturamento', money(fechamento.faturamento.total))}
            ${metric('Vendas', fechamento.vendas.quantidade)}
            ${metric('Entradas', money(fechamento.financeiro.entradas))}
            ${metric('Saidas', money(fechamento.financeiro.saidas))}
            ${metric('Saldo', money(fechamento.financeiro.saldo))}
            ${metric('Movimentos de caixa', fechamento.caixa.movimentos)}
        </section>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Empresa</th>
                        <th>Periodo</th>
                        <th>Produtos</th>
                        <th>Estoque baixo</th>
                        <th>Situacao fiscal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${escapeHtml(fechamento.empresa.nome_fantasia)}</td>
                        <td>${fechamento.periodo.inicio} a ${fechamento.periodo.fim}</td>
                        <td>${fechamento.estoque.produtos}</td>
                        <td>${fechamento.estoque.baixo}</td>
                        <td><span class="badge">Regular</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

async function exportarFechamento(formato) {
    const empresaId = document.getElementById('empresaSelect').value;
    const mes = document.getElementById('mesInput').value;
    if (!empresaId) return;

    const response = await fetch(`/api/contador/fechamentos/export?empresa_id=${empresaId}&mes=${encodeURIComponent(mes)}&formato=${formato}`, {
        headers: authHeaders()
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.erro || 'Falha ao exportar fechamento.');
    }

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fechamento-${empresaId}-${mes}.${formato}`;
    link.click();
    URL.revokeObjectURL(link.href);
}

function renderEmpresasTable(empresas) {
    if (!empresas.length) {
        return '<div class="empty-state">Nenhuma empresa autorizada ainda.</div>';
    }
    return `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Empresa</th>
                        <th>CNPJ</th>
                        <th>Faturamento</th>
                        <th>Vendas</th>
                        <th>Financeiro</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${empresas.map((empresa) => `
                        <tr>
                            <td>${escapeHtml(empresa.nome)}</td>
                            <td>${escapeHtml(empresa.documento || '-')}</td>
                            <td>${money(empresa.resumo?.faturamento_mensal || 0)}</td>
                            <td>${empresa.resumo?.vendas || 0}</td>
                            <td>${money(empresa.resumo?.financeiro?.saldo || 0)}</td>
                            <td><span class="badge">${empresa.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderConvitesPendentes() {
    const pendentes = state.empresas.filter((empresa) => empresa.status === 'pendente');
    if (!pendentes.length) {
        return '<div class="empty-state">Nenhum convite pendente.</div>';
    }
    return `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Empresa</th>
                        <th>CNPJ</th>
                        <th>Status</th>
                        <th>Acao</th>
                    </tr>
                </thead>
                <tbody>
                    ${pendentes.map((empresa) => `
                        <tr>
                            <td>${escapeHtml(empresa.nome)}</td>
                            <td>${escapeHtml(empresa.documento || '-')}</td>
                            <td><span class="badge pending">Pendente</span></td>
                            <td><button type="button" data-accept-company="${empresa.id}">Aceitar</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...authHeaders(),
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.erro || 'Falha na comunicacao com o servidor.');
        error.status = response.status;
        throw error;
    }
    return data;
}

function authHeaders() {
    return { Authorization: `Bearer ${state.session.token}` };
}

function readSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (_) {
        return null;
    }
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '/contador/login';
}

function highlightRoute() {
    const route = window.location.pathname.includes('/fechamentos') ? 'fechamentos' : 'dashboard';
    document.querySelectorAll('[data-route]').forEach((link) => {
        link.classList.toggle('is-active', link.dataset.route === route);
    });
}

function renderError(message) {
    document.getElementById('appContent').innerHTML = `<section class="empty-state">${escapeHtml(message)}</section>`;
}

function metric(label, value) {
    return `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}
