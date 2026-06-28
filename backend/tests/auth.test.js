const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ActivationService = require('../sync/pdv/activationService');
const SyncService = require('../sync/pdv/syncService');
const SyncRepository = require('../sync/pdv/syncRepository');
const SyncController = require('../sync/pdv/syncController');

let server;
let baseUrl;
let dbFile;
let categoriaId;
let produtoId;
let filialId;
let pdvId;
let sequenciaPdvOperacional = 1;

test.before(async () => {
    dbFile = path.join(os.tmpdir(), `realcaixa-auth-${Date.now()}.db`);
    process.env.REALCAIXA_DB_PATH = dbFile;
    process.env.JWT_SECRET = 'realcaixa-test-secret';

    const database = require('../database');
    const { criarApp } = require('../server');

    await database.inicializarBanco({ dbPath: dbFile });
    server = criarApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));

    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    if (dbFile && fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile);
    }
});

test('cadastro cria usuario, empresa, licenca e token JWT', async () => {
    const response = await post('/api/auth/cadastro', {
        nome: 'Cliente Teste',
        email: 'cliente@teste.com',
        senha: '123456',
        empresa: 'Empresa Teste',
        cnpj: '12.345.678/0001-90',
        telefone: '(11) 99999-9999',
        plano: 'profissional'
    });

    assert.equal(response.status, 201);
    assert.ok(response.body.token);
    assert.equal(response.body.usuario.email, 'cliente@teste.com');
    assert.equal(response.body.empresa.nome, 'Empresa Teste');
    assert.equal(response.body.empresa.documento, '12.345.678/0001-90');
    assert.equal(response.body.licenca.plano, 'profissional');
});

test('cadastro nao permite email duplicado', async () => {
    const response = await post('/api/auth/cadastro', {
        nome: 'Outro Cliente',
        email: 'cliente@teste.com',
        senha: '123456',
        empresa: 'Outra Empresa'
    });

    assert.equal(response.status, 409);
});

test('login valida senha e permite recuperar sessao', async () => {
    const login = await post('/api/auth/login', {
        email: 'cliente@teste.com',
        senha: '123456'
    });

    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    const me = await get('/api/auth/me', login.body.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.usuario.email, 'cliente@teste.com');
    assert.equal(me.body.empresa.nome, 'Empresa Teste');
    assert.equal(me.body.empresa.documento, '12.345.678/0001-90');
});

test('login rejeita credenciais invalidas', async () => {
    const response = await post('/api/auth/login', {
        email: 'cliente@teste.com',
        senha: 'senha-errada'
    });

    assert.equal(response.status, 401);
});

test('dashboard exige autenticacao e responde para usuario autenticado', async () => {
    const blocked = await get('/api/dashboard');
    assert.equal(blocked.status, 401);

    const login = await post('/api/auth/login', {
        email: 'cliente@teste.com',
        senha: '123456'
    });
    const dashboard = await get('/api/dashboard', login.body.token);

    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.empresa.nome, 'Empresa Teste');
    assert.equal(dashboard.body.indicadores.vendas_mes, 0);
    assert.equal(dashboard.body.indicadores.vendas_hoje, 0);
    assert.equal(dashboard.body.indicadores.total_filiais, 0);
    assert.equal(dashboard.body.indicadores.pdvs_ativos, 0);
    assert.equal(dashboard.body.indicadores.pdvs_offline, 0);
});

test('modulos do portal exigem autenticacao JWT', async () => {
    const blocked = await get('/api/modulos/produtos');
    assert.equal(blocked.status, 401);

    const login = await post('/api/auth/login', {
        email: 'cliente@teste.com',
        senha: '123456'
    });
    const produtos = await get('/api/modulos/produtos', login.body.token);

    assert.equal(produtos.status, 200);
    assert.equal(produtos.body.modulo, 'produtos');
    assert.equal(produtos.body.protegido, true);
});

test('navegacao protegida mantem a mesma sessao entre dashboard produtos e estoque', async () => {
    const login = await post('/api/auth/login', {
        email: 'cliente@teste.com',
        senha: '123456'
    });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    const dashboard = await get('/api/dashboard', login.body.token);
    const produtos = await get('/api/produtos', login.body.token);
    const estoque = await get('/api/estoque', login.body.token);
    const semToken = await get('/api/produtos');

    assert.equal(dashboard.status, 200);
    assert.equal(produtos.status, 200);
    assert.equal(estoque.status, 200);
    assert.equal(semToken.status, 401);

    const produtosPage = await html('/produtos');
    const estoquePage = await html('/estoque');
    assert.equal(produtosPage.status, 200);
    assert.equal(estoquePage.status, 200);
    assert.match(produtosPage.text, /Portal Cloud/);
    assert.match(estoquePage.text, /Portal Cloud/);

    const portalJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'cliente', 'portal.js'), 'utf8');
    assert.match(portalJs, /if \(!session\?\.token\)/);
    assert.match(portalJs, /error\?\.status === 401/);
});

test('cria e edita categoria da empresa autenticada', async () => {
    const { token } = await loginCliente();

    const criada = await post('/api/categorias', { nome: 'Sorvetes' }, token);
    assert.equal(criada.status, 201);
    assert.equal(criada.body.categoria.nome, 'Sorvetes');
    categoriaId = criada.body.categoria.id;

    const editada = await put(`/api/categorias/${categoriaId}`, { nome: 'Sorvetes Premium' }, token);
    assert.equal(editada.status, 200);
    assert.equal(editada.body.categoria.nome, 'Sorvetes Premium');
});

test('cria e edita produto da empresa autenticada', async () => {
    const { token } = await loginCliente();

    const criado = await post('/api/produtos', {
        categoria_id: categoriaId,
        codigo_interno: 'ACAI500',
        codigo_barras: '7890000000011',
        descricao: 'Acai 500ml',
        custo: 8.5,
        preco_venda: 18,
        estoque_atual: 12,
        estoque_minimo: 4,
        unidade: 'UN'
    }, token);

    assert.equal(criado.status, 201);
    assert.equal(criado.body.produto.codigo_interno, 'ACAI500');
    assert.equal(criado.body.produto.categoria_nome, 'Sorvetes Premium');
    produtoId = criado.body.produto.id;

    const editado = await put(`/api/produtos/${produtoId}`, {
        descricao: 'Acai 500ml completo',
        preco_venda: 20
    }, token);

    assert.equal(editado.status, 200);
    assert.equal(editado.body.produto.descricao, 'Acai 500ml completo');
    assert.equal(editado.body.produto.preco_venda, 20);
});

test('bloqueia duplicidade de codigo interno e codigo de barras por empresa', async () => {
    const { token } = await loginCliente();

    const duplicadoInterno = await post('/api/produtos', {
        codigo_interno: 'ACAI500',
        descricao: 'Outro produto',
        preco_venda: 10,
        unidade: 'UN'
    }, token);
    assert.equal(duplicadoInterno.status, 409);

    const duplicadoBarras = await post('/api/produtos', {
        codigo_interno: 'ACAI700',
        codigo_barras: '7890000000011',
        descricao: 'Acai 700ml',
        preco_venda: 24,
        unidade: 'UN'
    }, token);
    assert.equal(duplicadoBarras.status, 409);
});

test('lista produtos apenas da empresa autenticada', async () => {
    const empresaA = await loginCliente();
    const empresaB = await post('/api/auth/cadastro', {
        nome: 'Cliente B',
        email: 'cliente-b@teste.com',
        senha: '123456',
        empresa: 'Empresa B'
    });
    assert.equal(empresaB.status, 201);

    const produtoB = await post('/api/produtos', {
        codigo_interno: 'ACAI500',
        codigo_barras: '7890000000011',
        descricao: 'Produto empresa B',
        preco_venda: 30,
        unidade: 'UN'
    }, empresaB.body.token);
    assert.equal(produtoB.status, 201);

    const listaA = await get('/api/produtos?busca=ACAI500&incluir_inativos=1', empresaA.token);
    const listaB = await get('/api/produtos?busca=ACAI500&incluir_inativos=1', empresaB.body.token);

    assert.equal(listaA.status, 200);
    assert.equal(listaB.status, 200);
    assert.equal(listaA.body.dados.length, 1);
    assert.equal(listaB.body.dados.length, 1);
    assert.equal(listaA.body.dados[0].descricao, 'Acai 500ml completo');
    assert.equal(listaB.body.dados[0].descricao, 'Produto empresa B');
});

