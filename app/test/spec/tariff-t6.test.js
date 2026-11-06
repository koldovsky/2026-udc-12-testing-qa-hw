// T6 — daily cap: 300 грн / day per rider, keyed by Kyiv calendar date
// Expected values: docs/test-cases.md, docs/spec/tariffs.md
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";
import { rideTC41 } from "../helpers/day-cap-state.js";

const standard = (id) => ({ id, type: "standard" });
const ride = (pickupAt, returnAt, bike = "classic", returnStation = "S01") =>
  ({ pickupAt, returnAt, bike, returnStation });

// rideTC41 (test/helpers/day-cap-state.js): the three TC-41 e-bike rides (09:00, 13:00,
// 18:00 Kyiv on 2026-09-16, 80 min each); follow-up tests build on the ledger it returns.

// TC-41: three sequential 80-min ebike rides exhaust the daily cap (spec:tariffs.md:105)
test("T6: TC-41 — three ebike rides of 80 min exhaust 300 грн daily cap", () => {
  const { quotes } = rideTC41("rider-tc41a");
  const expected = [12000, 12000, 6000]; // 120 + 120 + 60 = 300 грн
  for (let i = 0; i < 3; i++) {
    assert.equal(quotes[i].total, expected[i], `TC-41 ride ${i + 1}`);
  }
});

// TC-42: after TC-41 cap is exhausted; next ride on same day costs 0 (spec:tariffs.md:100)
test("T6: TC-42 — cap exhausted: same-day ride costs zero", () => {
  const { dayCap, rider } = rideTC41("rider-tc42");
  const r = quote(ride("2026-09-16T20:00:00+03:00", "2026-09-16T20:20:00+03:00"), rider, { dayCap });
  assert.equal(r.total, 0, "TC-42");
});

// TC-43: out-of-zone fee not limited by cap (spec:tariffs.md:103)
test("T6: TC-43 — out-of-zone fee bypasses daily cap", () => {
  const { dayCap, rider } = rideTC41("rider-tc43");
  // time charge capped at 0; out-of-zone fee 15000 still applies
  const r = quote(ride("2026-09-16T20:00:00+03:00", "2026-09-16T20:20:00+03:00", "classic", "X03"), rider, { dayCap });
  assert.equal(r.total, 15000, "TC-43");
});

// TC-44: pickup at 23:59:59 Kyiv same day → belongs to 16.09, cap exhausted → 0 (spec:tariffs.md:101)
test("T6: TC-44 — pickup at 23:59:59 Kyiv still belongs to same day; cap exhausted → 0", () => {
  const { dayCap, rider } = rideTC41("rider-tc44");
  // 2026-09-16T20:59:59Z = 2026-09-16T23:59:59+03:00 (Kyiv)
  const r = quote(ride("2026-09-16T20:59:59Z", "2026-09-16T21:20:00Z"), rider, { dayCap });
  assert.equal(r.total, 0, "TC-44");
});

// TC-45: pickup at 00:00:00 Kyiv next day (17.09) — new day, cap reset + night discount (spec:tariffs.md:34)
test("T6: TC-45 — pickup at 00:00 Kyiv starts new day; fresh cap + night discount → 1750", () => {
  const { dayCap, rider } = rideTC41("rider-tc45");
  // 2026-09-16T21:00:00Z = 2026-09-17T00:00:00+03:00 (Kyiv) — new Kyiv calendar day
  const r = quote(ride("2026-09-16T21:00:00Z", "2026-09-16T21:30:00Z"), rider, { dayCap });
  assert.equal(r.total, 1750, "TC-45: 2500 − 30 % night, fresh cap");
});

