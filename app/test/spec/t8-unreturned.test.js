// T8: unreturned bike fee. Rows follow docs/test-cases.md.
import test from "node:test";
import { createDayCap } from "../../src/day-cap.js";
import { HOUR, SECOND, assertPrice, atCap, concession, price, standard } from "./support.js";

const rows = [
  {
    id: "TC-65",
    title: "25 h: 50 blocks, capped, plus the fee",
    ride: { after: 25 * HOUR },
    expected: { t3: 125000, time: 30000, fees: 200000, total: 230000 },
  },
  {
    id: "TC-66",
    title: "exactly 24 h: 48 blocks, capped, no fee",
    ride: { after: 24 * HOUR },
    expected: { t3: 120000, time: 30000, fees: 0, total: 30000 },
  },
  {
    id: "TC-67",
    title: "24 h 00 min 01 s is 1441 min: the fee applies",
    ride: { after: 24 * HOUR + SECOND },
    expected: { minutes: 1441, t3: 122500, time: 30000, fees: 200000, total: 230000 },
  },
  {
    id: "TC-68",
    title: "25 h, return X02: both fees",
    ride: { after: 25 * HOUR, returnStation: "X02" },
    expected: { time: 30000, fees: 215000, total: 245000 },
  },
  {
    id: "TC-69",
    title: "concession, e-bike, 25 h: capped after the discount, no discount on the fee",
    ride: { after: 25 * HOUR, bike: "ebike" },
    rider: concession,
    expected: { t3: 200000, time: 30000, fees: 200000, total: 230000 },
  },
  {
    id: "TC-100",
    title: "concession, e-bike, 25 h, return X01: no discount on either fee",
    ride: { after: 25 * HOUR, bike: "ebike", returnStation: "X01" },
    rider: concession,
    expected: { t3: 200000, time: 30000, fees: 215000, total: 245000 },
  },
  {
    id: "TC-70",
    title: "at cap, 25 h: only the fee is left to pay",
    ledger: atCap,
    ride: { pickupAt: "2026-09-16T18:00:00Z", after: 25 * HOUR },
    expected: { time: 0, fees: 200000, total: 200000 },
  },
  {
    id: "TC-71",
    title: "72 h: the whole ride belongs to the pickup day, the fee is flat",
    ride: { after: 72 * HOUR },
    expected: { time: 30000, fees: 200000, total: 230000 },
  },
];

for (const { id, title, ledger = createDayCap, ride, rider = standard, expected } of rows) {
  test(`T8: ${id} ${title}`, () => {
    assertPrice(price(ride, rider, ledger()), expected);
  });
}
