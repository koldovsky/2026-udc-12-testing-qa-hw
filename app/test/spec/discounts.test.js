import test from "node:test";
import assert from "node:assert/strict";
import { at, run } from "../helpers/spec.js";

// T4 (subscription), T5 (reduced fare), T10 (night discount).
const d = (from, to) => ({ from: at(16, from), to: at(16, to) });

const cases = [
  // T4
  { id: "TC-18", rule: "T4", name: "classic, 40 min is free", rider: "subscriber", ...d("12:00:00", "12:40:00"), total: 0 },
  { id: "TC-19", rule: "T4", name: "classic, 45 min is free", rider: "subscriber", ...d("12:00:00", "12:45:00"), total: 0 },
  { id: "TC-20", rule: "T4", name: "classic, 45 min 1 s is 46 min, 1 block", rider: "subscriber", ...d("12:00:00", "12:45:01"), minutes: 46, total: 2500 },
  { id: "TC-21", rule: "T4", name: "classic, 75 min: 30 paid min = 1 block", rider: "subscriber", ...d("12:00:00", "13:15:00"), total: 2500 },
  { id: "TC-22", rule: "T4", name: "classic, 76 min: 31 paid min = 2 blocks", rider: "subscriber", ...d("12:00:00", "13:16:00"), total: 5000 },
  { id: "TC-23", rule: "T4", name: "classic, 100 min: 55 paid min = 2 blocks", rider: "subscriber", ...d("12:00:00", "13:40:00"), total: 5000 },
  { id: "TC-24", rule: "T4", name: "e-bike, 75 min: 12000 - 20 %", bike: "ebike", rider: "subscriber", ...d("12:00:00", "13:15:00"), total: 9600 },
  { id: "TC-25", rule: "T4", name: "e-bike, 3 min: no free minutes, 4000 - 20 %", bike: "ebike", rider: "subscriber", ...d("12:00:00", "12:03:00"), total: 3200 },
  { id: "TC-26", rule: "T4", name: "e-bike, 40 min: 8000 - 20 %", bike: "ebike", rider: "subscriber", ...d("12:00:00", "12:40:00"), total: 6400 },
  // T5
  { id: "TC-27", rule: "T5", name: "reduced, classic, 40 min: 5000 - 50 %", rider: "reduced", ...d("12:00:00", "12:40:00"), total: 2500 },
  { id: "TC-28", rule: "T5", name: "reduced, e-bike, 40 min: 8000 - 50 %", bike: "ebike", rider: "reduced", ...d("12:00:00", "12:40:00"), total: 4000 },
  { id: "TC-29", rule: "T5", name: "subscriber with concession, 80 min: reduced fare wins", rider: "subscriberReduced", ...d("12:00:00", "13:20:00"), total: 3750 },
  { id: "TC-30", rule: "T5", name: "subscriber with concession, 60 min: equal sums", rider: "subscriberReduced", ...d("12:00:00", "13:00:00"), total: 2500 },
  { id: "TC-31", rule: "T5", name: "subscriber with concession, 40 min: subscription 0 wins", rider: "subscriberReduced", ...d("12:00:00", "12:40:00"), total: 0 },
  { id: "TC-32", rule: "T5", name: "subscriber with concession, e-bike, 60 min: reduced fare, not a sum of discounts", bike: "ebike", rider: "subscriberReduced", ...d("12:00:00", "13:00:00"), total: 4000 },
  { id: "TC-33", rule: "T5", name: "reduced fare does not apply to the out-of-zone fee", rider: "reduced", station: "X01", ...d("12:00:00", "12:20:00"), total: 16250 },
  { id: "TC-34", rule: "T5", name: "reduced fare, 25 h: cap 30000, unreturned fee without discount", rider: "reduced", from: at(16, "12:00:00"), to: at(17, "13:00:00"), total: 230000 },
  // T10
  { id: "TC-64", rule: "T10", name: "01:10→01:40 is 30 % off", ...d("01:10:00", "01:40:00"), total: 1750 },
  { id: "TC-65", rule: "T10", name: "pickup exactly at 00:00", from: at(17, "00:00:00"), to: at(17, "00:20:00"), total: 1750 },
  { id: "TC-66", rule: "T10", name: "whole ride before 06:00", ...d("05:20:00", "05:50:00"), total: 1750 },
  { id: "TC-67", rule: "T10", name: "e-bike at night: 4000 - 30 %", bike: "ebike", ...d("02:00:00", "02:30:00"), total: 2800 },
  { id: "TC-68", rule: "T10", name: "daytime ride has no discount", ...d("12:00:00", "12:30:00"), total: 2500 },
  { id: "TC-69", rule: "T10", name: "evening ride ending before midnight has no discount", ...d("23:00:00", "23:20:00"), total: 2500 },
  { id: "TC-70", rule: "T10", name: "subscriber at night, 100 min: 5000 - 30 %", rider: "subscriber", ...d("02:00:00", "03:40:00"), total: 3500 },
  { id: "TC-71", rule: "T10", name: "night is Kyiv time, not UTC (21:30Z = 00:30)", from: "2026-09-16T21:30:00Z", to: "2026-09-16T21:50:00Z", total: 1750 },
  { id: "TC-72", rule: "T10", name: "winter time: 21:30Z = 23:30 Kyiv, not night", from: "2026-11-03T21:30:00Z", to: "2026-11-03T21:50:00Z", total: 2500 },
  { id: "TC-73", rule: "T1, T10", name: "DST change: 30 min elapsed, night, not rejected", from: "2026-10-25T00:50:00Z", to: "2026-10-25T01:20:00Z", minutes: 30, total: 1750 },
];

for (const c of cases) {
  test(`${c.rule}: ${c.id} ${c.name}`, () => {
    const result = run(c);
    if (c.minutes !== undefined) assert.equal(result.minutes, c.minutes);
    assert.equal(result.total, c.total);
  });
}
