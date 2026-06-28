const bcrypt = require('bcryptjs');
const { transacao } = require('../database');
const empresas = require('../empresas/repository');
const licencas = require('../licencas/repository');
const usuarios = require('../users/repository');
const { gerarToken } = require('./jwt');

async function cadastrarCliente(payload) {
    const nome = limpar(payload.nome);
    const email = usuarios.normalizarEmail(payload.email);
    const senha = String(payload.senha || '');
    const nomeEmpresa = limpar(payload.empresa || payload.nomeEmpresa);
    const documento = limpar(payload.documento || payload.cnpj);
    const telefone = limpar(payload.telefone);
    const plano = payload.plano === 'profissional' ? 'profissional' : 'basico';

    if (!nome || !email || !senha || !nomeEmpresa) {
        const error = new Error('Nome, email, senha e empresa sao obrigatorios.');
        error.status = 400;
        throw error;
    }

    if (senha.length < 6) {
        const error = new Error('A senha deve ter pelo menos 6 caracteres.');
        error.status = 400;
        throw error;
    }

    if (await usuarios.buscarUsuarioPorEmail(email)) {
        const error = new Error('Este email ja esta cadastrado.');
        error.status = 409;
        throw error;
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const resultado = await transacao(async () => {
        const empresa = await empresas.criarEmpresa({
            nomeFantasia: nomeEmpresa,
            documento,
            telefone,
            email
        });
        const licenca = await licencas.criarLicenca({ empresaId: empresa.id, plano });
        const usuario = await usuarios.criarUsuario({
            empresaId: empresa.id,
            nome,
            email,
            senhaHash,
            perfil: 'cliente_admin',
            permissoes: [
                'dashboard:ver',
                'empresa:gerenciar',
                'usuarios:gerenciar',
                'licenca:ver'
            ]
        });

        return { empresa, licenca, usuario };
    });

    const token = gerarToken(resultado.usuario);
    return montarSessao(resultado.usuario, resultado.empresa, resultado.licenca, token);
}

async function loginCliente({ email, senha }) {
    const usuario = await usuarios.buscarUsuarioPorEmail(email);

    if (!usuario || usuario.status !== 'ativo') {
        const error = new Error('Email ou senha invalidos.');
        error.status = 401;
        throw error;
    }

    const senhaValida = await bcrypt.compare(String(senha || ''), usuario.senha_hash);
    if (!senhaValida) {
        const error = new Error('Email ou senha invalidos.');
        error.status = 401;
        throw error;
    }

    await usuarios.registrarUltimoLogin(usuario.id);
    const atualizado = await usuarios.buscarUsuarioPorId(usuario.id);
    const token = gerarToken(atualizado);

    return montarSessao(
        atualizado,
        { id: atualizado.empresa_id, nome_fantasia: atualizado.empresa_nome },
        await licencas.buscarLicencaPorEmpresa(atualizado.empresa_id),
        token
    );
}

function montarSessao(usuario, empresa, licenca, token) {
    return {
        token,
        usuario: usuarioSeguro(usuario),
        empresa: empresaSeguro(empresa),
        licenca: licencaSeguro(licenca)
    };
}

function usuarioSeguro(usuario) {
    return {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        empresa_id: usuario.empresa_id,
        plano: usuario.plano || 'basico'
    };
}

function empresaSeguro(empresa) {
    return {
        id: empresa.id,
        nome: empresa.nome_fantasia || empresa.empresa_nome || empresa.nome,
        documento: empresa.documento || null,
        status: empresa.status || 'ativa'
    };
}

function licencaSeguro(licenca) {
    return {
        id: licenca?.id || null,
        codigo_licenca: licenca?.codigo_licenca || null,
        plano: licenca?.plano || 'basico',
        status: licenca?.status || 'ativa',
        limite_usuarios: licenca?.limite_usuarios || 1,
        limite_produtos: licenca?.limite_produtos || 50,
        limite_vendas_mes: licenca?.limite_vendas_mes || 100,
        limite_pdvs: licenca?.limite_pdvs || 1,
        limite_filiais: licenca?.limite_filiais || 1,
        expira_em: licenca?.expira_em || null,
        created_at: licenca?.created_at || null
    };
}

function limpar(value) {
    return String(value || '').trim();
}

module.exports = {
    cadastrarCliente,
    loginCliente,
    usuarioSeguro,
    empresaSeguro,
    licencaSeguro
};
