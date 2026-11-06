// T7 — out-of-zone fee, T8 — unreturned bike fee
// Expected values: docs/test-cases.md, docs/spec/tariffs.md
import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";
import { rideTC41 } from "../helpers/day-cap-state.js";

const standard    = { type: "standard" };
const subscriber  = { type: "subscriber" };
const ride = (pickupAt, returnAt, bike = "classic", returnStation = "S01") =>
  ({ pickupAt, returnAt, bike, returnStation });

// T7 — TC-53 to TC-55: each out-of-zone station adds 150 грн fee (spec:tariffs.md:114,175,176)
test("T7: TC-53 to TC-55 — out-of-zone stations X01, X02, X03 each trigger 15000 fee", () => {
  for (const { id, station } of [
    { id: "TC-53", station: "X01" },
    { id: "TC-54", station: "X02" },
    { id: "TC-55", station: "X03" },
  ]) {
    const r = quote(
      ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:20:00+03:00", "classic", station),
      standard,
    );
    // 20 min → 1 block = 2500; + out-of-zone fee 15000 → 17500
    assert.equal(r.total, 17500, `${id}: ${station}`);
  }
});

// T7 — TC-56: in-zone station — no fee (spec:tariffs.md:173)
test("T7: TC-56 — in-zone return: no out-of-zone fee", () => {
  const r = quote(
    ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:20:00+03:00", "classic", "S08"),
    standard,
  );
  assert.equal(r.total, 2500, "TC-56: S08 is in zone, 1 block only");
});

// T7 — TC-57: subscriber + out-of-zone — time charge 0, fee still 15000 (spec:tariffs.md:111)
test("T7: TC-57 — subscriber, 40 min classic + X01: free ride but fee applies", () => {
  const r = quote(
    ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:40:00+03:00", "classic", "X01"),
    subscriber,
  );
  // 40 min ≤ 45 free → timeCharge = 0; out-of-zone fee 15000 unchanged
  assert.equal(r.total, 15000, "TC-57");
});

// T7 — TC-58: out-of-zone + night — night discount on time charge only (spec:tariffs.md:141)
test("T7: TC-58 — night discount applies only to time charge, not to out-of-zone fee", () => {
  // 01:10–01:40 Kyiv → 30 min → 2500 − 30% = 1750; + fee 15000 → 16750
  const r = quote(
    ride("2026-09-16T01:10:00+03:00", "2026-09-16T01:40:00+03:00", "classic", "X02"),
    standard,
  );
  assert.equal(r.total, 16750, "TC-58: 1750 + 15000");
});

// T8 — TC-59: 25-hour ride — time charge capped + unreturned fee (spec:tariffs.md:124)
test("T8: TC-59 — 25-hour ride: time charge hit cap 30000 + unreturned 200000 → 230000", () => {
  const r = quote(
    { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-17T11:00:00+03:00", bike: "classic", returnStation: "S01" },
    standard,
  );
  assert.equal(r.total, 230000, "TC-59");
});

// T8 — TC-60, TC-61, TC-62: 24 h boundary (spec:tariffs.md:119)
test("T8: TC-60 to TC-62 — 24-hour boundary for unreturned-bike fee", () => {
  for (const { id, returnAt, expTotal } of [
    // exactly 24 h → NOT "over 24 h" → no fee; 48 blocks = 120000 → cap → 30000
    { id: "TC-60", returnAt: "2026-09-17T10:00:00+03:00", expTotal: 30000  },
    // 24 h 1 s → 1441 min > 1440 → fee; 30000 + 200000
    { id: "TC-61", returnAt: "2026-09-17T10:00:01+03:00", expTotal: 230000 },
    // 24 h 1 min → fee; 30000 + 200000
    { id: "TC-62", returnAt: "2026-09-17T10:01:00+03:00", expTotal: 230000 },
  ]) {
    const r = quote(
      { pickupAt: "2026-09-16T10:00:00+03:00", returnAt, bike: "classic", returnStation: "S01" },
      standard,
    );
    assert.equal(r.total, expTotal, id);
  }
});

// T8 — TC-63: 25-hour ride + out-of-zone — both fees apply (spec:tariffs.md:121)
test("T8: TC-63 — 25-hour ride + X01: cap 30000 + out-of-zone 15000 + unreturned 200000 → 245000", () => {
  const r = quote(
    { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-17T11:00:00+03:00", bike: "classic", returnStation: "X01" },
    standard,
  );
  assert.equal(r.total, 245000, "TC-63");
});

// T8 — TC-64: subscriber + 25-hour ride (spec:tariffs.md:120)
test("T8: TC-64 — subscriber 25-hour ride: 49 paid blocks → cap 30000 + unreturned 200000", () => {
  const r = quote(
    { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-17T11:00:00+03:00", bike: "classic", returnStation: "S01" },
    subscriber,
  );
  assert.equal(r.total, 230000, "TC-64");
});

// T8 — TC-65: cap exhausted on day of pickup; unreturned fee not capped (spec:tariffs.md:103)
test("T8: TC-65 — cap exhausted (after TC-41) + unreturned fee: time 0, fee 200000", () => {
  const { dayCap, rider } = rideTC41("rider-tc65");

  const r = quote(
    { pickupAt: "2026-09-16T20:00:00+03:00", returnAt: "2026-09-17T21:00:00+03:00", bike: "classic", returnStation: "S01" },
    rider,
    { dayCap },
  );
  assert.equal(r.total, 200000, "TC-65: time 0 (cap exhausted) + unreturned 200000");
});
