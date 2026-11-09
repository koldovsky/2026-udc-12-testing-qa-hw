// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
import { randomRider } from "../helpers/factory.js";

// T3 (tariffs.md:62-67): a started block of 30 min costs 25 UAH (classic) / 40 UAH (e-bike),
// so 30 min is one block and 31 min is two. The table is fixed: it was random before, and a
// random duration that was a multiple of 30 (30, 60, 90) made the test fail now and then,
// because it counted floor(minutes / 30) + 1 blocks instead of the started ones.
// 09:00 Kyiv, a weekday: no night discount, no cap, no fees, no free start.
const PICKUP = "2026-09-21T06:00:00Z";
const AMOUNT_DUE = [
  ["classic", 5, "25,00 грн"],
  ["classic", 29, "25,00 грн"],
  ["classic", 30, "25,00 грн"],
  ["classic", 31, "50,00 грн"],
  ["classic", 59, "50,00 грн"],
  ["classic", 60, "50,00 грн"],
  ["classic", 61, "75,00 грн"],
  ["classic", 89, "75,00 грн"],
  ["ebike", 5, "40,00 грн"],
  ["ebike", 30, "40,00 грн"],
  ["ebike", 31, "80,00 грн"],
  ["ebike", 60, "80,00 грн"],
  ["ebike", 61, "120,00 грн"],
  ["ebike", 89, "120,00 грн"],
];

test("every receipt of a week of rides ends with the amount due", () => {
  for (const [bike, minutes, due] of AMOUNT_DUE) {
    const ride = {
      pickupAt: PICKUP,
      returnAt: new Date(Date.parse(PICKUP) + minutes * 60_000).toISOString(),
      bike,
      returnStation: "S01",
    };

    const lines = formatReceipt(quote(ride, { type: "standard" }));

    assert.ok(lines.at(-1).startsWith("До сплати "));
    assert.ok(lines.at(-1).endsWith(` ${due}`), `${bike}, ${minutes} min: got "${lines.at(-1)}", expected ${due}`);
  }
});

test("a receipt lists the fee for a return outside the zone", () => {
  const ride = {
    pickupAt: "2026-09-21T07:15:00Z",
    returnAt: "2026-09-21T07:35:00Z",
    bike: "classic",
    returnStation: "X02",
  };

  const lines = formatReceipt(quote(ride, randomRider()));

  assert.deepEqual(lines, [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ]);
});
