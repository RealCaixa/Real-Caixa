const DEV_JWT_SECRET = 'real-caixa-local-dev-secret-only';

function jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;

    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET deve ser definido em producao.');
    }

    return DEV_JWT_SECRET;
}

function jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || '8h';
}

module.exports = {
    jwtSecret,
    jwtExpiresIn
};
