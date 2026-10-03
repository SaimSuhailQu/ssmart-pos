/**
 * IPC argument guards (main process).
 *
 * Every value that crosses the IPC boundary originates from the renderer —
 * treat it as untrusted. These tiny helpers throw descriptive Errors (which
 * surface to the renderer as rejected invokes) when an argument has the
 * wrong shape, keeping malformed input from ever reaching SQLite.
 *
 * Usage inside a handler:
 *   ipcMain.handle('delete-product', (_event, id: unknown) =>
 *     deleteProduct(vInt(id, 'id', { min: 1 })));
 */

export interface IntOpts {
  min?: number;
  max?: number;
}

export function vInt(v: unknown, name: string, opts: IntOpts = {}): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    throw new Error(`Invalid ${name}: expected an integer.`);
  }
  if (opts.min !== undefined && n < opts.min) throw new Error(`Invalid ${name}: below minimum.`);
  if (opts.max !== undefined && n > opts.max) throw new Error(`Invalid ${name}: above maximum.`);
  return n;
}

export function vNum(v: unknown, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${name}: expected a number.`);
  return n;
}

export function vStr(v: unknown, name: string, maxLen = 500): string {
  if (typeof v !== 'string') throw new Error(`Invalid ${name}: expected a string.`);
  const s = v.trim();
  if (s.length > maxLen) throw new Error(`Invalid ${name}: too long (max ${maxLen}).`);
  return s;
}

export function vOptStr(v: unknown, name: string, maxLen = 500): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return vStr(v, name, maxLen);
}

export function vObj<T extends Record<string, unknown>>(v: unknown, name: string): T {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error(`Invalid ${name}: expected an object.`);
  }
  return v as T;
}

export function vArr<T>(v: unknown, name: string, maxLen = 5000): T[] {
  if (!Array.isArray(v)) throw new Error(`Invalid ${name}: expected an array.`);
  if (v.length > maxLen) throw new Error(`Invalid ${name}: too many items.`);
  return v as T[];
}
