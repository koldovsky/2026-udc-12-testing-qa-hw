import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";
import { HOUR, MINUTE, ride, standard } from "./helpers.js";

// T6 — the time charges of one rider on one day (Kyiv date of the pickup) are capped at 300 грн; fees are outside
// the cap (docs/spec/tariffs.md:100-103; «Доба» — :34; examples :105-107).
const user = { id: "rider-A", type: "standard" };
const other = { id: "rider-B", type: "standard" };

/** TC-32 (:105-106): three 80-minute e-bike rides on 16.09 at 09:00, 13:00, 18:00 — 3 blocks × 40 грн each. */
function threeEbikeRides() {
  const dayCap = createDayCap();
  const quotes = ["09:00:00", "13:00:00", "18:00:00"].map((time) =>
    quote(ride(80 * MINUTE, { time, bike: "ebike" }), user, { dayCap }),
  );
  return { dayCap, quotes };
}

test("T6: TC-32 three 80-min e-bike rides on one day: 12000, 12000, 6000", () => {
  const { quotes } = threeEbikeRides();
  assert.deepEqual(
    quotes.map((q) => q.total),
    [12000, 12000, 6000],
  );
  // the third ride is cut by the cap: 12000 − 6000
  assert.deepEqual(quotes[2].discounts, [{ code: "day-cap", amount: 6000 }]);
});

// :102-103 — «Збори в ліміт не входять і ним не обмежуються»; T7 fee 150 грн (:112).
test("T6: TC-33 after the cap is used up: time charge 0, out-of-zone fee 15000 is outside the cap", () => {
  const { dayCap } = threeEbikeRides();
  const result = quote(ride(20 * MINUTE, { time: "19:00:00", station: "X01" }), user, { dayCap });
  assert.equal(result.timeCharge, 2500);
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2500 }]);
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
  assert.equal(result.total, 15000);
});

// :101-102, :107 — a ride belongs to the day of its pickup even if it ends the next day.
test("T6: TC-34 ride taken 16.09 23:40, returned 17.09 00:20 belongs to 16.09 → time charge 0", () => {
  const { dayCap } = threeEbikeRides();
  const result = quote(ride(40 * MINUTE, { time: "23:40:00" }), user, { dayCap });
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 5000 }]);
  assert.equal(result.total, 0);
});

// :34, :101-102 — 17.09 00:30 Kyiv (16.09 21:30Z) is the new Kyiv day; the whole ride is at night → T10 (:141).
test("T6: TC-35 ride on 17.09 00:30–01:00 is a new day: 2500 − 30 % = 1750", () => {
  const { dayCap } = threeEbikeRides();
  const result = quote(ride(30 * MINUTE, { time: "00:30:00", date: "2026-09-17" }), user, { dayCap });
  assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
  assert.equal(result.total, 1750);
});

// :100 — «одного користувача»: another rider's cap is untouched; 80 min e-bike = 3 blocks (:70).
test("T6: TC-36 the cap is per user: another rider on the same day pays 12000", () => {
  const { dayCap } = threeEbikeRides();
  const result = quote(ride(80 * MINUTE, { time: "19:00:00", bike: "ebike" }), other, { dayCap });
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 12000);
});

// :124-125 — 25 h = 50 blocks = 1250 грн → cap 300 грн, plus the T8 fee 2000 грн.
test("T6: TC-37 standard, classic, 25 h: 125000 capped to 30000 + 200000 = 230000", () => {
  const result = quote(ride(25 * HOUR), standard);
  assert.equal(result.timeCharge, 125000);
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 95000 }]);
  assert.deepEqual(result.fees, [{ code: "unreturned", amount: 200000 }]);
  assert.equal(result.total, 230000);
});
