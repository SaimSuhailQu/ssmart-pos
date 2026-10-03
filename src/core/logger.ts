/**
 * Logger — structured, scoped logging with secret redaction.
 *
 * Rules:
 *  - `debug` is compiled out of production builds (Vite define).
 *  - Never log PINs, tokens, license keys, or full fingerprints.
 *    `redact()` scrubs known-sensitive keys from logged objects.
 *  - Renderer code should prefer this over raw console.* so log volume
 *    stays greppable: `[scope] message {json}`.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = /(pin|password|passwd|token|secret|license[_-]?key|api[_-]?key|fingerprint|auth)/i;

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Truncate long hex-looking blobs (hashes, keys) to a prefix.
    return value.length > 48 && /^[0-9a-fA-F]+$/.test(value)
      ? `${value.slice(0, 8)}…<redacted:${value.length}>`
      : value;
  }
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) ? '<redacted>' : redactValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

function emit(level: LogLevel, scope: string, message: string, data?: unknown): void {
  if (level === 'debug' && isProd) return;
  const payload = data === undefined ? '' : ` ${JSON.stringify(redactValue(data))}`;
  const line = `[${scope}] ${message}${payload}`;
  switch (level) {
    case 'debug':
      console.debug(line);
      break;
    case 'info':
      console.info(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
  }
}

export interface ScopedLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/** Create a logger bound to a subsystem, e.g. `createLogger('licensing')`. */
export function createLogger(scope: string): ScopedLogger {
  return {
    debug: (message, data) => emit('debug', scope, message, data),
    info: (message, data) => emit('info', scope, message, data),
    warn: (message, data) => emit('warn', scope, message, data),
    error: (message, data) => emit('error', scope, message, data),
  };
}

/** Default application logger. Prefer a scoped one per module. */
export const logger = createLogger('app');
