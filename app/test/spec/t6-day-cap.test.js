// docs/test-cases.md TC-31…TC-40 — T6 (daily cap) and its combinations with T5, T7, T10.
// Expectations: docs/test-cases.md, docs/spec/tariffs.md:98-107 (+ :34, :37, :112, :141).

import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
import { ride, rider } from "../helpers/spec.js";

const U1 = rider("standard", "U1");
const U2 = rider("standard", "U2");

// TC-31: three e-bike rides of 80 min on 16.09 for U1 — 12 000; 12 000; 6 000 (:105-106).
const TC31 = [
  { rider: U1, ride: ride({ bike: "ebike", from: "09:00", to: "10:20" }), total: 12000 },
  { rider: U1, ride: ride({ bike: "ebike", from: "13:00", to: "14:20" }), total: 12000 },
  { rider: U1, ride: ride({ bike: "ebike", from: "18:00", to: "19:20" }), total: 6000 },
];
/** The same rides as setup only: their totals are not what the case checks. */
const asSetup = (steps) => steps.map(({ rider: who, ride: r }) => ({ rider: who, ride: r }));

const reducedEbike80 = (from, to) => ({ rider: rider("reduced"), ride: ride({ bike: "ebike", from, to }) });

// Each scenario runs on one fresh ledger; a step with `total` is checked, a step without is setup.
const SCENARIOS = [
  { id: "TC-31", rules: "T6", desc: "три поїздки електровелосипедом по 80 хв 16.09 → 12 000; 12 000; 6 000", steps: TC31 },
  {
    id: "TC-32",
    rules: "T6",
    desc: "після TC-31 — 16.09 20:00 → 20:30 → ліміт вичерпано → 0",
    steps: [...asSetup(TC31), { rider: U1, ride: ride({ from: "20:00", to: "20:30" }), total: 0 }],
  },
  {
    id: "TC-33",
    rules: "T6, T7",
    desc: "після TC-31 — 16.09 20:00 → 20:20, станція X02 → 0 + збір → 15 000",
    steps: [...asSetup(TC31), { rider: U1, ride: ride({ from: "20:00", to: "20:20", station: "X02" }), total: 15000 }],
  },
  {
    id: "TC-34",
    rules: "T6",
    desc: "після TC-31 для U1 — U2, електровелосипед, 16.09 19:00 → 20:20 → ліміт окремий → 12 000",
    steps: [...asSetup(TC31), { rider: U2, ride: ride({ bike: "ebike", from: "19:00", to: "20:20" }), total: 12000 }],
  },
  {
    id: "TC-38",
    rules: "T6",
    desc: "після TC-31 — 16.09 23:40 → 17.09 00:20 → належить 16.09 → 0",
    steps: [...asSetup(TC31), { rider: U1, ride: ride({ from: "23:40", to: "00:20", toDate: "2026-09-17" }), total: 0 }],
  },
  {
    id: "TC-39",
    rules: "T6, T10",
    desc: "після TC-31 — 2026-09-16T22:00:00Z → 22:30:00Z (17.09 01:00–01:30 за Києвом) → нова доба, нічна → 1 750",
    steps: [
      ...asSetup(TC31),
      { rider: U1, ride: ride({ pickupAt: "2026-09-16T22:00:00Z", returnAt: "2026-09-16T22:30:00Z" }), total: 1750 },
    ],
  },
  {
    id: "TC-40",
    rules: "T5, T6",
    desc: "пільговий, електровелосипед, шість поїздок по 80 хв 16.09 → 6 000 × 5, шоста 0",
    steps: [
      { ...reducedEbike80("09:00", "10:20"), total: 6000 },
      { ...reducedEbike80("11:00", "12:20"), total: 6000 },
      { ...reducedEbike80("13:00", "14:20"), total: 6000 },
      { ...reducedEbike80("15:00", "16:20"), total: 6000 },
      { ...reducedEbike80("17:00", "18:20"), total: 6000 },
      { ...reducedEbike80("19:00", "20:20"), total: 0 },
    ],
  },
];

for (const s of SCENARIOS) {
  test(`${s.rules}: ${s.id} — ${s.desc}`, () => {
    const dayCap = createDayCap();
    const actual = [];
    for (const step of s.steps) {
      const result = quote(step.ride, step.rider, { dayCap });
      if ("total" in step) actual.push(result.total);
    }
    const expected = s.steps.filter((step) => "total" in step).map((step) => step.total);
    assert.deepEqual(actual, expected);
  });
}

// A single ride on a day with no earlier charges.
const SINGLE_RIDE_CASES = [
  { id: "TC-35", desc: "електровелосипед, 10:00 → 18:00 (480 хв, 64 000)", ride: { bike: "ebike", from: "10:00", to: "18:00" }, total: 30000 },
  { id: "TC-36", desc: "10:00 → 16:00 (360 хв, рівно 30 000)", ride: { from: "10:00", to: "16:00" }, total: 30000 },
  { id: "TC-37", desc: "10:00 → 16:01 (361 хв, 32 500)", ride: { from: "10:00", to: "16:01" }, total: 30000 },
];

for (const c of SINGLE_RIDE_CASES) {
  test(`T6: ${c.id} — ${c.desc} → до сплати ${c.total}`, () => {
    const result = quote(ride(c.ride), rider(), { dayCap: createDayCap() });
    assert.equal(result.total, c.total);
  });
}

test("T6: TC-36 — рівно 30 000: у чеку немає рядка ліміту", () => {
  const result = quote(ride({ from: "10:00", to: "16:00" }), rider(), { dayCap: createDayCap() });
  const lines = formatReceipt(result);
  // T9 (:133-135): every discount and the cap is a separate line with a minus sign.
  const minusLines = lines.filter((line) => /[-−]\s?\d[\d   ]*,\d\d грн$/.test(line));
  assert.deepEqual(minusLines, []);
});
