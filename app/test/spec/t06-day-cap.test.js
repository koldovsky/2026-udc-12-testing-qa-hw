// T6 (денний ліміт 300 грн) — docs/test-cases.md TC-33…TC-42, TC-54.
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { REDUCED, STANDARD, assertQuote, ledgerWith, price, ride } from "../helpers/spec.js";

// Rides with a booked history: `before` — time charges already booked for the day
// ({ id, pickupAt, amount }); the new ride is priced for rider `id`.
const cases = [
  { id: "TC-34", rule: "T6", title: "уже 27 500 + 2 500 — рівно 30 000, ліміт не урізає",
    before: [{ id: "U1", pickupAt: "2026-09-16T10:00:00+03:00", amount: 27500 }],
    rider: STANDARD, riderId: "U1",
    ride: ride("2026-09-16T15:00:00+03:00", "2026-09-16T15:20:00+03:00"),
    expected: { discounts: { "day-cap": 0 }, total: 2500 } },
  { id: "TC-35", rule: "T6", title: "уже 28 000 + 2 500 — ліміт −500",
    before: [{ id: "U1", pickupAt: "2026-09-16T10:00:00+03:00", amount: 28000 }],
    rider: STANDARD, riderId: "U1",
    ride: ride("2026-09-16T15:00:00+03:00", "2026-09-16T15:20:00+03:00"),
    expected: { timeCharge: 2500, discounts: { "day-cap": 500 }, total: 2000 } },
  { id: "TC-36", rule: "T6 (+T7)", title: "ліміт вичерпано, X01 — збір лімітом не обмежується",
    before: [{ id: "U1", pickupAt: "2026-09-16T10:00:00+03:00", amount: 30000 }],
    rider: STANDARD, riderId: "U1",
    ride: ride("2026-09-16T15:00:00+03:00", "2026-09-16T15:20:00+03:00", { station: "X01" }),
    expected: { timeCharge: 2500, discounts: { "day-cap": 2500 }, hourly: 0, fees: 15000, total: 15000 } },
  { id: "TC-37", rule: "T6 (+T5)", title: "пільговий, уже 27 000 — ліміт після знижки",
    before: [{ id: "U1", pickupAt: "2026-09-16T10:00:00+03:00", amount: 27000 }],
    rider: REDUCED, riderId: "U1",
    ride: ride("2026-09-16T15:00:00+03:00", "2026-09-16T16:15:00+03:00", { bike: "ebike" }),
    expected: { timeCharge: 12000, discounts: { reduced: 6000, "day-cap": 3000 }, total: 3000 } },
  { id: "TC-39", rule: "T6", title: "поїздка 23:40 → 00:20 належить до доби взяття (16.09)",
    before: [{ id: "U1", pickupAt: "2026-09-16T12:00:00+03:00", amount: 30000 }],
    rider: STANDARD, riderId: "U1",
    ride: ride("2026-09-16T23:40:00+03:00", "2026-09-17T00:20:00+03:00"),
    expected: { hourly: 0, total: 0 } },
  { id: "TC-41", rule: "T6 (+T10)", title: "доба — за київським часом: 17.09 00:30 (16.09 за UTC) — новий ліміт",
    before: [{ id: "U1", pickupAt: "2026-09-16T12:00:00+03:00", amount: 30000 }],
    rider: STANDARD, riderId: "U1",
    ride: ride("2026-09-17T00:30:00+03:00", "2026-09-17T00:50:00+03:00"),
    expected: { timeCharge: 2500, discounts: { night: 750, "day-cap": 0 }, total: 1750 } },
  { id: "TC-42", rule: "T6", title: "ліміт рахується для кожного користувача окремо",
    before: [{ id: "U1", pickupAt: "2026-09-16T10:00:00+03:00", amount: 30000 }],
    rider: STANDARD, riderId: "U2",
    ride: ride("2026-09-16T15:00:00+03:00", "2026-09-16T15:20:00+03:00"),
    expected: { discounts: { "day-cap": 0 }, total: 2500 } },
  { id: "TC-54", rule: "T8 (+T6)", title: "ліміт вичерпано, 25 год — збір T8 лімітом не обмежується",
    before: [{ id: "U1", pickupAt: "2026-09-16T06:10:00+03:00", amount: 30000 }],
    rider: STANDARD, riderId: "U1",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T11:00:00+03:00"),
    expected: { hourly: 0, fees: 200000, total: 200000 } },
];

for (const c of cases) {
  test(`${c.rule}: ${c.id} ${c.title}`, () => {
    const ledger = ledgerWith(c.before);
    assertQuote(price(c.ride, c.rider, { ledger, id: c.riderId }), c.expected);
  });
}

test("T6: TC-33 три поїздки електро по 80 хв — третя урізана до 60 грн, разом 300 грн", () => {
  const ledger = createDayCap();
  const quotes = [
    ["2026-09-16T09:00:00+03:00", "2026-09-16T10:20:00+03:00"],
    ["2026-09-16T13:00:00+03:00", "2026-09-16T14:20:00+03:00"],
    ["2026-09-16T18:00:00+03:00", "2026-09-16T19:20:00+03:00"],
  ].map(([from, to]) => price(ride(from, to, { bike: "ebike" }), STANDARD, { ledger, id: "U1" }));

  assert.equal(quotes[0].total, 12000, "1-ша поїздка, коп.");
  assert.equal(quotes[1].total, 12000, "2-га поїздка, коп.");
  assertQuote(quotes[2], { timeCharge: 12000, discounts: { "day-cap": 6000 }, total: 6000 });
  assert.equal(quotes.reduce((sum, q) => sum + q.total, 0), 30000, "разом за 16.09, коп.");
});

test("T6 (+T10): TC-38 нічна поїздка зі знижкою, потім довга денна — разом рівно 30 000", () => {
  const ledger = createDayCap();
  const night = price(ride("2026-09-16T01:10:00+03:00", "2026-09-16T01:40:00+03:00"), STANDARD, { ledger, id: "U1" });
  const day = price(
    ride("2026-09-16T10:00:00+03:00", "2026-09-16T15:00:00+03:00", { bike: "ebike" }),
    STANDARD,
    { ledger, id: "U1" },
  );

  assertQuote(night, { total: 1750 });
  assertQuote(day, { timeCharge: 40000, discounts: { "day-cap": 11750 }, total: 28250 });
  assert.equal(night.total + day.total, 30000, "разом за 16.09, коп.");
});

test("T6: TC-40 поїздка, взята 16.09 о 23:40, не входить у ліміт 17.09", () => {
  const ledger = createDayCap();
  price(ride("2026-09-16T23:40:00+03:00", "2026-09-17T00:20:00+03:00"), STANDARD, { ledger, id: "U1" });
  ledger.record("U1", "2026-09-17T09:00:00+03:00", 27500);

  const next = price(ride("2026-09-17T15:00:00+03:00", "2026-09-17T15:20:00+03:00"), STANDARD, { ledger, id: "U1" });

  assertQuote(next, { discounts: { "day-cap": 0 }, total: 2500 });
});
