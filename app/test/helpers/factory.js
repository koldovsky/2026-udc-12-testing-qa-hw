// Test data: rides and riders with fixed, explicit defaults — no randomness.
// A test overrides every value its expectation depends on. The defaults are chosen so that
// no other rule applies:
//   pickup 2026-09-21T06:00:00Z = 09:00 in Kyiv (EEST) — daytime, no night discount (T10);
//   return station S01 — in the zone, no fee (T7, додаток А);
//   standard rider — no subscription or reduced fare (T4, T5).

export function ride(overrides = {}) {
  return {
    pickupAt: "2026-09-21T06:00:00Z",
    returnAt: "2026-09-21T06:20:00Z",
    bike: "classic",
    returnStation: "S01",
    ...overrides,
  };
}

export function rider(overrides = {}) {
  return { id: "rider-1001", type: "standard", ...overrides };
}
