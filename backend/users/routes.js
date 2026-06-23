const express = require('express');
const { autenticar, exigirPermissao } = require('../auth/middleware');
const { buscarEmpresaPorId } = require('../empresas/repository');
const { buscarLicencaPorEmpresa } = require('../licencas/repository');
const { buscarUm } = require('../database');
const estoque = require('../estoque/repository');
const pdvs = require('../pdvs/repository');

const router = express.Router();
const MODULOS = new Set([
    'produtos',
    'categorias',
    'estoque',
    'financeiro',
    'relatorios',
    'assistente',
    'pdvs',
    'sincronizacao',
    'usuarios',
    'permissoes',
    'licenca',
    'filiais',
    'configuracoes'
]);

router.get('/dashboard', autenticar, exigirPermissao('dashboard:ver'), async (req, res) => {
    const empresa = await buscarEmpresaPorId(req.user.empresa_id);
    const licenca = await buscarLicencaPorEmpresa(req.user.empresa_id);
    const produtos = (await buscarUm(
        'SELECT COUNT(*) AS total FROM produtos WHERE empresa_id = ? AND ativo = 1',
        [req.user.empresa_id]
    ))?.total || 0;
    const estoqueBaixo = (await buscarUm(
        'SELECT COUNT(*) AS total FROM produtos WHERE empresa_id = ? AND ativo = 1 AND estoque_atual <= estoque_minimo',
        [req.user.empresa_id]
    ))?.total || 0;
    const estoqueIndicadores = await estoque.indicadores(req.user.empresa_id);
    const multiempresa = await pdvs.indicadores(req.user.empresa_id);

    res.json({
        usuario: req.user,
        empresa: {
            id: empresa.id,
            nome: empresa.nome_fantasia,
            documento: empresa.documento,
            status: empresa.status
        },
        licenca: {
            plano: licenca?.plano || 'basico',
            status: licenca?.status || 'ativa',
            limite_produtos: licenca?.limite_produtos || 50,
            limite_vendas_mes: licenca?.limite_vendas_mes || 100
        },
        indicadores: {
            vendas_dia: 0,
            vendas_mes: 0,
            ticket_medio: 0,
            produtos_cadastrados: produtos,
            estoque_baixo: estoqueBaixo,
            produtos_sem_estoque: estoqueIndicadores.produtos_sem_estoque,
            produtos_abaixo_minimo: estoqueIndicadores.produtos_abaixo_minimo,
            produtos_criticos: estoqueIndicadores.produtos_criticos,
            total_itens_cadastrados: estoqueIndicadores.total_itens_cadastrados,
            operadores_ativos: 1,
            pdvs_conectados: 0,
            vendas_hoje: 0,
            produtos,
            total_filiais: multiempresa.total_filiais,
            pdvs_ativos: multiempresa.pdvs_ativos,
            pdvs_offline: multiempresa.pdvs_offline,
            ultima_sincronizacao: multiempresa.ultima_sincronizacao
        },
        proximos_passos: [
            'Configurar dados da empresa',
            'Preparar cadastro de produtos',
            'Conectar o PDV desktop quando a sincronizacao for habilitada'
        ]
    });
});

router.get('/modulos/:modulo', autenticar, exigirPermissao('dashboard:ver'), (req, res) => {
    const modulo = req.params.modulo;

    if (!MODULOS.has(modulo)) {
        return res.status(404).json({ erro: 'Modulo nao encontrado.' });
    }

    res.json({
        modulo,
        status: 'estrutura_pronta',
        protegido: true,
        regras_negocio: false,
        sincronizacao: false
    });
});

module.exports = router;
