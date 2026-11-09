// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
const standard = { id: "receipt-rider", type: "standard" };
// T3, docs/spec/tariffs.md:62-70: literal expected prices, including exact block boundaries.
const receiptCases = [
  ["classic", 5, 2500], ["ebike", 5, 4000],
  ["classic", 29, 2500], ["ebike", 29, 4000],
  ["classic", 30, 2500], ["ebike", 30, 4000],
  ["classic", 31, 5000], ["ebike", 31, 8000],
  ["classic", 59, 5000], ["ebike", 59, 8000],
  ["classic", 60, 5000], ["ebike", 60, 8000],
  ["classic", 61, 7500], ["ebike", 61, 12000],
  ["classic", 89, 7500], ["ebike", 89, 12000],
];
const uah = (kopecks) => `${(kopecks / 100).toFixed(2).replace(".", ",")} грн`;

test("every receipt of a week of rides ends with the amount due", () => {
  for (const [index, [bike, minutes, expected]] of receiptCases.entries()) {
    const pickupAt = `2026-09-${21 + index % 7}T07:00:00Z`;
    const ride = { pickupAt, returnAt: new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString(), bike, returnStation: "S01" };
    const lines = formatReceipt(quote(ride, standard));

    assert.ok(lines.at(-1).startsWith("До сплати "));
    assert.ok(
      lines.at(-1).endsWith(` ${uah(expected)}`),
      `${ride.bike}, ${minutes} min from ${ride.pickupAt}: got "${lines.at(-1)}", expected ${uah(expected)}`,
    );
  }
});

test("a receipt lists the fee for a return outside the zone", () => {
  const ride = {
    pickupAt: "2026-09-21T07:15:00Z",
    returnAt: "2026-09-21T07:35:00Z",
    bike: "classic",
    returnStation: "X02",
  };

  const lines = formatReceipt(quote(ride, standard));

  assert.deepEqual(lines, [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ]);
});