test('estoque registra entrada, saida, perda, ajuste e inventario', async () => {
    const { token } = await loginCliente();

    const entrada = await post('/api/estoque/entrada', {
        produto_id: produtoId,
        quantidade: 10,
        custo_unitario: 9.25,
        observacao: 'Compra de polpa'
    }, token);
    assert.equal(entrada.status, 201);
    assert.equal(entrada.body.produto.estoque_atual, 22);

    const saida = await post('/api/estoque/saida', {
        produto_id: produtoId,
        quantidade: 2,
        observacao: 'Baixa manual'
    }, token);
    assert.equal(saida.status, 201);
    assert.equal(saida.body.produto.estoque_atual, 20);

    const perda = await post('/api/estoque/perda', {
        produto_id: produtoId,
        quantidade: 1,
        observacao: 'Pote quebrado'
    }, token);
    assert.equal(perda.status, 201);
    assert.equal(perda.body.produto.estoque_atual, 19);

    const ajuste = await post('/api/estoque/ajuste', {
        produto_id: produtoId,
        estoque_corrigido: 15,
        observacao: 'Ajuste administrativo'
    }, token);
    assert.equal(ajuste.status, 201);
    assert.equal(ajuste.body.produto.estoque_atual, 15);
    assert.equal(ajuste.body.diferenca, -4);

    const inventario = await post('/api/estoque/inventario', {
        produto_id: produtoId,
        contagem_fisica: 14,
        observacao: 'Contagem fisica semanal'
    }, token);
    assert.equal(inventario.status, 201);
    assert.equal(inventario.body.produto.estoque_atual, 14);
    assert.equal(inventario.body.diferenca, -1);
});

test('estoque lista posicao e historico por filtros', async () => {
    const { token } = await loginCliente();

    const posicao = await get('/api/estoque', token);
    assert.equal(posicao.status, 200);
    assert.equal(posicao.body.dados[0].estoque_atual, 14);
    assert.equal(posicao.body.dados[0].status_estoque, 'Normal');

    const historico = await get(`/api/estoque/movimentacoes?produto_id=${produtoId}`, token);
    assert.equal(historico.status, 200);
    assert.ok(historico.body.dados.length >= 5);

    const perdas = await get('/api/estoque/movimentacoes?tipo=perda', token);
    assert.equal(perdas.status, 200);
    assert.equal(perdas.body.dados[0].tipo, 'perda');
});

test('estoque respeita segregacao por empresa', async () => {
    const empresaB = await post('/api/auth/cadastro', {
        nome: 'Cliente Estoque B',
        email: 'estoque-b@teste.com',
        senha: '123456',
        empresa: 'Empresa Estoque B'
    });
    assert.equal(empresaB.status, 201);

    const produtoB = await post('/api/produtos', {
        codigo_interno: 'MIX001',
        codigo_barras: '7890000099999',
        descricao: 'Mix para sorvete',
        preco_venda: 42,
        unidade: 'KG'
    }, empresaB.body.token);
    assert.equal(produtoB.status, 201);

    const entradaB = await post('/api/estoque/entrada', {
        produto_id: produtoB.body.produto.id,
        quantidade: 7,
        custo_unitario: 21,
        observacao: 'Compra empresa B'
    }, empresaB.body.token);
    assert.equal(entradaB.status, 201);

    const empresaA = await loginCliente();
    const listaA = await get('/api/estoque?busca=Mix', empresaA.token);
    const listaB = await get('/api/estoque?busca=Mix', empresaB.body.token);

    assert.equal(listaA.status, 200);
    assert.equal(listaB.status, 200);
    assert.equal(listaA.body.dados.length, 0);
    assert.equal(listaB.body.dados.length, 1);
});

test('financeiro cria contas a receber e contas a pagar', async () => {
    const { token } = await loginCliente();

    const receber = await post('/api/financeiro/contas-receber', {
        descricao: 'Venda de sorvetes',
        categoria: 'Vendas',
        valor: 150,
        vencimento: '2026-06-25',
        cliente: 'Cliente Balcao'
    }, token);
    assert.equal(receber.status, 201);
    assert.equal(receber.body.conta.status, 'pendente');

    const receberPago = await put(`/api/financeiro/contas-receber/${receber.body.conta.id}`, {
        status: 'recebido'
    }, token);
    assert.equal(receberPago.status, 200);
    assert.equal(receberPago.body.conta.status, 'recebido');

    const pagar = await post('/api/financeiro/contas-pagar', {
        descricao: 'Energia eletrica',
        categoria: 'Energia',
        fornecedor: 'Companhia de Energia',
        valor: 80,
        vencimento: '2026-06-26'
    }, token);
    assert.equal(pagar.status, 201);

    const pagarPago = await put(`/api/financeiro/contas-pagar/${pagar.body.conta.id}`, {
        status: 'pago'
    }, token);
    assert.equal(pagarPago.status, 200);
    assert.equal(pagarPago.body.conta.status, 'pago');
});

test('financeiro cria categorias e lancamentos', async () => {
    const { token } = await loginCliente();

    const categoria = await post('/api/financeiro/categorias', {
        nome: 'Delivery',
        tipo: 'receita'
    }, token);
    assert.equal(categoria.status, 201);

    const categoriaEditada = await put(`/api/financeiro/categorias/${categoria.body.categoria.id}`, {
        nome: 'Delivery Apps',
        tipo: 'receita'
    }, token);
    assert.equal(categoriaEditada.status, 200);
    assert.equal(categoriaEditada.body.categoria.nome, 'Delivery Apps');

    const entrada = await post('/api/financeiro/lancamentos', {
        tipo: 'entrada',
        descricao: 'Venda Pix',
        categoria: 'Vendas',
        valor: 200,
        data: '2026-06-20'
    }, token);
    assert.equal(entrada.status, 201);

    const saida = await post('/api/financeiro/lancamentos', {
        tipo: 'saida',
        descricao: 'Compra de casquinhas',
        categoria: 'Fornecedores',
        valor: 50,
        data: '2026-06-20'
    }, token);
    assert.equal(saida.status, 201);

    const transferencia = await post('/api/financeiro/lancamentos', {
        tipo: 'transferencia',
        descricao: 'Reserva interna',
        categoria: 'Caixa',
        valor: 30,
        data: '2026-06-21'
    }, token);
    assert.equal(transferencia.status, 201);
});

test('financeiro retorna dashboard e respeita segregacao por empresa', async () => {
    const empresaA = await loginCliente();
    const dashboardA = await get('/api/financeiro/dashboard?periodo=personalizado&data_inicio=2026-06-01&data_fim=2026-06-30', empresaA.token);
    assert.equal(dashboardA.status, 200);
    assert.equal(dashboardA.body.indicadores.faturamento_mes, 350);
    assert.equal(dashboardA.body.indicadores.despesas_mes, 130);
    assert.equal(dashboardA.body.indicadores.lucro_operacional, 220);

    const empresaB = await post('/api/auth/cadastro', {
        nome: 'Cliente Financeiro B',
        email: 'financeiro-b@teste.com',
        senha: '123456',
        empresa: 'Empresa Financeiro B'
    });
    assert.equal(empresaB.status, 201);

    await post('/api/financeiro/lancamentos', {
        tipo: 'entrada',
        descricao: 'Venda empresa B',
        valor: 999,
        data: '2026-06-20'
    }, empresaB.body.token);

    const dashboardB = await get('/api/financeiro/dashboard?periodo=personalizado&data_inicio=2026-06-01&data_fim=2026-06-30', empresaB.body.token);
    assert.equal(dashboardB.status, 200);
    assert.equal(dashboardB.body.indicadores.faturamento_mes, 999);
    assert.equal(dashboardB.body.indicadores.despesas_mes, 0);
});

test('cria, edita e desativa filial da empresa autenticada', async () => {
    const { token } = await loginCliente();

    const criada = await post('/api/filiais', {
        empresa_id: 999999,
        nome: 'Loja Centro',
        cnpj: '11.111.111/0001-11',
        ie: '123456',
        endereco: 'Rua Principal',
        numero: '100',
        bairro: 'Centro',
        cidade: 'Sao Paulo',
        estado: 'SP',
        cep: '01000-000',
        telefone: '(11) 3333-3333'
    }, token);
    assert.equal(criada.status, 201);
    assert.equal(criada.body.filial.nome, 'Loja Centro');
    filialId = criada.body.filial.id;

    const editada = await put(`/api/filiais/${filialId}`, {
        nome: 'Loja Centro Premium',
        cidade: 'Campinas'
    }, token);
    assert.equal(editada.status, 200);
    assert.equal(editada.body.filial.nome, 'Loja Centro Premium');
    assert.equal(editada.body.filial.cidade, 'Campinas');

    const lista = await get('/api/filiais?busca=Premium&incluir_inativas=1', token);
    assert.equal(lista.status, 200);
    assert.equal(lista.body.dados.length, 1);
});

