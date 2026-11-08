// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
import { randomRider } from "../helpers/factory.js";

// A week of daytime rides by a standard rider. T3 (docs/spec/tariffs.md:62): every started 30
// minutes is a block of 25 грн (classic) or 40 грн (e-bike), so 30 min is 1 block and 31 min is 2.
// Fixed rides, not random ones: each run checks the same boundaries (29/30/31, 59/60/61 min).
const WEEK = [
  // pickup (Kyiv),             minutes, bike,     due
  ["2026-09-21T08:10:00+03:00", 5, "classic", "25,00 грн"],
  ["2026-09-21T18:40:00+03:00", 29, "ebike", "40,00 грн"],
  ["2026-09-22T09:56:00+03:00", 30, "classic", "25,00 грн"],
  ["2026-09-22T17:05:00+03:00", 30, "ebike", "40,00 грн"],
  ["2026-09-23T07:30:00+03:00", 31, "classic", "50,00 грн"],
  ["2026-09-23T12:15:00+03:00", 31, "ebike", "80,00 грн"],
  ["2026-09-24T11:40:00+03:00", 59, "classic", "50,00 грн"],
  ["2026-09-24T16:51:00+03:00", 60, "ebike", "80,00 грн"],
  ["2026-09-25T10:00:00+03:00", 60, "classic", "50,00 грн"],
  ["2026-09-25T19:20:00+03:00", 61, "ebike", "120,00 грн"],
  ["2026-09-26T13:00:00+03:00", 61, "classic", "75,00 грн"],
  ["2026-09-26T14:30:00+03:00", 59, "ebike", "80,00 грн"],
  ["2026-09-27T09:00:00+03:00", 89, "classic", "75,00 грн"],
  ["2026-09-27T15:45:00+03:00", 89, "ebike", "120,00 грн"],
];

test("every receipt of a week of rides ends with the amount due", () => {
  const rider = randomRider();
  for (const [pickupAt, minutes, bike, due] of WEEK) {
    const returnAt = new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString();
    const ride = { pickupAt, returnAt, bike, returnStation: "S03" };

    const lines = formatReceipt(quote(ride, rider));

    assert.ok(lines.at(-1).startsWith("До сплати "));
    assert.ok(
      lines.at(-1).endsWith(` ${due}`),
      `${bike}, ${minutes} min from ${pickupAt}: got "${lines.at(-1)}", expected ${due}`,
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

  const lines = formatReceipt(quote(ride, randomRider()));

  assert.deepEqual(lines, [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ]);
});
