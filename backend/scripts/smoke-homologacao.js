const DEFAULT_BASE_URL = 'http://localhost:3000';

const baseUrl = normalizeBaseUrl(
    process.env.SMOKE_BASE_URL ||
    process.env.HOMOLOGACAO_URL ||
    DEFAULT_BASE_URL
);

async function main() {
    const results = [];

    results.push(await checkJson('GET', '/api/health', null, [200], (body) => {
        assert(body.status === 'online', 'health deve retornar status online');
        assert(Boolean(body.database_provider), 'health deve informar database_provider');
    }));

    results.push(await checkHtml('GET', '/cadastro', [200]));
    results.push(await checkHtml('GET', '/login', [200]));
    results.push(await checkHtml('GET', '/dashboard', [200]));

    results.push(await checkJson('POST', '/api/licenca/verificar', {
        cnpj: '00.000.000/0000-00',
        codigo_licenca: 'SMOKE-INVALIDO'
    }, [404]));

    results.push(await checkJson('POST', '/api/pdvs/heartbeat', {
        pdv_id: 0,
        versao_app: 'smoke',
        status: 'online'
    }, [401, 404], null, {
        Authorization: 'Device smoke-invalid-device-token'
    }));

    const failed = results.filter((item) => !item.ok);
    results.forEach((item) => {
        const marker = item.ok ? 'OK' : 'FALHA';
        console.log(`[${marker}] ${item.method} ${item.path} -> ${item.status || item.error}`);
    });

    if (failed.length) {
        process.exitCode = 1;
        return;
    }

    console.log(`Smoke homologacao concluido em ${baseUrl}`);
}

async function checkHtml(method, path, expectedStatuses) {
    return request({ method, path, expectedStatuses, expectJson: false });
}

async function checkJson(method, path, body, expectedStatuses, validate, headers = {}) {
    return request({ method, path, body, expectedStatuses, validate, headers, expectJson: true });
}

async function request({ method, path, body = null, expectedStatuses, validate = null, headers = {}, expectJson }) {
    try {
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers: {
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                ...headers
            },
            body: body ? JSON.stringify(body) : undefined
        });

        const contentType = response.headers.get('content-type') || '';
        const payload = expectJson && contentType.includes('application/json')
            ? await response.json()
            : await response.text();

        assert(expectedStatuses.includes(response.status), `status esperado ${expectedStatuses.join('/')} recebido ${response.status}`);
        if (validate) validate(payload);

        return { ok: true, method, path, status: response.status };
    } catch (error) {
        return { ok: false, method, path, error: error.message };
    }
}

function normalizeBaseUrl(value) {
    return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