test('cria, edita e desativa PDV vinculado a filial', async () => {
    const { token } = await loginCliente();

    const criado = await post('/api/pdvs', {
        empresa_id: 999999,
        filial_id: filialId,
        nome: 'Caixa 01',
        codigo_pdv: 'PDV-CENTRO-01',
        status: 'online',
        ultimo_sync: '2026-06-22T10:00:00.000Z',
        versao_app: '2.1.0'
    }, token);
    assert.equal(criado.status, 201);
    assert.equal(criado.body.pdv.codigo_pdv, 'PDV-CENTRO-01');
    assert.equal(criado.body.pdv.filial_id, filialId);
    pdvId = criado.body.pdv.id;

    const editado = await put(`/api/pdvs/${pdvId}`, {
        nome: 'Caixa Principal',
        status: 'offline',
        versao_app: '2.1.1'
    }, token);
    assert.equal(editado.status, 200);
    assert.equal(editado.body.pdv.nome, 'Caixa Principal');
    assert.equal(editado.body.pdv.status, 'offline');

    const dashboard = await get('/api/dashboard', token);
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.indicadores.total_filiais, 1);
    assert.equal(dashboard.body.indicadores.pdvs_ativos, 1);
    assert.equal(dashboard.body.indicadores.pdvs_offline, 1);
    assert.equal(dashboard.body.indicadores.ultima_sincronizacao, '2026-06-22T10:00:00.000Z');
});

test('filiais e PDVs impedem acesso cruzado entre empresas', async () => {
    const empresaA = await loginCliente();
    const empresaB = await post('/api/auth/cadastro', {
        nome: 'Cliente Multi B',
        email: 'multi-b@teste.com',
        senha: '123456',
        empresa: 'Empresa Multi B'
    });
    assert.equal(empresaB.status, 201);

    const filialB = await post('/api/filiais', {
        nome: 'Filial B',
        cidade: 'Curitiba'
    }, empresaB.body.token);
    assert.equal(filialB.status, 201);

    const pdvComFilialB = await post('/api/pdvs', {
        filial_id: filialB.body.filial.id,
        nome: 'PDV invasor',
        codigo_pdv: 'INV-01'
    }, empresaA.token);
    assert.equal(pdvComFilialB.status, 404);

    const listaFiliaisA = await get('/api/filiais?busca=Filial B&incluir_inativas=1', empresaA.token);
    const listaFiliaisB = await get('/api/filiais?busca=Filial B&incluir_inativas=1', empresaB.body.token);
    assert.equal(listaFiliaisA.status, 200);
    assert.equal(listaFiliaisB.status, 200);
    assert.equal(listaFiliaisA.body.dados.length, 0);
    assert.equal(listaFiliaisB.body.dados.length, 1);

    const pdvB = await post('/api/pdvs', {
        filial_id: filialB.body.filial.id,
        nome: 'Caixa B',
        codigo_pdv: 'PDV-B-01'
    }, empresaB.body.token);
    assert.equal(pdvB.status, 201);

    const listaPdvsA = await get('/api/pdvs?busca=PDV-B-01&incluir_inativos=1', empresaA.token);
    const listaPdvsB = await get('/api/pdvs?busca=PDV-B-01&incluir_inativos=1', empresaB.body.token);
    assert.equal(listaPdvsA.body.dados.length, 0);
    assert.equal(listaPdvsB.body.dados.length, 1);
});

test('desativa PDV e filial sem remover registros', async () => {
    const { token } = await loginCliente();

    const pdvRemovido = await del(`/api/pdvs/${pdvId}`, token);
    assert.equal(pdvRemovido.status, 200);
    assert.equal(pdvRemovido.body.pdv.ativo, 0);
    assert.equal(pdvRemovido.body.pdv.status, 'bloqueado');

    const filialRemovida = await del(`/api/filiais/${filialId}`, token);
    assert.equal(filialRemovida.status, 200);
    assert.equal(filialRemovida.body.filial.ativo, 0);

    const ativas = await get('/api/filiais?busca=Premium', token);
    const todas = await get('/api/filiais?busca=Premium&incluir_inativas=1', token);
    assert.equal(ativas.body.dados.length, 0);
    assert.equal(todas.body.dados.length, 1);
});

test('licenciamento verifica, ativa PDV, reabre status e recebe heartbeat', async () => {
    const conta = await post('/api/auth/cadastro', {
        nome: 'Cliente Licenca',
        email: 'licenca@teste.com',
        senha: '123456',
        empresa: 'Empresa Licenca',
        cnpj: '22.222.222/0001-22',
        plano: 'profissional'
    });
    assert.equal(conta.status, 201);

    const filial = await post('/api/filiais', {
        nome: 'Matriz Licenca',
        cidade: 'Santos'
    }, conta.body.token);
    assert.equal(filial.status, 201);

    const licenca = await post('/api/licenca/verificar', {
        cnpj: '22.222.222/0001-22',
        codigo_licenca: String(conta.body.licenca.id)
    });
    assert.equal(licenca.status, 200);
    assert.equal(licenca.body.autorizado, true);
    assert.equal(licenca.body.status, 'ativo');

    const ativacao = await post('/api/pdvs/registrar', {
        cnpj: '22.222.222/0001-22',
        codigo_licenca: String(conta.body.licenca.id),
        filial_id: filial.body.filial.id,
        nome_pdv: 'PDV Balcao',
        codigo_pdv: 'LIC-PDV-01',
        machine_id: 'MACHINE-LIC-001',
        dispositivo_nome: 'Terminal Balcao',
        versao_app: '2.2.0'
    });
    assert.equal(ativacao.status, 201);
    assert.ok(ativacao.body.device_token);
    assert.equal(ativacao.body.pdv.codigo_pdv, 'LIC-PDV-01');
    assert.equal(ativacao.body.pdv.licenciamento_status, 'ativo');
    assert.equal(ativacao.body.alerta_offline_dias, 7);

    const status = await get('/api/pdvs/status/LIC-PDV-01', ativacao.body.device_token);
    assert.equal(status.status, 200);
    assert.equal(status.body.autorizado, true);
    assert.equal(status.body.alerta_offline_dias, 7);

    const heartbeat = await post('/api/pdvs/heartbeat', {
        pdv_id: ativacao.body.pdv.id,
        versao_app: '2.2.1',
        data_hora: '2026-06-22T15:00:00.000Z',
        status: 'online',
        usuario_logado: 'operador@licenca.com'
    }, ativacao.body.device_token);
    assert.equal(heartbeat.status, 200);
    assert.equal(heartbeat.body.status, 'ativo');
    assert.equal(heartbeat.body.pdv.status, 'online');
    assert.equal(heartbeat.body.pdv.versao_app, '2.2.1');
    assert.equal(heartbeat.body.pdv.ultimo_usuario, 'operador@licenca.com');
});

