import process from 'node:process';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const configured = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
const threshold = LEVELS[configured] ?? LEVELS.info;

/** Structured JSON logging — cheap to produce, easy to ship to any log tool. */
export function log(level, message, fields = {}) {
  if ((LEVELS[level] ?? LEVELS.info) < threshold) return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    msg: message,
    ...fields,
  });
  (level === 'error' ? process.stderr : process.stdout).write(`${line}\n`);
}

export const logger = {
  debug: (message, fields) => log('debug', message, fields),
  info: (message, fields) => log('info', message, fields),
  warn: (message, fields) => log('warn', message, fields),
  error: (message, fields) => log('error', message, fields),
};

export default logger;
