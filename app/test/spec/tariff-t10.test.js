// T10 — night discount: −30 % on time charge for rides 00:00–06:00 Kyiv time
// Expected values: docs/test-cases.md, docs/spec/tariffs.md
import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";

const standard = { type: "standard" };
const ride = (pickupAt, returnAt, bike = "classic", returnStation = "S01") =>
  ({ pickupAt, returnAt, bike, returnStation });

// T10 — TC-72 to TC-77, TC-89, TC-90: night and day rides (spec:tariffs.md:141,143)
// Every ride lies wholly inside or wholly outside 00:00–06:00 Kyiv, so the expected value
// does not depend on Q-1 (rides across 00:00 / 06:00) or Q-2 (06:00:00 itself).
test("T10: TC-72 to TC-77, TC-89, TC-90 — night window 00:00–06:00 Kyiv: 30 % discount", () => {
  for (const { id, pickupAt, returnAt, bike, expTotal } of [
    // 01:10–01:40 Kyiv → 2500 − 30%
    { id: "TC-72", pickupAt: "2026-09-16T01:10:00+03:00", returnAt: "2026-09-16T01:40:00+03:00", bike: "classic", expTotal: 1750 },
    // 00:00–00:30 Kyiv → 00:00 is in window
    { id: "TC-73", pickupAt: "2026-09-16T00:00:00+03:00", returnAt: "2026-09-16T00:30:00+03:00", bike: "classic", expTotal: 1750 },
    // 05:29–05:59 Kyiv → entire ride before 06:00
    { id: "TC-74", pickupAt: "2026-09-16T05:29:00+03:00", returnAt: "2026-09-16T05:59:00+03:00", bike: "classic", expTotal: 1750 },
    // 23:29–23:59 Kyiv → outside window → no discount
    { id: "TC-75", pickupAt: "2026-09-16T23:29:00+03:00", returnAt: "2026-09-16T23:59:00+03:00", bike: "classic", expTotal: 2500 },
    // 23:29:59–23:59:59 Kyiv EEST (20:29:59Z–20:59:59Z) → ends at the last second before 00:00 → no discount
    { id: "TC-89", pickupAt: "2026-09-16T20:29:59Z",      returnAt: "2026-09-16T20:59:59Z",      bike: "classic", expTotal: 2500 },
    // 00:00:00–00:30 Kyiv EET on 10.11 (22:00Z–22:30Z on 09.11 — UTC date differs) → 2500 − 30%
    { id: "TC-90", pickupAt: "2026-11-09T22:00:00Z",      returnAt: "2026-11-09T22:30:00Z",      bike: "classic", expTotal: 1750 },
    // 10:00–10:30 Kyiv → day → no discount
    { id: "TC-76", pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:30:00+03:00", bike: "classic", expTotal: 2500 },
    // ebike 02:00–02:30 → 4000 − 30%
    { id: "TC-77", pickupAt: "2026-09-16T02:00:00+03:00", returnAt: "2026-09-16T02:30:00+03:00", bike: "ebike",   expTotal: 2800 },
  ]) {
    const r = quote(ride(pickupAt, returnAt, bike), standard);
    assert.equal(r.total, expTotal, id);
  }
});

// T10 — TC-78: UTC "night" but Kyiv "day" — discount based on Kyiv time (spec:tariffs.md:37)
test("T10: TC-78 — 04:00Z = 07:00 Kyiv: UTC is night but Kyiv is day → no discount", () => {
  // 2026-09-16T04:00:00Z = 2026-09-16T07:00:00+03:00 (Kyiv) → hour 7, no discount
  const r = quote(ride("2026-09-16T04:00:00Z", "2026-09-16T04:30:00Z"), standard);
  assert.equal(r.total, 2500, "TC-78: Kyiv 07:00 is daytime");
});

// T10 — TC-79: EET (UTC+2) night — 23:10Z = 01:10 Kyiv (+02:00) → discount (spec:tariffs.md:37)
test("T10: TC-79 — 23:10Z = 01:10 Kyiv EET: night discount applies", () => {
  const r = quote(ride("2026-11-09T23:10:00Z", "2026-11-09T23:40:00Z"), standard);
  assert.equal(r.total, 1750, "TC-79: 2500 − 30 %");
});

// T10 — TC-80: false start in night window — false start rule wins (spec:tariffs.md:54)
test("T10: TC-80 — false start at night: T2 applies first → zero charge", () => {
  // 01:00–01:02 Kyiv → 2 min exactly → false start → 0 (not 1750)
  const r = quote(ride("2026-09-16T01:00:00+03:00", "2026-09-16T01:02:00+03:00"), standard);
  assert.equal(r.total, 0, "TC-80: false start overrides night discount");
});

// T10 — TC-87 TC-88: pickup and return both after 06:00 Kyiv → no night discount (spec:tariffs.md:141)
// The ride lies wholly outside «з 00:00 до 06:00» under every reading of Q-1 and Q-2,
// so the expected value does not depend on the open questions (06:00:00 itself is Q-2).
test("T10: TC-87 TC-88 — ride wholly after 06:00 Kyiv: no night discount", () => {
  for (const { id, pickupAt, returnAt } of [
    { id: "TC-87", pickupAt: "2026-09-16T06:30:00+03:00", returnAt: "2026-09-16T07:00:00+03:00" },
    { id: "TC-88", pickupAt: "2026-09-16T06:59:00+03:00", returnAt: "2026-09-16T07:29:00+03:00" },
  ]) {
    const r = quote(ride(pickupAt, returnAt), standard);
    assert.equal(r.total, 2500, id); // 30 min classic → 1 block (spec:tariffs.md:66)
  }
});
