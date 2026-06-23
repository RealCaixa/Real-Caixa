const LEVELS = ['debug', 'info', 'warn', 'error'];
const CURRENT_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level) {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(CURRENT_LEVEL);
}

function write(level, message, meta) {
    if (!shouldLog(level)) return;
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
    const output = meta === undefined ? [line] : [line, meta];
    if (level === 'error') {
        console.error(...output);
    } else if (level === 'warn') {
        console.warn(...output);
    } else {
        console.log(...output);
    }
}

module.exports = {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta)
};
