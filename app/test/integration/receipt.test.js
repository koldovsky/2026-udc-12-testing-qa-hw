// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
import { randomRider } from "../helpers/factory.js";

// A fixed week of daytime rides (Kyiv time, no night discount) of a standard rider.
// Durations sit on both sides of the 30-minute block boundary; amounts are T3 by hand:
// every started 30 minutes is a block of 25 / 40 UAH (docs/spec/tariffs.md:62-70).
const WEEK = [
  { day: "21", bike: "classic", minutes: 5, due: "25,00 грн" },
  { day: "21", bike: "classic", minutes: 30, due: "25,00 грн" },
  { day: "22", bike: "classic", minutes: 31, due: "50,00 грн" },
  { day: "22", bike: "classic", minutes: 50, due: "50,00 грн" },
  { day: "23", bike: "classic", minutes: 60, due: "50,00 грн" },
  { day: "24", bike: "classic", minutes: 61, due: "75,00 грн" },
  { day: "25", bike: "ebike", minutes: 29, due: "40,00 грн" },
  { day: "25", bike: "ebike", minutes: 30, due: "40,00 грн" },
  { day: "26", bike: "ebike", minutes: 75, due: "120,00 грн" },
  { day: "27", bike: "ebike", minutes: 89, due: "120,00 грн" },
];

for (const { day, bike, minutes, due } of WEEK) {
  test(`every receipt of a week of rides ends with the amount due: ${bike}, ${minutes} min → ${due}`, () => {
    const pickup = Date.parse(`2026-09-${day}T10:00:00+03:00`);
    const ride = {
      pickupAt: new Date(pickup).toISOString(),
      returnAt: new Date(pickup + minutes * 60_000).toISOString(),
      bike,
      returnStation: "S03",
    };

    const lines = formatReceipt(quote(ride, { id: "rider-1", type: "standard" }));

    assert.match(lines.at(-1), new RegExp(`^До сплати \\.+ ${due}$`));
  });
}

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
