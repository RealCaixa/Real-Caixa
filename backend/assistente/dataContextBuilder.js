const metrics = require('./metricsService');

async function construirContexto({ empresaId, periodo }) {
    const periodoNormalizado = metrics.normalizarPeriodo(periodo);
    return {
        empresa_id: empresaId,
        gerado_em: new Date().toISOString(),
        indicadores: await metrics.indicadoresEmpresa(empresaId, periodoNormalizado)
    };
}

module.exports = {
    construirContexto
};
