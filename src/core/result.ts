/**
 * Result<T, E> — explicit success/failure without exceptions.
 *
 * Used at I/O boundaries (file system, Firebase, printers, HTTP) so callers
 * must decide what to do with failure instead of letting it bubble as an
 * unhandled rejection and take the UI down with it.
 *
 *   const res = await tryCatch(() => readFileSync(path, 'utf8'));
 *   if (!res.ok) return showBanner(`Could not read file: ${res.error.message}`);
 *   const text = res.value;
 */

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Wrap a success value. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** Wrap a failure. Accepts anything; non-Error values are normalized. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** True when the result is a success. Narrows the type for `value`. */
export const isOk = <T, E>(r: Result<T, E>): r is { ok: true; value: T } => r.ok;

/** True when the result is a failure. Narrows the type for `error`. */
export const isErr = <T, E>(r: Result<T, E>): r is { ok: false; error: E } => !r.ok;

/**
 * Run a sync or async function, converting throws into `err`.
 * Never rethrows. `undefined`/`null` throws become Error objects with context.
 */
export function tryCatch<T>(fn: () => T): Result<T, Error>;
export function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T, Error>>;
export function tryCatch<T>(
  fn: () => T | Promise<T>,
): Result<T, Error> | Promise<Result<T, Error>> {
  try {
    const out = fn();
    if (out instanceof Promise) {
      return out.then(
        (value) => ok(value),
        (e: unknown) => err(normalizeError(e)),
      );
    }
    return ok(out);
  } catch (e: unknown) {
    return err(normalizeError(e));
  }
}

/** Coerce an unknown thrown value into a real Error with a message. */
export function normalizeError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (typeof e === 'string') return new Error(e);
  try {
    return new Error(JSON.stringify(e));
  } catch {
    return new Error(String(e));
  }
}

/** Extract the value, or fall back. For sites where failure has a safe default. */
export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

/** Transform the success value; failures pass through untouched. */
export function mapResult<T, U, E>(r: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : err(r.error);
}

/** Human-readable description for logging and user-facing banners. */
export function resultMessage<T, E>(r: Result<T, E>, fallback = 'Unknown error'): string {
  if (r.ok) return 'ok';
  const e = r.error as unknown;
  if (e instanceof Error) return e.message || fallback;
  return String(e) || fallback;
}
