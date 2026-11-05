// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";

// A week of daytime rides of a standard rider, in-zone, picked up 21.09.2026 between 09:00 and 19:00
// Kyiv time (06:00Z–16:00Z): no night discount, no fees. The expected amount is written out from
// T3 (docs/spec/tariffs.md:62-67) — every started 30 minutes is a block, classic 25 грн, e-bike 40 грн.
// Fixed data instead of random rides: the old oracle `floor(minutes / 30) + 1` was wrong exactly on
// 30 and 60 minutes, and random durations hit those values in about 1 run of 5 (docs/triage.md, part 1).
const WEEK = [
  // [pickupAt, minutes, bike, expected amount due]
  ["2026-09-21T06:00:00Z", 5, "classic", "25,00 грн"],
  ["2026-09-21T06:38:00Z", 29, "classic", "25,00 грн"],
  ["2026-09-21T07:10:00Z", 30, "classic", "25,00 грн"],
  ["2026-09-21T08:00:00Z", 31, "classic", "50,00 грн"],
  ["2026-09-21T09:00:00Z", 60, "classic", "50,00 грн"],
  ["2026-09-21T10:30:00Z", 61, "classic", "75,00 грн"],
  ["2026-09-21T11:31:00Z", 89, "classic", "75,00 грн"],
  ["2026-09-21T13:00:00Z", 30, "ebike", "40,00 грн"],
  ["2026-09-21T14:00:00Z", 60, "ebike", "80,00 грн"],
  ["2026-09-21T15:00:00Z", 61, "ebike", "120,00 грн"],
];
const rider = { id: "rider-1001", type: "standard" };

for (const [pickupAt, minutes, bike, due] of WEEK) {
  test(`every receipt of a week of rides ends with the amount due: ${bike}, ${minutes} min → ${due}`, () => {
    const ride = {
      pickupAt,
      returnAt: new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString(),
      bike,
      returnStation: "S03",
    };

    const lines = formatReceipt(quote(ride, rider));

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

  const lines = formatReceipt(quote(ride, rider));

  assert.deepEqual(lines, [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ]);
});
