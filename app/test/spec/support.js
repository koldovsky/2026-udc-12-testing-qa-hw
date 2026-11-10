// Helpers for the spec-based tests. Not a test file (no `.test.js`), so `npm test` skips it.
// Expected values live in the tests and come from docs/test-cases.md and docs/spec/tariffs.md.

export const DAY = "2026-09-16";
export const NEXT_DAY = "2026-09-17";

/** Kyiv wall-clock time in September (EEST, +03:00) as an ISO 8601 instant. */
export function kyiv(time, date = DAY) {
  const hhmmss = time.length === 5 ? `${time}:00` : time;
  return `${date}T${hhmmss}+03:00`;
}

/** A ride; `from`/`to` are "HH:MM[:SS]" on DAY unless given as full ISO strings or [time, date]. */
export function ride(from, to, { bike = "classic", station = "S01" } = {}) {
  const at = (v) => (Array.isArray(v) ? kyiv(v[0], v[1]) : v.includes("T") ? v : kyiv(v));
  return { pickupAt: at(from), returnAt: at(to), bike, returnStation: station };
}

export function rider(type = "standard", extra = {}) {
  return { id: "rider-1", type, ...extra };
}
