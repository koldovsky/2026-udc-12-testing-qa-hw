import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { BLOCK_MINUTES, QuoteError, RATES, quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({ pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra });
const standard = { type: "standard" };

test("quote returns an itemised price", () => {
  const rides = [
    ride("2026-09-16T07:00:00Z", "2026-09-16T07:01:00Z"),
    ride("2026-09-16T07:00:00Z", "2026-09-16T07:50:00Z"),
    ride("2026-09-16T07:00:00Z", "2026-09-16T09:10:00Z", { bike: "ebike" }),
  ];
  for (const r of rides) {
    const result = quote(r, standard);
    assert.ok(result.total >= 0);
    assert.ok(Array.isArray(result.discounts));
    assert.ok(Array.isArray(result.fees));
    assert.equal(typeof result.minutes, "number");
  }
});

// T1 (docs/spec/tariffs.md:46): a partial minute counts as a full one, so 30 min 20 s is
// 31 minutes — which starts a second block (T3, docs/spec/tariffs.md:62).
test("a ride of 30 min 20 s is 31 minutes and is billed as two blocks", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  assert.equal(result.minutes, 31);
  assert.equal(result.timeCharge, 5000);
});

test("e-bikes are billed at the e-bike rate", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), standard);
  assert.equal(result.timeCharge, Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike);
  assert.equal(result.total, result.timeCharge);
});

// T4 (docs/spec/tariffs.md:74-77): the 45 free minutes are a classic-bike benefit. On an
// e-bike a subscriber has no free minutes and pays the T3 charge less 20 %: a 40-minute
// ride is 2 blocks = 8000, so 6400 is due.
test("subscribers ride the first 45 minutes free on a classic bike, and pay 20 % less on an e-bike", () => {
  for (const [bike, expected] of [
    ["classic", 0],
    ["ebike", 6400],
  ]) {
    const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike }), { type: "subscriber" });
    assert.equal(result.total, expected, bike);
  }
});

test("subscription on a long e-bike ride", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z", { bike: "ebike" }), { type: "subscriber" });
  assert.ok(result.discounts.some((d) => d.code === "subscription"));
  assert.ok(result.total < result.timeCharge);
});

// T5 (docs/spec/tariffs.md:87): «Пільга не поширюється на збори (T7, T8)» — the 50 % cuts
// the time charge only (5000 → 2500), while the out-of-zone fee stays at its full 15000.
test("reduced fare for a ride returned outside the zone", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), { type: "reduced" });
  assert.equal(result.total, 17500);
  // Склад зборів, а не звернення за індексом `fees[0]`: тест має падати від зміни
  // поведінки, а не від зміни порядку зборів (`app/AGENTS.md`, правило 5; запах № 16 у
  // `docs/test-quality.md`).
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
});

test("night rides get 30 % off", () => {
  // 01:10–01:40 in Kyiv
  const result = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:40:00Z"), standard);
  assert.equal(result.timeCharge, 2500);
  assert.equal(result.discounts.length, 1);
  assert.equal(result.discounts[0].code, "night");
  assert.ok(result.total < result.timeCharge);
});

test("a bike kept over a day and left outside the zone pays both fees", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.equal(result.fees.length, 2);
});

// T6: три поїздки e-bike по 80 хв — 3 блоки × 4000 = 12000 кожна, третю обрізає ліміт доби.
// Точні суми кожної поїздки, а не «не більше за ліміт»: інакше тест проходить і тоді, коли
// ліміт зрізає зайве або, навпаки, не зрізає нічого.
test("the daily cap limits the time charge", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-7", type: "standard" };
  const totals = [];
  for (const [from, to] of [["06:00", "07:20"], ["10:00", "11:20"], ["15:00", "16:20"]]) {
    totals.push(quote(ride(`2026-09-16T${from}:00Z`, `2026-09-16T${to}:00Z`, { bike: "ebike" }), rider, { dayCap }).total);
  }
  assert.deepEqual(totals, [12000, 12000, 6000]);
  // 30000 — ліміт доби зі специфікації (T6, `docs/spec/tariffs.md:101`: «не перевищує
  // 300 грн»), а не константа `DAY_CAP` з модуля, який тестуємо (`app/AGENTS.md`, правило 3).
  assert.equal(totals.reduce((sum, value) => sum + value, 0), 30000, "за добу нараховано рівно ліміт");
  assert.equal(dayCap.remaining(rider.id, Date.parse("2026-09-16T15:00:00Z")), 0);
});

test("a 45-minute classic ride costs 50 UAH", () => {
  const priceRide = mock.fn(() => ({ minutes: 45, timeCharge: 5000, discounts: [], fees: [], total: 5000 }));
  const result = priceRide(ride("2026-09-16T07:00:00Z", "2026-09-16T07:45:00Z"), standard);
  assert.equal(result.total, 5000);
  assert.equal(priceRide.mock.callCount(), 1);
});

test("a return before the pickup is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T08:00:00Z", "2026-09-16T07:00:00Z"), standard), QuoteError);
});
