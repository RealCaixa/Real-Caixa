function montarPromptInterno({ pergunta, contexto }) {
    return {
        papel: 'assistente_empresarial_real_caixa',
        politica: 'Responder somente com dados da empresa autorizada. Nao usar API externa nesta fase.',
        pergunta,
        contexto
    };
}

module.exports = {
    montarPromptInterno
};
