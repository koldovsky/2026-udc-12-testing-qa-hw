// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
import { randomRider } from "../helpers/factory.js";

// A fixed week of rides (21–27.09.2026, daytime in Kyiv, in-zone, standard rider): the
// boundaries of a block on both sides and the T3 examples. Expected amounts come from T3
// (docs/spec/tariffs.md:62-70): every started 30 minutes is a block, 25 грн classic / 40 грн e-bike.
// The data used to be random (5–89 min) and the expected amount a formula, Math.floor(m / 30) + 1,
// that is one block too many at exactly 30 and 60 min — so the test failed only when the dice
// landed on a boundary (docs/triage.md, section 1).
const WEEK = [
  { day: "21", bike: "classic", minutes: 5, due: "25,00 грн" }, // 1 block
  { day: "21", bike: "ebike", minutes: 29, due: "40,00 грн" }, // 1 block
  { day: "22", bike: "classic", minutes: 30, due: "25,00 грн" }, // exactly 30 → 1 block
  { day: "22", bike: "ebike", minutes: 30, due: "40,00 грн" }, // exactly 30 → 1 block
  { day: "23", bike: "classic", minutes: 31, due: "50,00 грн" }, // 2 blocks
  { day: "23", bike: "ebike", minutes: 31, due: "80,00 грн" }, // 2 blocks
  { day: "24", bike: "classic", minutes: 50, due: "50,00 грн" }, // T3 example: 2 blocks → 50 грн
  { day: "25", bike: "ebike", minutes: 60, due: "80,00 грн" }, // exactly 60 → 2 blocks
  { day: "26", bike: "classic", minutes: 61, due: "75,00 грн" }, // 3 blocks
  { day: "27", bike: "ebike", minutes: 75, due: "120,00 грн" }, // T3 example: 3 blocks → 120 грн
  { day: "27", bike: "classic", minutes: 89, due: "75,00 грн" }, // 3 blocks
];

function rideOf({ day, bike, minutes }) {
  const pickup = Date.parse(`2026-09-${day}T10:00:00+03:00`);
  return {
    pickupAt: new Date(pickup).toISOString(),
    returnAt: new Date(pickup + minutes * 60_000).toISOString(),
    bike,
    returnStation: "S01",
  };
}

test("every receipt of a week of rides ends with the amount due", () => {
  const rider = { id: "rider-1", type: "standard" };
  for (const item of WEEK) {
    const lines = formatReceipt(quote(rideOf(item), rider));

    assert.ok(lines.at(-1).startsWith("До сплати "));
    assert.ok(
      lines.at(-1).endsWith(` ${item.due}`),
      `${item.bike}, ${item.minutes} min on 2026-09-${item.day}: got "${lines.at(-1)}", expected ${item.due}`,
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