test('portal de licenca visualiza, regenera, ativa, recebe heartbeat, revoga e isola por empresa', async () => {
    const conta = await post('/api/auth/cadastro', {
        nome: 'Cliente Licenca Portal',
        email: 'licenca-portal@teste.com',
        senha: '123456',
        empresa: 'Empresa Licenca Portal',
        cnpj: '44.444.444/0001-44',
        plano: 'profissional'
    });
    assert.equal(conta.status, 201);
    assert.match(conta.body.licenca.codigo_licenca, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const semToken = await get('/api/licenca');
    assert.equal(semToken.status, 401);

    const resumoInicial = await get('/api/licenca', conta.body.token);
    assert.equal(resumoInicial.status, 200);
    assert.equal(resumoInicial.body.licenca.codigo_licenca, conta.body.licenca.codigo_licenca);
    assert.equal(resumoInicial.body.uso.pdvs_usados, 0);

    const regenerada = await post('/api/licenca/regenerar', {}, conta.body.token);
    assert.equal(regenerada.status, 200);
    assert.match(regenerada.body.licenca.codigo_licenca, /^[0-9a-f-]{36}$/i);
    assert.notEqual(regenerada.body.licenca.codigo_licenca, conta.body.licenca.codigo_licenca);

    const filial = await post('/api/filiais', {
        nome: 'Filial Licenca Portal',
        cidade: 'Sao Paulo'
    }, conta.body.token);
    assert.equal(filial.status, 201);

    const ativacao = await post('/api/licenca/ativar', {
        cnpj: '44.444.444/0001-44',
        codigo_licenca: regenerada.body.licenca.codigo_licenca,
        filial_id: filial.body.filial.id,
        nome_pdv: 'PDV Portal',
        codigo_pdv: 'PORTAL-LIC-01',
        terminal_uuid: 'TERM-PORTAL-01',
        hostname: 'caixa-portal-01',
        versao_app: '2.2.0'
    });
    assert.equal(ativacao.status, 201);
    assert.ok(ativacao.body.device_token);
    assert.equal(ativacao.body.ativacao.terminal_uuid, 'TERM-PORTAL-01');
    assert.equal(ativacao.body.pdv.codigo_pdv, 'PORTAL-LIC-01');

    const ativacoes = await get('/api/licenca/ativacoes', conta.body.token);
    assert.equal(ativacoes.status, 200);
    assert.equal(ativacoes.body.total, 1);
    assert.equal(ativacoes.body.dados[0].hostname, 'caixa-portal-01');
    assert.equal(ativacoes.body.dados[0].device_token_hash, undefined);

    const heartbeat = await postDevice('/api/licenca/heartbeat', {
        terminal_uuid: 'TERM-PORTAL-01',
        status: 'online',
        versao_app: '2.2.1',
        usuario_logado: 'operador@portal.com'
    }, ativacao.body.device_token);
    assert.equal(heartbeat.status, 200);
    assert.equal(heartbeat.body.status, 'ativo');
    assert.equal(heartbeat.body.ativacao.versao_app, '2.2.1');

    const resumoComUso = await get('/api/licenca', conta.body.token);
    assert.equal(resumoComUso.body.uso.pdvs_usados, 1);
    assert.equal(resumoComUso.body.uso.ativacoes_realizadas, 1);
    assert.ok(resumoComUso.body.uso.ultimo_heartbeat);

    const empresaB = await post('/api/auth/cadastro', {
        nome: 'Cliente Licenca B',
        email: 'licenca-b-isolamento@teste.com',
        senha: '123456',
        empresa: 'Empresa Licenca B'
    });
    assert.equal(empresaB.status, 201);

    const ativacoesB = await get('/api/licenca/ativacoes', empresaB.body.token);
    assert.equal(ativacoesB.status, 200);
    assert.equal(ativacoesB.body.total, 0);

    const revogarCruzado = await post('/api/licenca/revogar', {
        ativacao_id: ativacao.body.ativacao.id
    }, empresaB.body.token);
    assert.equal(revogarCruzado.status, 404);

    const revogada = await post('/api/licenca/revogar', {
        ativacao_id: ativacao.body.ativacao.id
    }, conta.body.token);
    assert.equal(revogada.status, 200);
    assert.equal(revogada.body.ativacao.status, 'revogada');

    const aposRevogar = await get('/api/licenca', conta.body.token);
    assert.equal(aposRevogar.body.uso.ativacoes_realizadas, 0);
});

test('licenciamento bloqueia ativacao quando excede limite de PDVs', async () => {
    const conta = await post('/api/auth/cadastro', {
        nome: 'Cliente Limite Licenca',
        email: 'licenca-limite@teste.com',
        senha: '123456',
        empresa: 'Empresa Limite Licenca',
        cnpj: '55.555.555/0001-55',
        plano: 'basico'
    });
    assert.equal(conta.status, 201);
    assert.equal(conta.body.licenca.limite_pdvs, 1);

    const filial = await post('/api/filiais', {
        nome: 'Filial Limite',
        cidade: 'Sao Paulo'
    }, conta.body.token);
    assert.equal(filial.status, 201);

    const primeira = await post('/api/licenca/ativar', {
        cnpj: '55.555.555/0001-55',
        codigo_licenca: conta.body.licenca.codigo_licenca,
        filial_id: filial.body.filial.id,
        nome_pdv: 'PDV Limite 1',
        codigo_pdv: 'LIMITE-01',
        terminal_uuid: 'TERM-LIMITE-01'
    });
    assert.equal(primeira.status, 201);

    const excedida = await post('/api/licenca/ativar', {
        cnpj: '55.555.555/0001-55',
        codigo_licenca: conta.body.licenca.codigo_licenca,
        filial_id: filial.body.filial.id,
        nome_pdv: 'PDV Limite 2',
        codigo_pdv: 'LIMITE-02',
        terminal_uuid: 'TERM-LIMITE-02'
    });
    assert.equal(excedida.status, 403);
    assert.match(excedida.body.erro, /Limite de PDVs/);
});

test('servico de ativacao do PDV salva ativacao local, reabre online e libera offline', async () => {
    const conta = await post('/api/auth/cadastro', {
        nome: 'Cliente Desktop',
        email: 'desktop@teste.com',
        senha: '123456',
        empresa: 'Empresa Desktop',
        cnpj: '55.555.555/0001-55',
        plano: 'profissional'
    });
    assert.equal(conta.status, 201);

    const filial = await post('/api/filiais', {
        nome: 'Matriz Desktop',
        cidade: 'Ribeirao Preto'
    }, conta.body.token);
    assert.equal(filial.status, 201);

    const storage = criarStorageMemoria();
    const service = new ActivationService({ apiBaseUrl: baseUrl, storage });

    const inicial = await service.iniciarAplicacao({ versaoApp: '2.3.0' });
    assert.equal(inicial.requer_ativacao, true);

    const ativacao = await service.ativar({
        cnpj: '55.555.555/0001-55',
        codigoLicenca: String(conta.body.licenca.id),
        nomePdv: 'PDV Desktop 01',
        filialId: filial.body.filial.id,
        codigoPdv: 'DESK-PDV-01',
        machineId: 'MACHINE-DESK-001',
        dispositivoNome: 'Computador Caixa',
        versaoApp: '2.3.0'
    });
    assert.equal(ativacao.empresa_id, conta.body.empresa.id);
    assert.equal(ativacao.filial_id, filial.body.filial.id);
    assert.ok(ativacao.device_token);
    assert.equal(ativacao.status_licenca, 'ativo');

    const reabertura = await service.iniciarAplicacao({
        versaoApp: '2.3.1',
        usuarioLogado: 'operador@desktop.com'
    });
    assert.equal(reabertura.ativado, true);
    assert.equal(reabertura.online, true);
    assert.equal(reabertura.autorizado, true);
    assert.equal(reabertura.status_licenca, 'ativo');

    const portal = await get('/api/pdvs?busca=DESK-PDV-01&incluir_inativos=1', conta.body.token);
    assert.equal(portal.status, 200);
    assert.equal(portal.body.dados.length, 1);
    assert.equal(portal.body.dados[0].status, 'online');
    assert.equal(portal.body.dados[0].ultimo_usuario, 'operador@desktop.com');

    const offlineService = new ActivationService({
        apiBaseUrl: baseUrl,
        storage,
        fetchImpl: async () => {
            throw new Error('sem internet');
        }
    });
    const offline = await offlineService.iniciarAplicacao({ versaoApp: '2.3.1' });
    assert.equal(offline.ativado, true);
    assert.equal(offline.online, false);
    assert.equal(offline.autorizado, true);
    assert.match(offline.mensagem, /offline liberado/);
});

test('licenciamento bloqueia CNPJ inexistente, empresa inativa e licenca bloqueada', async () => {
    const inexistente = await post('/api/licenca/verificar', {
        cnpj: '00.000.000/0000-00',
        codigo_licenca: '999999'
    });
    assert.equal(inexistente.status, 404);

    const contaInativa = await post('/api/auth/cadastro', {
        nome: 'Cliente Inativo',
        email: 'inativo@teste.com',
        senha: '123456',
        empresa: 'Empresa Inativa',
        cnpj: '33.333.333/0001-33'
    });
    assert.equal(contaInativa.status, 201);

    const database = require('../database');
    await database.executarComando('UPDATE empresas SET status = ? WHERE id = ?', ['inativa', contaInativa.body.empresa.id]);

    const empresaInativa = await post('/api/licenca/verificar', {
        cnpj: '33.333.333/0001-33',
        codigo_empresa: String(contaInativa.body.empresa.id)
    });
    assert.equal(empresaInativa.status, 200);
    assert.equal(empresaInativa.body.autorizado, false);
    assert.equal(empresaInativa.body.status, 'bloqueado');

    const contaBloqueada = await post('/api/auth/cadastro', {
        nome: 'Cliente Bloqueado',
        email: 'bloqueado@teste.com',
        senha: '123456',
        empresa: 'Empresa Bloqueada',
        cnpj: '44.444.444/0001-44'
    });
    assert.equal(contaBloqueada.status, 201);
    const filial = await post('/api/filiais', { nome: 'Matriz Bloqueada' }, contaBloqueada.body.token);
    assert.equal(filial.status, 201);
    const ativacao = await post('/api/pdvs/registrar', {
        cnpj: '44.444.444/0001-44',
        codigo_licenca: String(contaBloqueada.body.licenca.id),
        filial_id: filial.body.filial.id,
        nome_pdv: 'PDV Bloqueio',
        codigo_pdv: 'BLOQ-PDV-01',
        machine_id: 'MACHINE-BLOQ-001'
    });
    assert.equal(ativacao.status, 201);

    await database.executarComando('UPDATE licencas SET status = ? WHERE id = ?', ['bloqueada', contaBloqueada.body.licenca.id]);

    const statusBloqueado = await get('/api/pdvs/status/BLOQ-PDV-01', ativacao.body.device_token);
    assert.equal(statusBloqueado.status, 200);
    assert.equal(statusBloqueado.body.autorizado, false);
    assert.equal(statusBloqueado.body.status, 'bloqueado');

    const novaAtivacaoBloqueada = await post('/api/pdvs/registrar', {
        cnpj: '44.444.444/0001-44',
        codigo_licenca: String(contaBloqueada.body.licenca.id),
        filial_id: filial.body.filial.id,
        nome_pdv: 'Outro PDV',
        codigo_pdv: 'BLOQ-PDV-02'
    });
    assert.equal(novaAtivacaoBloqueada.status, 403);

    const cnpjDivergente = await post('/api/pdvs/registrar', {
        cnpj: '00.000.000/0000-00',
        codigo_licenca: String(contaBloqueada.body.licenca.id),
        filial_id: filial.body.filial.id,
        nome_pdv: 'PDV CNPJ errado',
        codigo_pdv: 'BLOQ-PDV-03'
    });
    assert.equal(cnpjDivergente.status, 404);

    const tokenInvalido = await get('/api/pdvs/status/BLOQ-PDV-01', 'token-invalido');
    assert.equal(tokenInvalido.status, 404);
});

test('sync exige JWT e publica produtos, categorias, usuarios e configuracoes da empresa', async () => {
    const { token } = await loginCliente();

    const bloqueado = await get('/api/sync/produtos');
    assert.equal(bloqueado.status, 401);

    const produtos = await get('/api/sync/produtos', token);
    const categorias = await get('/api/sync/categorias', token);
    const usuarios = await get('/api/sync/usuarios', token);
    const configuracoes = await get('/api/sync/configuracoes', token);

    assert.equal(produtos.status, 200);
    assert.equal(produtos.body.recurso, 'produtos');
    assert.equal(produtos.body.direcao, 'portal_para_pdv');
    assert.ok(produtos.body.dados.some((produto) => produto.codigo_interno === 'ACAI500'));

    assert.equal(categorias.status, 200);
    assert.ok(categorias.body.dados.some((categoria) => categoria.nome === 'Sorvetes Premium'));

    assert.equal(usuarios.status, 200);
    assert.ok(usuarios.body.dados.some((usuario) => usuario.email === 'cliente@teste.com'));
    assert.equal(Object.prototype.hasOwnProperty.call(usuarios.body.dados[0], 'senha_hash'), false);

    assert.equal(configuracoes.status, 200);
    assert.equal(configuracoes.body.total, 1);
    assert.equal(configuracoes.body.dados[0].empresa.nome_fantasia, 'Empresa Teste');
    assert.equal(configuracoes.body.dados[0].licenca.plano, 'profissional');
});

test('sync filtra por last_sync_at e respeita segregacao por empresa', async () => {
    const empresaA = await loginCliente();
    const empresaB = await post('/api/auth/cadastro', {
        nome: 'Cliente Sync B',
        email: 'sync-b@teste.com',
        senha: '123456',
        empresa: 'Empresa Sync B'
    });
    assert.equal(empresaB.status, 201);

    const produtoB = await post('/api/produtos', {
        codigo_interno: 'SYNC-B-001',
        codigo_barras: '7891234567001',
        descricao: 'Produto exclusivo Sync B',
        preco_venda: 11,
        unidade: 'UN'
    }, empresaB.body.token);
    assert.equal(produtoB.status, 201);

    const futuro = encodeURIComponent('2999-01-01T00:00:00.000Z');
    const semAlteracoes = await get(`/api/sync/produtos?last_sync_at=${futuro}`, empresaA.token);
    assert.equal(semAlteracoes.status, 200);
    assert.equal(semAlteracoes.body.total, 0);

    const produtosA = await get('/api/sync/produtos', empresaA.token);
    const produtosB = await get('/api/sync/produtos', empresaB.body.token);

    assert.equal(produtosA.status, 200);
    assert.equal(produtosB.status, 200);
    assert.equal(produtosA.body.dados.some((produto) => produto.descricao === 'Produto exclusivo Sync B'), false);
    assert.equal(produtosB.body.dados.some((produto) => produto.descricao === 'Produto exclusivo Sync B'), true);
});

test('sync Portal para PDV pagina resultados com limit e next_cursor', async () => {
    const conta = await post('/api/auth/cadastro', {
        nome: 'Cliente Paginado',
        email: 'paginado@teste.com',
        senha: '123456',
        empresa: 'Empresa Paginada',
        cnpj: '77.777.777/0001-77',
        plano: 'profissional'
    });
    assert.equal(conta.status, 201);

    const filial = await post('/api/filiais', { nome: 'Matriz Paginada' }, conta.body.token);
    assert.equal(filial.status, 201);

    for (let index = 1; index <= 3; index += 1) {
        const produto = await post('/api/produtos', {
            codigo_interno: `PAGE-${index}`,
            descricao: `Produto Paginado ${index}`,
            preco_venda: index,
            unidade: 'UN'
        }, conta.body.token);
        assert.equal(produto.status, 201);
    }

    const ativacao = await post('/api/pdvs/registrar', {
        cnpj: '77.777.777/0001-77',
        codigo_licenca: String(conta.body.licenca.id),
        filial_id: filial.body.filial.id,
        nome_pdv: 'PDV Paginado',
        codigo_pdv: 'PAGE-PDV-01',
        machine_id: 'MACHINE-PAGE-001'
    });
    assert.equal(ativacao.status, 201);

    const primeira = await getDevice('/api/sync/produtos?limit=2', ativacao.body.device_token);
    assert.equal(primeira.status, 200);
    assert.equal(primeira.body.dados.length, 2);
    assert.equal(primeira.body.next_cursor, '2');

    const segunda = await getDevice(`/api/sync/produtos?limit=2&cursor=${primeira.body.next_cursor}`, ativacao.body.device_token);
    assert.equal(segunda.status, 200);
    assert.equal(segunda.body.dados.length, 1);
    assert.equal(segunda.body.next_cursor, null);
});

test('sync Portal para PDV usa device_token, baixa dados administrativos e atualiza produto local', async () => {
    const conta = await post('/api/auth/cadastro', {
        nome: 'Cliente Sync PDV',
        email: 'sync-pdv@teste.com',
        senha: '123456',
        empresa: 'Empresa Sync PDV',
        cnpj: '66.666.666/0001-66',
        plano: 'profissional'
    });
    assert.equal(conta.status, 201);

    const filial = await post('/api/filiais', { nome: 'Loja Sync PDV', cidade: 'Bauru' }, conta.body.token);
    assert.equal(filial.status, 201);

    const categoria = await post('/api/categorias', { nome: 'Picoles' }, conta.body.token);
    assert.equal(categoria.status, 201);

    const produto = await post('/api/produtos', {
        categoria_id: categoria.body.categoria.id,
        codigo_interno: 'PIC001',
        codigo_barras: '7896660000011',
        descricao: 'Picole de Morango',
        preco_venda: 5,
        unidade: 'UN',
        estoque_atual: 20
    }, conta.body.token);
    assert.equal(produto.status, 201);

    const ativacao = await post('/api/pdvs/registrar', {
        cnpj: '66.666.666/0001-66',
        codigo_licenca: String(conta.body.licenca.id),
        filial_id: filial.body.filial.id,
        nome_pdv: 'PDV Sync Local',
        codigo_pdv: 'SYNC-PDV-01',
        machine_id: 'MACHINE-SYNC-PDV-001',
        versao_app: '2.4.0'
    });
    assert.equal(ativacao.status, 201);

    const produtosDevice = await getDevice('/api/sync/produtos', ativacao.body.device_token);
    const filiaisDevice = await getDevice('/api/sync/filiais', ativacao.body.device_token);
    const licencaDevice = await getDevice('/api/sync/licenca', ativacao.body.device_token);
    const permissoesDevice = await getDevice('/api/sync/permissoes', ativacao.body.device_token);
    assert.equal(produtosDevice.status, 200);
    assert.equal(filiaisDevice.status, 200);
    assert.equal(licencaDevice.status, 200);
    assert.equal(permissoesDevice.status, 200);
    assert.ok(produtosDevice.body.dados.some((item) => item.codigo_interno === 'PIC001'));
    assert.ok(filiaisDevice.body.dados.some((item) => item.nome === 'Loja Sync PDV'));
    assert.equal(licencaDevice.body.dados[0].status, 'ativa');

    const localRepository = new SyncRepository();
    const sync = new SyncService({
        apiBaseUrl: baseUrl,
        deviceToken: ativacao.body.device_token,
        repository: localRepository
    });

    const primeira = await sync.sincronizarPortalParaPdv();
    assert.equal(primeira.resultado.produtos.total, 1);
    assert.equal(localRepository.memoria.produtos.length, 1);
    assert.equal(localRepository.memoria.produtos[0].preco_venda, 5);
    assert.equal(localRepository.memoria.filiais[0].nome, 'Loja Sync PDV');
    assert.equal(localRepository.memoria.licenca[0].status, 'ativa');
    assert.ok(localRepository.obterLastSyncAt());

    const atualizado = await put(`/api/produtos/${produto.body.produto.id}`, {
        preco_venda: 7.5,
        ativo: false
    }, conta.body.token);
    assert.equal(atualizado.status, 200);

    const segunda = await sync.sincronizarPortalParaPdv({ lastSyncAt: '2000-01-01T00:00:00.000Z' });
    assert.ok(segunda.resultado.produtos.dados.some((item) => item.codigo_interno === 'PIC001'));
    assert.equal(localRepository.memoria.produtos.length, 1);
    assert.equal(localRepository.memoria.produtos[0].preco_venda, 7.5);
    assert.equal(localRepository.memoria.produtos[0].ativo, 0);

    const semInternet = new SyncController({
        activationService: {
            async iniciarAplicacao() {
                return {
                    ativado: true,
                    requer_ativacao: false,
                    online: false,
                    autorizado: true,
                    mensagem: 'Portal indisponivel. Funcionamento offline liberado para PDV ja ativado.',
                    ativacao: { device_token: ativacao.body.device_token }
                };
            }
        }
    });
    const offline = await semInternet.iniciarPdv({ versaoApp: '2.4.0' });
    assert.equal(offline.sincronizacao.executada, false);
    assert.equal(offline.sincronizacao.offline, true);
    assert.equal(localRepository.memoria.produtos[0].descricao, 'Picole de Morango');
});

test('sync PDV para Portal recebe venda sem duplicar e atualiza estoque', async () => {
    const conta = await loginCliente();
    const pdv = await ativarPdvOperacional(conta);

    const venda = {
        uuid: 'venda-pdv-0001',
        numero: '0001',
        data_venda: '2026-06-22T10:00:00.000Z',
        subtotal: 40,
        desconto: 0,
        total: 40,
        operador_nome: 'Operador PDV',
        itens: [{
            produto_id: produtoId,
            codigo_interno: 'ACAI500',
            descricao: 'Acai 500ml completo',
            quantidade: 2,
            preco_unitario: 20,
            total: 40
        }],
        pagamentos: [{
            forma: 'pix',
            valor: 40
        }]
    };

    const recebido = await postDevice('/api/sync/vendas', {
        empresa_id: 999999,
        filial_id: pdv.filial_id,
        pdv_id: pdv.id,
        vendas: [venda]
    }, pdv.device_token);
    assert.equal(recebido.status, 202);
    assert.equal(recebido.body.recebidos, 1);
    assert.equal(recebido.body.duplicados, 0);

    const estoqueDepoisVenda = await get('/api/estoque?busca=ACAI500', conta.token);
    assert.equal(estoqueDepoisVenda.status, 200);
    assert.equal(estoqueDepoisVenda.body.dados[0].estoque_atual, 12);

    const duplicado = await postDevice('/api/sync/vendas', {
        pdv_id: pdv.id,
        vendas: [venda]
    }, pdv.device_token);
    assert.equal(duplicado.status, 202);
    assert.equal(duplicado.body.recebidos, 0);
    assert.equal(duplicado.body.duplicados, 1);

    const estoqueDepoisDuplicado = await get('/api/estoque?busca=ACAI500', conta.token);
    assert.equal(estoqueDepoisDuplicado.body.dados[0].estoque_atual, 12);

    const database = require('../database');
    const vendaSalva = await database.buscarUm(
        'SELECT COUNT(*) AS total FROM sync_vendas WHERE uuid = ?',
        ['venda-pdv-0001']
    );
    const itemSalvo = await database.buscarUm(
        'SELECT COUNT(*) AS total FROM sync_venda_itens WHERE descricao = ?',
        ['Acai 500ml completo']
    );
    const pagamentoSalvo = await database.buscarUm(
        'SELECT COUNT(*) AS total FROM sync_venda_pagamentos WHERE forma = ? AND valor = ?',
        ['pix', 40]
    );
    const financeiro = await database.buscarUm(
        'SELECT COUNT(*) AS total, MAX(valor) AS valor, MAX(categoria) AS categoria, MAX(origem) AS origem, MAX(forma_pagamento) AS forma FROM financeiro_lancamentos WHERE empresa_id = ? AND venda_uuid = ?',
        [conta.empresa.id, 'venda-pdv-0001']
    );

    assert.equal(vendaSalva.total, 1);
    assert.equal(itemSalvo.total, 1);
    assert.equal(pagamentoSalvo.total, 1);
    assert.equal(financeiro.total, 1);
    assert.equal(financeiro.valor, 40);
    assert.equal(financeiro.categoria, 'Vendas PDV');
    assert.equal(financeiro.origem, 'pdv_sync');
    assert.equal(financeiro.forma, 'pix');
});

test('sync PDV para Portal recebe caixa e movimentacoes de estoque', async () => {
    const conta = await loginCliente();
    const pdv = await ativarPdvOperacional(conta);

    const caixa = await postDevice('/api/sync/caixa', {
        pdv_id: pdv.id,
        movimentacoes: [
            {
                uuid: 'caixa-suprimento-0001',
                tipo: 'suprimento',
                valor: 100,
                observacao: 'Troco inicial',
                data_movimento: '2026-06-22T09:00:00.000Z'
            },
            {
                uuid: 'caixa-sangria-0001',
                tipo: 'sangria',
                valor: 30,
                observacao: 'Retirada parcial',
                data_movimento: '2026-06-22T12:00:00.000Z'
            }
        ],
        fechamentos: [{
            uuid: 'fechamento-0001',
            data_abertura: '2026-06-22T09:00:00.000Z',
            data_fechamento: '2026-06-22T18:00:00.000Z',
            saldo_inicial: 100,
            total_vendas: 40,
            total_sangrias: 30,
            total_suprimentos: 100,
            saldo_final: 210
        }]
    }, pdv.device_token);
    assert.equal(caixa.status, 202);
    assert.equal(caixa.body.recebidos, 3);

    const movimentoEstoque = await postDevice('/api/sync/estoque-movimentacoes', {
        pdv_id: pdv.id,
        movimentacoes: [{
            uuid: 'estoque-ajuste-pdv-0001',
            produto_id: produtoId,
            tipo: 'entrada',
            quantidade: 3,
            observacao: 'Entrada pendente do PDV'
        }]
    }, pdv.device_token);
    assert.equal(movimentoEstoque.status, 202);
    assert.equal(movimentoEstoque.body.recebidos, 1);

    const estoque = await get('/api/estoque?busca=ACAI500', conta.token);
    assert.equal(estoque.body.dados[0].estoque_atual, 15);

    const database = require('../database');
    const movimentosCaixa = await database.buscarUm(
        'SELECT COUNT(*) AS total FROM sync_caixa_movimentacoes WHERE pdv_id = ?',
        [String(pdv.id)]
    );
    const fechamentos = await database.buscarUm(
        'SELECT COUNT(*) AS total FROM sync_caixa_fechamentos WHERE uuid = ?',
        ['fechamento-0001']
    );
    assert.equal(movimentosCaixa.total, 2);
    assert.equal(fechamentos.total, 1);
});

test('fila local envia eventos pendentes quando internet volta e registra logs', async () => {
    const conta = await loginCliente();
    const pdv = await ativarPdvOperacional(conta);

    const syncOffline = new SyncService({
        apiBaseUrl: baseUrl,
        deviceToken: pdv.device_token,
        fetchImpl: async () => {
            throw new Error('sem internet');
        }
    });

    const vendaOffline = {
        uuid: 'venda-offline-0001',
        numero: 'OFF-001',
        data_venda: '2026-06-22T16:00:00.000Z',
        total: 20,
        itens: [{
            produto_id: produtoId,
            codigo_interno: 'ACAI500',
            descricao: 'Acai 500ml completo',
            quantidade: 1,
            preco_unitario: 20,
            total: 20
        }],
        pagamentos: [{ forma: 'dinheiro', valor: 20 }]
    };
    syncOffline.registrarVendaFinalizada(vendaOffline);
    syncOffline.registrarSangria({
        uuid: 'sangria-offline-0001',
        valor: 15,
        observacao: 'Retirada offline',
        data_movimento: '2026-06-22T16:10:00.000Z'
    });

    const falha = await syncOffline.sincronizarPdvParaPortal({ pdvId: pdv.id });
    assert.equal(falha.length, 2);
    assert.equal(falha.every((item) => item.status === 'erro'), true);
    assert.equal(syncOffline.queue.pendentes().length, 2);

    const syncOnline = new SyncService({
        apiBaseUrl: baseUrl,
        deviceToken: pdv.device_token,
        queue: syncOffline.queue
    });
    const enviados = await syncOnline.sincronizarPdvParaPortal({ pdvId: pdv.id });
    assert.equal(enviados.filter((item) => item.status === 'enviado').length, 2);
    assert.equal(syncOnline.queue.pendentes().length, 0);

    const duplicadoLocal = syncOnline.registrarVendaFinalizada(vendaOffline);
    assert.equal(duplicadoLocal.status, 'enviado');

    const reenviado = await postDevice('/api/sync/vendas', {
        pdv_id: pdv.id,
        vendas: [vendaOffline]
    }, pdv.device_token);
    assert.equal(reenviado.status, 202);
    assert.equal(reenviado.body.duplicados, 1);

    const database = require('../database');
    const vendaSalva = await database.buscarUm('SELECT COUNT(*) AS total FROM sync_vendas WHERE uuid = ?', ['venda-offline-0001']);
    const sangriaSalva = await database.buscarUm('SELECT COUNT(*) AS total FROM sync_caixa_movimentacoes WHERE uuid = ?', ['sangria-offline-0001']);
    const logs = await database.buscarUm(
        "SELECT COUNT(*) AS total FROM sync_logs WHERE empresa_id = ? AND recurso IN ('vendas', 'caixa') AND status = 'concluida'",
        [conta.empresa.id]
    );
    assert.equal(vendaSalva.total, 1);
    assert.equal(sangriaSalva.total, 1);
    assert.ok(logs.total >= 2);
});

test('auditoria de sincronizacao mostra status e registra erro do PDV', async () => {
    const conta = await loginCliente();
    const pdv = await ativarPdvOperacional(conta);

    const erro = await postDevice('/api/sync/estoque-movimentacoes', {
        pdv_id: pdv.id,
        eventos_pendentes: 4,
        movimentacoes: [{
            uuid: 'erro-sync-estoque-0001',
            produto_id: 999999,
            tipo: 'saida',
            quantidade: 1
        }]
    }, pdv.device_token);
    assert.equal(erro.status, 404);

    const auditoria = await get('/api/sync/auditoria', conta.token);
    assert.equal(auditoria.status, 200);
    const pdvAuditado = auditoria.body.pdvs.find((item) => item.id === pdv.id);
    assert.ok(pdvAuditado);
    assert.equal(pdvAuditado.eventos_pendentes, 4);
    assert.match(pdvAuditado.ultimo_erro_sync, /Produto da movimentacao/);
    assert.ok(auditoria.body.logs.some((log) => log.status === 'erro'));

    const tela = await html('/sincronizacao');
    assert.equal(tela.status, 200);
    assert.match(tela.text, /Portal Cloud/);

    const portalJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'cliente', 'portal.js'), 'utf8');
    assert.match(portalJs, /api\/sync\/auditoria/);
    assert.match(portalJs, /renderSincronizacao/);
});

