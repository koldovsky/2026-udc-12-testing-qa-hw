// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
import { randomRider } from "../helpers/factory.js";

// A week of daytime rides (09:00–19:00 in Kyiv, no night discount, no daily cap ledger),
// written out explicitly. Expected amounts come from the specification, not from a formula:
// T3 (docs/spec/tariffs.md:62-70) — every started 30 minutes is a block, 25 грн classic /
// 40 грн e-bike. Each 30-minute boundary is its own row: before, at, after.
const WEEK = [
  { day: "2026-09-21", at: "06:00", bike: "classic", minutes: 5, due: "25,00 грн" }, //  1 block
  { day: "2026-09-21", at: "15:00", bike: "classic", minutes: 29, due: "25,00 грн" }, //  1 block
  { day: "2026-09-22", at: "07:10", bike: "classic", minutes: 30, due: "25,00 грн" }, //  1 block
  { day: "2026-09-22", at: "12:40", bike: "classic", minutes: 31, due: "50,00 грн" }, //  2 blocks
  { day: "2026-09-23", at: "08:05", bike: "classic", minutes: 59, due: "50,00 грн" }, //  2 blocks
  { day: "2026-09-23", at: "15:27", bike: "classic", minutes: 60, due: "50,00 грн" }, //  2 blocks
  { day: "2026-09-24", at: "10:00", bike: "classic", minutes: 61, due: "75,00 грн" }, //  3 blocks
  { day: "2026-09-25", at: "09:26", bike: "ebike", minutes: 29, due: "40,00 грн" }, //  1 block
  { day: "2026-09-25", at: "13:15", bike: "ebike", minutes: 30, due: "40,00 грн" }, //  1 block
  { day: "2026-09-26", at: "11:00", bike: "ebike", minutes: 31, due: "80,00 грн" }, //  2 blocks
  { day: "2026-09-26", at: "14:30", bike: "ebike", minutes: 60, due: "80,00 грн" }, //  2 blocks
  { day: "2026-09-27", at: "07:45", bike: "ebike", minutes: 89, due: "120,00 грн" }, // 3 blocks
];

for (const { day, at, bike, minutes, due } of WEEK) {
  test(`every receipt of a week of rides ends with the amount due — T3: ${bike}, ${minutes} min on ${day} → ${due}`, () => {
    const pickup = Date.parse(`${day}T${at}:00Z`);
    const ride = {
      pickupAt: new Date(pickup).toISOString(),
      returnAt: new Date(pickup + minutes * 60_000).toISOString(),
      bike,
      returnStation: "S01",
    };

    const lines = formatReceipt(quote(ride, { id: "U1", type: "standard" }));

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
