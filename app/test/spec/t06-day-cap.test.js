import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";
import { HOUR, MINUTE, ride, standard } from "./helpers.js";

const user = { id: "rider-A", type: "standard" };
const other = { id: "rider-B", type: "standard" };

/** TC-32: three 80-minute e-bike rides on 16.09 at 09:00, 13:00, 18:00. Returns the ledger and the totals. */
function threeEbikeRides() {
  const dayCap = createDayCap();
  const totals = ["09:00:00", "13:00:00", "18:00:00"].map(
    (time) => quote(ride(80 * MINUTE, { time, bike: "ebike" }), user, { dayCap }).total,
  );
  return { dayCap, totals };
}

test("T6: TC-32 three 80-min e-bike rides on one day: 12000, 12000, 6000", () => {
  assert.deepEqual(threeEbikeRides().totals, [12000, 12000, 6000]);
});

test("T6: TC-33 after the cap is used up: time charge 0, out-of-zone fee 15000 is outside the cap", () => {
  const { dayCap } = threeEbikeRides();
  const result = quote(ride(20 * MINUTE, { time: "19:00:00", station: "X01" }), user, { dayCap });
  const hourly = result.total - result.fees.reduce((sum, fee) => sum + fee.amount, 0);
  assert.equal(hourly, 0);
  assert.equal(result.total, 15000);
});

test("T6: TC-34 ride taken 16.09 23:40, returned 17.09 00:20 belongs to 16.09 → time charge 0", () => {
  const { dayCap } = threeEbikeRides();
  const result = quote(ride(40 * MINUTE, { time: "23:40:00" }), user, { dayCap });
  assert.equal(result.total, 0);
});

test("T6: TC-35 ride on 17.09 00:30–01:00 is a new day: 2500 − 30 % = 1750", () => {
  const { dayCap } = threeEbikeRides();
  const result = quote(ride(30 * MINUTE, { time: "00:30:00", date: "2026-09-17" }), user, { dayCap });
  assert.equal(result.total, 1750);
});

test("T6: TC-36 the cap is per user: another rider on the same day pays 12000", () => {
  const { dayCap } = threeEbikeRides();
  const result = quote(ride(80 * MINUTE, { time: "19:00:00", bike: "ebike" }), other, { dayCap });
  assert.equal(result.total, 12000);
});

test("T6: TC-37 standard, classic, 25 h: 125000 capped to 30000 + 200000 = 230000", () => {
  assert.equal(quote(ride(25 * HOUR), standard).total, 230000);
});
