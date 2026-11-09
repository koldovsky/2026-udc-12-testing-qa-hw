import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";
import { at, run } from "../helpers/spec.js";

// T6 (daily cap), T7 (out-of-zone fee), T8 (unreturned bike fee).
const d = (from, to) => ({ from: at(16, from), to: at(16, to) });

const capCases = [
  { id: "TC-36", name: "sum for the day is exactly 30000: not reduced", bike: "ebike", ...d("12:00:00", "13:20:00"), prior: 18000, total: 12000 },
  { id: "TC-37", name: "29999 already charged: 1 kopeck left", ...d("12:00:00", "12:20:00"), prior: 29999, total: 1 },
  { id: "TC-38", name: "30000 already charged: nothing left", ...d("12:00:00", "12:20:00"), prior: 30000, total: 0 },
  { id: "TC-39", name: "cap applies after discounts: 80000 - 50 % = 40000 -> 30000", bike: "ebike", rider: "reduced", ...d("10:00:00", "20:00:00"), total: 30000 },
  { id: "TC-40", name: "fee is not limited by the cap", station: "X01", ...d("12:00:00", "12:20:00"), prior: 30000, total: 15000 },
  { id: "TC-42", name: "ride across midnight belongs to its pickup day", from: at(16, "23:40:00"), to: at(17, "00:20:00"), prior: 29000, total: 1000 },
  { id: "TC-43", name: "new day, new cap", from: at(17, "08:00:00"), to: at(17, "08:30:00"), prior: 30000, priorAt: at(16, "12:00:00"), total: 2500 },
  { id: "TC-45", name: "day is Kyiv's, not UTC (prior 17.09 00:05 +03:00 = 16.09 UTC)", from: at(17, "03:30:00"), to: at(17, "03:50:00"), prior: 29500, priorAt: at(17, "00:05:00"), total: 500 },
];

for (const c of capCases) {
  test(`T6: ${c.id} ${c.name}`, () => {
    assert.equal(run(c).total, c.total);
  });
}

const ride = (from, to, extra = {}) => ({ pickupAt: from, returnAt: to, bike: "classic", returnStation: "S01", ...extra });

test("T6: TC-35 three 80-min e-bike rides in a day: 12000, 12000, 6000", () => {
  const dayCap = createDayCap();
  const rider = { type: "standard", id: "u1" };
  const trips = [
    ["09:00:00", "10:20:00", 12000],
    ["13:00:00", "14:20:00", 12000],
    ["18:00:00", "19:20:00", 6000],
  ];
  for (const [from, to, total] of trips) {
    assert.equal(quote(ride(at(16, from), at(16, to), { bike: "ebike" }), rider, { dayCap }).total, total);
  }
});

test("T6: TC-41 the fee does not reduce the cap left for the next ride", () => {
  const dayCap = createDayCap();
  const rider = { type: "standard", id: "u1" };
  const first = quote(ride(at(16, "08:00:00"), at(16, "08:20:00"), { returnStation: "X01" }), rider, { dayCap });
  const second = quote(ride(at(16, "10:00:00"), at(16, "20:00:00"), { bike: "ebike" }), rider, { dayCap });
  assert.equal(first.total, 17500);
  assert.equal(second.total, 27500);
});

test("T6: TC-44 the cap is per rider", () => {
  const dayCap = createDayCap();
  dayCap.record("other", at(16, "09:00:00"), 30000);
  const result = quote(ride(at(16, "12:00:00"), at(16, "12:30:00")), { type: "standard", id: "u1" }, { dayCap });
  assert.equal(result.total, 2500);
});

const feeCases = [
  { id: "TC-46", rule: "T7", name: "X01, 20 min: 2500 + 15000", station: "X01", ...d("12:00:00", "12:20:00"), total: 17500 },
  { id: "TC-47", rule: "T7", name: "X02, 30 min", station: "X02", ...d("12:00:00", "12:30:00"), total: 17500 },
  { id: "TC-48", rule: "T7", name: "X03, 30 min", station: "X03", ...d("12:00:00", "12:30:00"), total: 17500 },
  ...["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((station) => ({
    id: "TC-49", rule: "T7", name: `${station} is in the zone: no fee`, station, ...d("12:00:00", "12:30:00"), total: 2500,
  })),
  { id: "TC-50", rule: "T7", name: "night ride to X01: discounted time + full fee", station: "X01", ...d("01:00:00", "01:20:00"), total: 16750 },
  { id: "TC-51", rule: "T7", name: "subscriber, free time, X02: only the fee", rider: "subscriber", station: "X02", ...d("12:00:00", "12:30:00"), total: 15000 },
  { id: "TC-52", rule: "T8", name: "25 h: cap 30000 + fee 200000", from: at(16, "12:00:00"), to: at(17, "13:00:00"), total: 230000 },
  { id: "TC-53", rule: "T8", name: "exactly 24 h: no unreturned fee", from: at(16, "12:00:00"), to: at(17, "12:00:00"), total: 30000 },
  { id: "TC-54", rule: "T8", name: "24 h 1 s: unreturned fee", from: at(16, "12:00:00"), to: at(17, "12:00:01"), total: 230000 },
  { id: "TC-55", rule: "T8", name: "X02 and 25 h: both fees", station: "X02", from: at(16, "12:00:00"), to: at(17, "13:00:00"), total: 245000 },
  { id: "TC-56", rule: "T8", name: "10000 already charged: 20000 left + fee", from: at(16, "12:00:00"), to: at(17, "13:00:00"), prior: 10000, total: 220000 },
];

for (const c of feeCases) {
  test(`${c.rule}: ${c.id} ${c.name}`, () => {
    assert.equal(run(c).total, c.total);
  });
}