test('portal do contador cria perfil, aceita convite e bloqueia empresa nao autorizada', async () => {
    const empresario = await loginCliente();

    const contador = await post('/api/contador/cadastro', {
        nome: 'Contador Teste',
        email: 'contador@teste.com',
        senha: '123456'
    });
    assert.equal(contador.status, 201);
    assert.equal(contador.body.contador.perfil, 'contador');

    const login = await post('/api/contador/login', {
        email: 'contador@teste.com',
        senha: '123456'
    });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    const convite = await post('/api/contador/empresarial/convites', {
        email: 'contador@teste.com',
        nome: 'Contador Teste'
    }, empresario.token);
    assert.equal(convite.status, 201);
    assert.equal(convite.body.vinculo.status, 'pendente');

    const dashboardAntes = await get('/api/contador/dashboard', login.body.token);
    assert.equal(dashboardAntes.status, 200);
    assert.equal(dashboardAntes.body.total_empresas, 0);

    const aceite = await post(`/api/contador/convites/${empresario.empresa.id}/aceitar`, {}, login.body.token);
    assert.equal(aceite.status, 200);
    assert.equal(aceite.body.vinculo.status, 'ativo');

    const dashboardDepois = await get('/api/contador/dashboard', login.body.token);
    assert.equal(dashboardDepois.status, 200);
    assert.equal(dashboardDepois.body.total_empresas, 1);
    assert.equal(dashboardDepois.body.empresas[0].id, empresario.empresa.id);

    const fechamento = await get(`/api/contador/fechamentos?empresa_id=${empresario.empresa.id}&mes=2026-06`, login.body.token);
    assert.equal(fechamento.status, 200);
    assert.equal(fechamento.body.empresa.id, empresario.empresa.id);

    const empresaNaoAutorizada = await post('/api/auth/cadastro', {
        nome: 'Empresa Sem Contador',
        email: 'sem-contador@teste.com',
        senha: '123456',
        empresa: 'Empresa Sem Contador'
    });
    assert.equal(empresaNaoAutorizada.status, 201);

    const bloqueado = await get(`/api/contador/fechamentos?empresa_id=${empresaNaoAutorizada.body.empresa.id}&mes=2026-06`, login.body.token);
    assert.equal(bloqueado.status, 403);

    const lista = await get('/api/contador/empresarial/contadores', empresario.token);
    assert.equal(lista.status, 200);
    assert.ok(lista.body.contadores.some((item) => item.email === 'contador@teste.com'));

    const removido = await del(`/api/contador/empresarial/contadores/${contador.body.contador.id}`, empresario.token);
    assert.equal(removido.status, 200);
    assert.equal(removido.body.vinculo.status, 'removido');

    const dashboardPage = await html('/contador/dashboard');
    const loginPage = await html('/contador/login');
    assert.equal(dashboardPage.status, 200);
    assert.equal(loginPage.status, 200);
    assert.match(dashboardPage.text, /Portal do contador/);
    assert.match(loginPage.text, /Portal do contador/);
});

