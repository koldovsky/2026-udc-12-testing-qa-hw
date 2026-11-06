// T1 — ride duration, T2 — false start, T3 — time charge
// Expected values: docs/test-cases.md, docs/spec/tariffs.md
import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";

const standard = { type: "standard" };
const ride = (pickupAt, returnAt, bike = "classic", returnStation = "S01") =>
  ({ pickupAt, returnAt, bike, returnStation });

// T1 — TC-01 to TC-04: duration rounds up (ceiling), not rounds
test("T1: TC-01 to TC-04 — duration in full minutes, block pricing", () => {
  for (const { id, pickupAt, returnAt, expMin, expTotal } of [
    // spec:tariffs.md:49 — 12 m 40 s → 13 min
    { id: "TC-01", pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:12:40+03:00", expMin: 13, expTotal: 2500 },
    // spec:tariffs.md:50 — 36 min, 2 blocks
    { id: "TC-02", pickupAt: "2026-09-16T14:05:00+03:00", returnAt: "2026-09-16T14:41:00+03:00", expMin: 36, expTotal: 5000 },
    // spec:tariffs.md:46 — exactly 30 min → 1 block
    { id: "TC-03", pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:30:00+03:00", expMin: 30, expTotal: 2500 },
    // spec:tariffs.md:46 — 30 min 1 s → 31 min (ceil) → 2 blocks
    { id: "TC-04", pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:30:01+03:00", expMin: 31, expTotal: 5000 },
  ]) {
    const r = quote(ride(pickupAt, returnAt), standard);
    assert.equal(r.minutes, expMin,   `${id}: minutes`);
    assert.equal(r.total,   expTotal, `${id}: total`);
  }
});

// T1 — TC-05: DST transition — wall clock goes back, UTC elapsed is what matters
// spec:tariffs.md:45 — pickup 03:50 EEST (00:50Z), return 03:10 EET (01:10Z) → 20 min; night window → −30%
test("T1: TC-05 — DST rollback: duration from UTC instants; night discount from Kyiv hour", () => {
  const r = quote(
    ride("2026-10-25T03:50:00+03:00", "2026-10-25T03:10:00+02:00"),
    standard,
  );
  assert.equal(r.minutes, 20,   "TC-05: minutes");
  assert.equal(r.total,   1750, "TC-05: total (2500 − 30 %)");
});

// T2 — TC-06, TC-07, TC-10: rides ≤ 2 min get no time charge (spec:tariffs.md:54)
test("T2: TC-06 TC-07 TC-10 — rides not more than 2 min → zero time charge", () => {
  for (const { id, returnAt, bike } of [
    { id: "TC-06", returnAt: "2026-09-16T10:00:50+03:00", bike: "classic" }, // 50 s → 1 min
    { id: "TC-07", returnAt: "2026-09-16T10:02:00+03:00", bike: "classic" }, // exactly 2 min
    { id: "TC-10", returnAt: "2026-09-16T10:01:59+03:00", bike: "ebike"   }, // 1 min 59 s → 2 min
  ]) {
    const r = quote(ride("2026-09-16T10:00:00+03:00", returnAt, bike), standard);
    assert.equal(r.total, 0, id);
  }
});

// T2 — TC-08, TC-09: rides just over 2 min are charged
test("T2: TC-08 TC-09 — rides over 2 min are charged 1 block", () => {
  for (const { id, returnAt, expMin } of [
    // spec:tariffs.md:54 — 2 min 1 s → 3 min > 2 min → 1 block
    { id: "TC-08", returnAt: "2026-09-16T10:02:01+03:00", expMin: 3 },
    // spec:tariffs.md:58 — 3 min → 1 block
    { id: "TC-09", returnAt: "2026-09-16T10:03:00+03:00", expMin: 3 },
  ]) {
    const r = quote(ride("2026-09-16T10:00:00+03:00", returnAt), standard);
    assert.equal(r.minutes, expMin, `${id}: minutes`);
    assert.equal(r.total, 2500,     `${id}: total`);
  }
});

// T2 — TC-11: false start does not waive the out-of-zone fee (spec:tariffs.md:55)
test("T2: TC-11 — false start + out-of-zone return: timeCharge=0, fee applies", () => {
  const r = quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:00:50+03:00", "classic", "X01"), standard);
  assert.equal(r.timeCharge, 0,     "TC-11: timeCharge");
  assert.equal(r.total,      15000, "TC-11: total");
});

// T2 — TC-12: returnAt = pickupAt is accepted; 0 min → 0 (spec:tariffs.md:147)
test("T2: TC-12 — zero-duration ride is accepted and costs zero", () => {
  const r = quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:00:00+03:00"), standard);
  assert.equal(r.total, 0, "TC-12");
});

// T3 — TC-13 to TC-15: classic bike, 25 грн/block (spec:tariffs.md:62)
test("T3: TC-13 to TC-15 — classic bike block pricing", () => {
  for (const { id, returnAt, expTotal } of [
    { id: "TC-13", returnAt: "2026-09-16T11:00:00+03:00", expTotal: 5000  }, // 60 min → 2 blocks
    { id: "TC-14", returnAt: "2026-09-16T11:01:00+03:00", expTotal: 7500  }, // 61 min → 3 blocks
    { id: "TC-15", returnAt: "2026-09-16T10:50:00+03:00", expTotal: 5000  }, // 50 min → 2 blocks
  ]) {
    const r = quote(ride("2026-09-16T10:00:00+03:00", returnAt), standard);
    assert.equal(r.total, expTotal, id);
  }
});

// T3 — TC-16 to TC-18: ebike, 40 грн/block (spec:tariffs.md:67)
test("T3: TC-16 to TC-18 — ebike block pricing", () => {
  for (const { id, returnAt, expTotal } of [
    { id: "TC-16", returnAt: "2026-09-16T10:30:00+03:00", expTotal: 4000  }, // 30 min → 1 block
    { id: "TC-17", returnAt: "2026-09-16T10:31:00+03:00", expTotal: 8000  }, // 31 min → 2 blocks
    { id: "TC-18", returnAt: "2026-09-16T11:15:00+03:00", expTotal: 12000 }, // 75 min → 3 blocks
  ]) {
    const r = quote(ride("2026-09-16T10:00:00+03:00", returnAt, "ebike"), standard);
    assert.equal(r.total, expTotal, id);
  }
});
