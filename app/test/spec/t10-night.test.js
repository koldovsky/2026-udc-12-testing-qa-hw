// docs/test-cases.md TC-51…TC-58 — T10 (night discount). Only rides wholly inside 00:00–06:00
// or wholly outside it: partial rides and 06:00 itself are open questions Q-1, Q-2.
// Expectations: docs/test-cases.md, docs/spec/tariffs.md:139-143 (+ :37, :45-46, :112, :147-148).

import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";
import { ride, rider } from "../helpers/spec.js";

const CASES = [
  { id: "TC-51", rules: "T10", desc: "01:10 → 01:40", ride: { from: "01:10", to: "01:40" }, total: 1750 },
  {
    id: "TC-52",
    rules: "T10",
    desc: "електровелосипед, 02:00 → 02:30",
    ride: { bike: "ebike", from: "02:00", to: "02:30" },
    total: 2800,
  },
  { id: "TC-53", rules: "T10", desc: "00:00:00 → 00:30:00", ride: { from: "00:00:00", to: "00:30:00" }, total: 1750 },
  { id: "TC-54", rules: "T10", desc: "23:00 → 23:30 (поза вікном)", ride: { from: "23:00", to: "23:30" }, total: 2500 },
  { id: "TC-55", rules: "T10", desc: "06:30 → 07:00 (поза вікном)", ride: { from: "06:30", to: "07:00" }, total: 2500 },
  {
    id: "TC-56",
    rules: "T10, T7",
    desc: "01:10 → 01:40, станція X01 (знижка лише на погодинне)",
    ride: { from: "01:10", to: "01:40", station: "X01" },
    total: 16750,
  },
  {
    id: "TC-57",
    rules: "T10",
    desc: "2026-09-15T22:10:00Z → 22:40:00Z (16.09 01:10–01:40 за Києвом)",
    ride: { pickupAt: "2026-09-15T22:10:00Z", returnAt: "2026-09-15T22:40:00Z" },
    total: 1750,
  },
];

for (const c of CASES) {
  test(`${c.rules}: ${c.id} — ${c.desc} → до сплати ${c.total}`, () => {
    const result = quote(ride(c.ride), rider());
    assert.equal(result.total, c.total);
  });
}

test("T1, T10: TC-58 — перехід на зимовий час 2026-10-25T03:50:00+03:00 → 03:10:00+02:00 → 20 хв, уночі → 1 750", () => {
  const result = quote(
    ride({ pickupAt: "2026-10-25T03:50:00+03:00", returnAt: "2026-10-25T03:10:00+02:00" }),
    rider(),
  );
  assert.deepEqual({ minutes: result.minutes, total: result.total }, { minutes: 20, total: 1750 });
});