test('assistente empresarial responde indicadores e respeita empresa e contador somente leitura', async () => {
    const conta = await loginCliente();
    const hoje = new Date().toISOString().slice(0, 10);
    const pdv = await ativarPdvOperacional(conta);

    const produtoBaixo = await post('/api/produtos', {
        codigo_interno: 'BAIXO-IA',
        descricao: 'Calda Baunilha IA',
        custo: 4,
        preco_venda: 12,
        estoque_atual: 1,
        estoque_minimo: 5,
        unidade: 'UN'
    }, conta.token);
    assert.equal(produtoBaixo.status, 201);

    const venda = await postDevice('/api/sync/vendas', {
        pdv_id: pdv.id,
        vendas: [{
            uuid: 'venda-assistente-0001',
            numero: 'IA-001',
            data_venda: `${hoje}T11:00:00.000Z`,
            subtotal: 36,
            total: 36,
            itens: [{
                produto_id: produtoId,
                codigo_interno: 'ACAI500',
                descricao: 'Acai 500ml completo',
                quantidade: 2,
                preco_unitario: 18,
                total: 36
            }],
            pagamentos: [{ forma: 'pix', valor: 36 }]
        }]
    }, pdv.device_token);
    assert.equal(venda.status, 202);

    const contaVencida = await post('/api/financeiro/contas-pagar', {
        descricao: 'Fornecedor vencido IA',
        categoria: 'Fornecedores',
        fornecedor: 'Distribuidora IA',
        valor: 77,
        vencimento: '2020-01-10'
    }, conta.token);
    assert.equal(contaVencida.status, 201);

    const faturamento = await post('/api/assistente/perguntar', { pergunta: 'Quanto vendi hoje?' }, conta.token);
    assert.equal(faturamento.status, 200);
    assert.equal(faturamento.body.resposta.tipo, 'faturamento');
    assert.match(faturamento.body.resposta.texto, /Hoje foram registradas/);

    const maisVendido = await post('/api/assistente/perguntar', { pergunta: 'Qual produto mais vendeu?' }, conta.token);
    assert.equal(maisVendido.status, 200);
    assert.equal(maisVendido.body.resposta.tipo, 'produto_mais_vendido');
    assert.match(maisVendido.body.resposta.texto, /Acai 500ml completo/);

    const estoqueBaixo = await post('/api/assistente/perguntar', { pergunta: 'Quais produtos estao com estoque baixo?' }, conta.token);
    assert.equal(estoqueBaixo.status, 200);
    assert.equal(estoqueBaixo.body.resposta.tipo, 'estoque_baixo');
    assert.ok(estoqueBaixo.body.resposta.dados.some((item) => item.codigo_interno === 'BAIXO-IA'));

    const vencidas = await post('/api/assistente/perguntar', { pergunta: 'Quanto tenho de contas vencidas?' }, conta.token);
    assert.equal(vencidas.status, 200);
    assert.equal(vencidas.body.resposta.tipo, 'contas_vencidas');
    assert.ok(vencidas.body.resposta.cards.some((card) => String(card.value).includes('77')));

    const ticket = await post('/api/assistente/perguntar', { pergunta: 'Qual meu ticket medio?' }, conta.token);
    assert.equal(ticket.status, 200);
    assert.equal(ticket.body.resposta.tipo, 'ticket_medio');

    const empresaB = await post('/api/auth/cadastro', {
        nome: 'Cliente Assistente B',
        email: 'assistente-b@teste.com',
        senha: '123456',
        empresa: 'Empresa Assistente B'
    });
    assert.equal(empresaB.status, 201);

    const bloqueioEmpresa = await post('/api/assistente/perguntar', {
        pergunta: 'Quanto vendi hoje?',
        empresa_id: conta.empresa.id
    }, empresaB.body.token);
    assert.equal(bloqueioEmpresa.status, 200);
    assert.equal(bloqueioEmpresa.body.resposta.tipo, 'faturamento_sem_dados');
    assert.match(bloqueioEmpresa.body.resposta.texto, /Ainda/);

    const contador = await post('/api/contador/cadastro', {
        nome: 'Contador Assistente',
        email: 'contador-assistente@teste.com',
        senha: '123456'
    });
    assert.equal(contador.status, 201);

    const convite = await post('/api/contador/empresarial/convites', {
        email: 'contador-assistente@teste.com',
        nome: 'Contador Assistente'
    }, conta.token);
    assert.equal(convite.status, 201);

    const contadorLogin = await post('/api/contador/login', {
        email: 'contador-assistente@teste.com',
        senha: '123456'
    });
    assert.equal(contadorLogin.status, 200);

    const aceite = await post(`/api/contador/convites/${conta.empresa.id}/aceitar`, {}, contadorLogin.body.token);
    assert.equal(aceite.status, 200);

    const contadorOk = await post('/api/assistente/perguntar', {
        pergunta: 'Qual produto mais lucrativo?',
        empresa_id: conta.empresa.id
    }, contadorLogin.body.token);
    assert.equal(contadorOk.status, 200);
    assert.equal(contadorOk.body.origem, 'contador');
    assert.equal(contadorOk.body.resposta.tipo, 'produto_mais_lucrativo');

    const contadorSemVinculo = await post('/api/assistente/perguntar', {
        pergunta: 'Quanto vendi hoje?',
        empresa_id: empresaB.body.empresa.id
    }, contadorLogin.body.token);
    assert.equal(contadorSemVinculo.status, 403);

    const semToken = await post('/api/assistente/perguntar', { pergunta: 'Quanto vendi hoje?' });
    assert.equal(semToken.status, 401);

    const database = require('../database');
    const auditoria = await database.buscarUm(
        'SELECT COUNT(*) AS total FROM assistente_auditoria WHERE empresa_id = ? AND tipo_resposta = ?',
        [conta.empresa.id, 'faturamento']
    );
    assert.ok(auditoria.total >= 1);

    const tela = await html('/assistente');
    assert.equal(tela.status, 200);
    assert.match(tela.text, /Portal Cloud/);

    const portalJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'cliente', 'portal.js'), 'utf8');
    assert.match(portalJs, /renderAssistente/);
    assert.match(portalJs, /api\/assistente\/perguntar/);
});

