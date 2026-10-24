// Pure sale-timestamp -> epoch-millis parser, shared by the backfill script.
// Mirrors parseSaleTimestampToEpochMs in src/syncEngine.ts — keep the two
// in sync. Rules (see that function for the full reasoning):
// - Space-separated "YYYY-MM-DD HH:MM:SS": SQLite CURRENT_TIMESTAMP /
//   toISOString-derived strings — UTC wall clock.
// - ISO WITHOUT offset (mobile local wall clock): Asia/Karachi (UTC+5).
// - ISO WITH offset/Z: exact via Date.parse.
// - Epoch numbers/strings: seconds (< 1e12) vs millis.
// Returns null when unparseable — callers omit `ts`, never guess.
export function parseSaleTimestampToEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return n > 1e12 ? n : n * 1000;
  }
  const space =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(trimmed);
  if (space) {
    const [, y, mo, d, h, mi, sec, ms] = space;
    return Date.UTC(
      Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi),
      Number(sec || 0), Number((ms || '0').padEnd(3, '0')),
    );
  }
  const isoNoOffset =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(trimmed);
  if (isoNoOffset) {
    const [, y, mo, d, h, mi, sec, ms] = isoNoOffset;
    return (
      Date.UTC(
        Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi),
        Number(sec || 0), Number((ms || '0').padEnd(3, '0')),
      ) -
      5 * 3600 * 1000
    );
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}
