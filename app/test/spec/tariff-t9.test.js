// T9 — amounts, rounding, receipt format
// Expected values: docs/test-cases.md, docs/spec/tariffs.md
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { discount, quote } from "../../src/tariff.js";
import { formatReceipt } from "../../src/receipt.js";

const standard = { type: "standard" };
const reduced  = { type: "reduced" };

// T9 — TC-66: rounding of a fractional kopeck (spec:tariffs.md:129-130, :137)
// The internal discount() helper is called directly on purpose: with the current T3 prices
// (2 500 / 4 000 kopecks) and the 20 / 50 / 30 % discounts no reachable ride yields a fractional
// kopeck (open question Q-5 in docs/test-cases.md), so the T9 rounding rule can only be checked
// at the helper level. 1235 × 0.7 = 864.5 → amount due rounds down to 864, so the discount is 371.
test("T9: TC-66 — fractional kopeck: amount due rounds down (1235 − 30% → 864 due, discount 371)", () => {
  assert.equal(discount(1235, 30), 371, "TC-66: discount 3,71 грн → due 8,64 грн (tariffs.md:137)");
});

// T9 — TC-67: receipt for the 25-hour classic ride (TC-59) — thousands separated by a space
// spec:tariffs.md:132-135 (format), :124-125 (amounts)
test("T9: TC-67 — receipt for 25-hour ride shows '2 300,00 грн' with space separator", () => {
  const r = quote(
    { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-17T11:00:00+03:00", bike: "classic", returnStation: "S01" },
    standard,
  );
  assert.equal(r.total, 230000, "TC-67: total");
  assert.deepEqual(formatReceipt(r), [
    "Тривалість поїздки: 1500 хв",
    "Погодинне нарахування ........... 1 250,00 грн",
    "Денний ліміт ..................... -950,00 грн",
    "Збір: неповернений велосипед .... 2 000,00 грн",
    "До сплати ....................... 2 300,00 грн",
  ], "TC-67");
});

// T9 — TC-68: receipt for classic, reduced, X02, 20 min — reduced discount, full out-of-zone fee
// spec:tariffs.md:132-135; T5 does not apply to fees (tariffs.md:87)
test("T9: TC-68 — receipt for reduced fare + out-of-zone: fee is 150,00 грн, total 162,50 грн", () => {
  const r = quote(
    { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:20:00+03:00", bike: "classic", returnStation: "X02" },
    reduced,
  );
  assert.equal(r.total, 16250, "TC-68: total");
  assert.deepEqual(formatReceipt(r), [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Знижка: пільговий тариф ........... -12,50 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 162,50 грн",
  ], "TC-68");
});

// T9 — TC-69: receipt for the 3rd ride of TC-41 — day-cap line, total 60,00 грн
// spec:tariffs.md:132-135 (format), :105-106 (amounts)
test("T9: TC-69 — receipt for capped ride shows Денний ліміт line and total 60,00 грн", () => {
  // State after the first two TC-41 rides: 2 × 120 грн = 240 грн already charged on 16.09
  const dayCap = createDayCap();
  const rider  = { id: "rider-tc69", type: "standard" };
  dayCap.record(rider.id, "2026-09-16T06:00:00Z", 24000);

  const r = quote(
    { pickupAt: "2026-09-16T18:00:00+03:00", returnAt: "2026-09-16T19:20:00+03:00", bike: "ebike", returnStation: "S01" },
    rider,
    { dayCap },
  );
  assert.equal(r.total, 6000, "TC-69: total");
  assert.deepEqual(formatReceipt(r), [
    "Тривалість поїздки: 80 хв",
    "Погодинне нарахування ............. 120,00 грн",
    "Денний ліміт ...................... -60,00 грн",
    "До сплати .......................... 60,00 грн",
  ], "TC-69");
});

// T9 — TC-70: receipt for a false start (50 s → 1 хв, T2) — zero total (spec:tariffs.md:132-135, :54, :57)
test("T9: TC-70 — receipt for false start: duration 1 хв, total 0,00 грн", () => {
  const r = quote(
    { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:00:50+03:00", bike: "classic", returnStation: "S01" },
    standard,
  );
  assert.equal(r.total, 0, "TC-70: total");
  assert.deepEqual(formatReceipt(r), [
    "Тривалість поїздки: 1 хв",
    "Погодинне нарахування ............... 0,00 грн",
    "До сплати ........................... 0,00 грн",
  ], "TC-70");
});

// T9 — TC-71: receipt for standard, X01, 20 min (TC-53) — total 175,00 грн, no thousands separator
// spec:tariffs.md:132-135 (format), :114-115 (amounts)
test("T9: TC-71 — receipt for 20-min ride + out-of-zone: total 175,00 грн", () => {
  const r = quote(
    { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:20:00+03:00", bike: "classic", returnStation: "X01" },
    standard,
  );
  assert.equal(r.total, 17500, "TC-71: total");
  assert.deepEqual(formatReceipt(r), [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ], "TC-71");
});
