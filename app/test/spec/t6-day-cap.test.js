// docs/test-cases.md TC-32…TC-39: daily cap (T6), the day is the Kyiv date of the pickup.
import test from "node:test";
import assert from "node:assert/strict";
import { ledgerWith, quoteRow } from "../helpers/spec-ride.js";

test("T6: TC-32 три поїздки ebike по 80 хв за 16.09 → 12 000, 12 000, 6 000 (разом 30 000)", () => {
  const dayCap = ledgerWith();
  const rides = [
    { from: "09:00", to: "10:20", total: 12000 },
    { from: "13:00", to: "14:20", total: 12000 },
    { from: "18:00", to: "19:20", total: 6000 },
  ];
  const totals = rides.map((r) => quoteRow({ ...r, bike: "ebike", dayCap }).total);
  assert.deepEqual(totals, rides.map((r) => r.total));
  assert.equal(totals.reduce((a, b) => a + b, 0), 30000);
});

const CASES = [
  { id: "TC-33", rule: "T6", from: "10:00", to: "10:20", charged: [{ amount: 27500 }], total: 2500, capLine: false },
  { id: "TC-34", rule: "T6", from: "10:00", to: "10:20", charged: [{ amount: 28000 }], total: 2000, capLine: 500 },
  { id: "TC-35", rule: "T6", from: "10:00", to: "22:00", total: 30000 },
  { id: "TC-36", rule: "T6, T7", from: "20:00", to: "20:20", station: "X02", charged: [{ amount: 30000 }], total: 15000 },
  {
    id: "TC-38",
    rule: "T6, T10",
    from: "2026-09-16T21:30:00Z",
    to: "2026-09-16T21:50:00Z",
    charged: [{ day: "2026-09-16", amount: 30000 }],
    total: 1750,
  },
  {
    id: "TC-39",
    rule: "T6",
    riderId: "rider-B",
    from: "10:00",
    to: "10:20",
    charged: [{ rider: "rider-A", amount: 30000 }],
    total: 2500,
  },
];

for (const c of CASES) {
  const prior = (c.charged ?? []).map((p) => `${p.rider ?? "той самий"} ${p.day ?? "16.09"}=${p.amount}`).join("; ");
  test(`${c.rule}: ${c.id} ${c.from} → ${c.to}${c.station ? `, ${c.station}` : ""}; нараховано: ${prior || "0"} → ${c.total}`, () => {
    const result = quoteRow(c);
    assert.equal(result.total, c.total, "до сплати, коп.");
    if (c.capLine === false) {
      assert.ok(!result.discounts.some((d) => d.code === "day-cap"), "рядка ліміту немає");
    } else if (c.capLine !== undefined) {
      assert.deepEqual(result.discounts.find((d) => d.code === "day-cap"), { code: "day-cap", amount: c.capLine });
    }
  });
}

test("T6: TC-37 поїздка 16.09 23:40 → 17.09 00:20 належить до 16.09 (→ 0), доба 17.09 вільна (→ 2 500)", () => {
  const dayCap = ledgerWith([{ day: "2026-09-16", amount: 30000 }]);
  const lateRide = quoteRow({ from: "23:40", to: "00:20", toDate: "2026-09-17", dayCap });
  const nextDay = quoteRow({ from: "10:00", to: "10:20", fromDate: "2026-09-17", dayCap });
  assert.equal(lateRide.total, 0, "1) зараховано до 16.09");
  assert.equal(nextDay.total, 2500, "2) доба 17.09");
});