// TC-46 / TC-47: EET (UTC+2) — same logic holds for winter time (spec:tariffs.md:101,34)
test("T6: TC-46 TC-47 — EET (UTC+2): Kyiv calendar day boundary at 22:00Z", () => {
  const riderId  = "rider-tc46-47";
  const dayCap46 = createDayCap();
  const dayCap47 = createDayCap();
  const rider    = standard(riderId);

  // Three 80-min ebike rides on 27.10.2026 (09:00, 13:00, 18:00 EET = 07:00Z, 11:00Z, 16:00Z)
  for (const pu of ["2026-10-27T07:00:00Z", "2026-10-27T11:00:00Z", "2026-10-27T16:00:00Z"]) {
    const ret = new Date(Date.parse(pu) + 80 * 60_000).toISOString();
    quote(ride(pu, ret, "ebike"), rider, { dayCap: dayCap46 });
    quote(ride(pu, ret, "ebike"), rider, { dayCap: dayCap47 });
  }

  // TC-46: 4th ride pickup 2026-10-27T21:59:00Z = 23:59 Kyiv Oct 27 → same day, cap exhausted → 0
  const r46 = quote(ride("2026-10-27T21:59:00Z", "2026-10-27T22:20:00Z"), rider, { dayCap: dayCap46 });
  assert.equal(r46.total, 0, "TC-46");

  // TC-47: 4th ride pickup 2026-10-27T22:00:00Z = 00:00 Kyiv Oct 28 → new day + night → 1750
  const r47 = quote(ride("2026-10-27T22:00:00Z", "2026-10-27T22:30:00Z"), rider, { dayCap: dayCap47 });
  assert.equal(r47.total, 1750, "TC-47: new Kyiv day, 2500 − 30 %");
});

// TC-48: reduced fare; cap applies to post-discount amount (spec:tariffs.md:100)
test("T6: TC-48 — reduced fare: cap on post-discount time charge; three rides 17.09", () => {
  const dayCap = createDayCap();
  const rider  = { id: "rider-tc48", type: "reduced" };
  const cases = [
    // 600 min → 20 blocks = 50000 − 50% = 25000 ≤ cap → 25000
    { id: "TC-48 ride 1", pu: "2026-09-17T08:00:00+03:00", ret: "2026-09-17T18:00:00+03:00", exp: 25000 },
    // 120 min → 4 blocks = 10000 − 50% = 5000 → cap rem = 5000 → 5000
    { id: "TC-48 ride 2", pu: "2026-09-17T19:00:00+03:00", ret: "2026-09-17T21:00:00+03:00", exp: 5000  },
    // 30 min → 2500 − 50% = 1250 → cap rem = 0 → 0
    { id: "TC-48 ride 3", pu: "2026-09-17T21:30:00+03:00", ret: "2026-09-17T22:00:00+03:00", exp: 0     },
  ];
  for (const { id, pu, ret, exp } of cases) {
    const r = quote(ride(pu, ret), rider, { dayCap });
    assert.equal(r.total, exp, id);
  }
});

// TC-49: subscriber; cap applies after subscription discount (spec:tariffs.md:100)
test("T6: TC-49 — subscriber: 480 min → 435 paid min → 15 blocks → 37500 → cap → 30000", () => {
  const dayCap = createDayCap();
  const rider  = { id: "rider-tc49", type: "subscriber" };
  const r = quote(ride("2026-09-17T08:00:00+03:00", "2026-09-17T16:00:00+03:00"), rider, { dayCap });
  assert.equal(r.total, 30000, "TC-49");
});

// TC-50, TC-51: cap boundary at exactly 300 грн (spec:tariffs.md:100)
test("T6: TC-50 TC-51 — 300 грн boundary: at-limit and over-limit", () => {
  for (const { id, returnAt, exp } of [
    // 360 min → 12 blocks = 30000 = cap → 30000
    { id: "TC-50", returnAt: "2026-09-17T16:00:00+03:00", exp: 30000 },
    // 361 min → 13 blocks = 32500 → cap → 30000
    { id: "TC-51", returnAt: "2026-09-17T16:01:00+03:00", exp: 30000 },
  ]) {
    const dayCap = createDayCap();
    const rider  = { id: `rider-${id}`, type: "standard" };
    const r = quote(ride("2026-09-17T10:00:00+03:00", returnAt), rider, { dayCap });
    assert.equal(r.total, exp, id);
  }
});

// TC-52: cap is per rider — a different rider is unaffected (spec:tariffs.md:100)
test("T6: TC-52 — daily cap is per rider; second rider's cap is independent", () => {
  // User A exhausts the cap (run TC-41 state)
  const { dayCap } = rideTC41("rider-tc52-A");
  // User B: unaffected by user A's cap
  const riderB = standard("rider-tc52-B");
  const r = quote(ride("2026-09-16T20:00:00+03:00", "2026-09-16T20:30:00+03:00"), riderB, { dayCap });
  assert.equal(r.total, 2500, "TC-52: user B pays 2500");
});