test('download do instalador oficial fica disponivel na rota publica', async () => {
    const response = await fetch(`${baseUrl}/download/RealCaixa_Setup_2.1.0.exe`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /application|octet-stream/i);
    assert.ok(Number(response.headers.get('content-length') || 0) > 0);
});

test('download mais recente usa asset da ultima GitHub Release', async () => {
    const { latestInstallerInfo } = require('../server');
    const releaseServer = httpFixture((req, res) => {
        assert.equal(req.url, '/repos/RealCaixa/Real-Caixa/releases/latest');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            tag_name: 'v2.1.1',
            published_at: '2026-06-25T12:00:00.000Z',
            assets: [{
                name: 'RealCaixa_Setup_2.1.1.exe',
                browser_download_url: 'https://github.com/RealCaixa/Real-Caixa/releases/download/v2.1.1/RealCaixa_Setup_2.1.1.exe'
            }]
        }));
    });

    await releaseServer.start();
    const originalUrl = process.env.GITHUB_RELEASES_API_URL;
    process.env.GITHUB_RELEASES_API_URL = `${releaseServer.url}/repos/RealCaixa/Real-Caixa/releases/latest`;

    try {
        const info = await latestInstallerInfo();
        assert.equal(info.version, '2.1.1');
        assert.equal(info.fileName, 'RealCaixa_Setup_2.1.1.exe');
        assert.match(info.url, /releases\/download\/v2\.1\.1/);
        assert.equal(info.source, 'github_release');
    } finally {
        if (originalUrl) {
            process.env.GITHUB_RELEASES_API_URL = originalUrl;
        } else {
            delete process.env.GITHUB_RELEASES_API_URL;
        }
        await releaseServer.close();
    }
});

test('exclusao logica remove produto e categoria das listagens ativas', async () => {
    const { token } = await loginCliente();

    const removido = await del(`/api/produtos/${produtoId}`, token);
    assert.equal(removido.status, 200);
    assert.equal(removido.body.produto.ativo, 0);

    const produtosAtivos = await get('/api/produtos?busca=ACAI500', token);
    assert.equal(produtosAtivos.body.dados.length, 0);

    const categoriaRemovida = await del(`/api/categorias/${categoriaId}`, token);
    assert.equal(categoriaRemovida.status, 200);
    assert.equal(categoriaRemovida.body.categoria.ativo, 0);
});

async function loginCliente() {
    const login = await post('/api/auth/login', {
        email: 'cliente@teste.com',
        senha: '123456'
    });
    assert.equal(login.status, 200);
    return login.body;
}

async function ativarPdvOperacional(conta) {
    const seq = sequenciaPdvOperacional++;
    const filial = await post('/api/filiais', {
        nome: `Filial Operacional ${seq}`,
        cidade: 'Sao Paulo'
    }, conta.token);
    assert.equal(filial.status, 201);

    const ativacao = await post('/api/pdvs/registrar', {
        cnpj: conta.empresa.documento || '12.345.678/0001-90',
        codigo_licenca: String(conta.licenca.id),
        filial_id: filial.body.filial.id,
        nome_pdv: `PDV Operacional ${seq}`,
        codigo_pdv: `OPER-PDV-${seq}`,
        machine_id: `MACHINE-OPER-${seq}`,
        versao_app: '2.5.0'
    });
    assert.equal(ativacao.status, 201);

    return {
        id: ativacao.body.pdv.id,
        codigo_pdv: ativacao.body.pdv.codigo_pdv,
        filial_id: filial.body.filial.id,
        device_token: ativacao.body.device_token
    };
}

async function post(url, body, token) {
    const response = await fetch(`${baseUrl}${url}`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify(body)
    });
    return parse(response);
}

async function put(url, body, token) {
    const response = await fetch(`${baseUrl}${url}`, {
        method: 'PUT',
        headers: headers(token),
        body: JSON.stringify(body)
    });
    return parse(response);
}

async function del(url, token) {
    const response = await fetch(`${baseUrl}${url}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parse(response);
}

async function get(url, token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${baseUrl}${url}`, { headers });
    return parse(response);
}

async function getDevice(url, deviceToken) {
    const response = await fetch(`${baseUrl}${url}`, {
        headers: { Authorization: `Device ${deviceToken}` }
    });
    return parse(response);
}

async function postDevice(url, body, deviceToken) {
    const response = await fetch(`${baseUrl}${url}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Device ${deviceToken}`
        },
        body: JSON.stringify(body)
    });
    return parse(response);
}

async function html(url) {
    const response = await fetch(`${baseUrl}${url}`);
    return {
        status: response.status,
        text: await response.text()
    };
}

function headers(token) {
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

async function parse(response) {
    return {
        status: response.status,
        body: await response.json()
    };
}

function httpFixture(handler) {
    const fixture = {
        server: null,
        url: null,
        async start() {
            this.server = require('http').createServer(handler);
            await new Promise((resolve) => this.server.listen(0, '127.0.0.1', resolve));
            const { port } = this.server.address();
            this.url = `http://127.0.0.1:${port}`;
        },
        async close() {
            if (this.server) {
                await new Promise((resolve) => this.server.close(resolve));
            }
        }
    };

    return fixture;
}

function criarStorageMemoria() {
    let ativacao = null;
    return {
        async obterAtivacao() {
            return ativacao ? { ...ativacao } : null;
        },
        async salvarAtivacao(proxima) {
            ativacao = { ...proxima };
            return ativacao;
        },
        async removerAtivacao() {
            ativacao = null;
        }
    };
}
