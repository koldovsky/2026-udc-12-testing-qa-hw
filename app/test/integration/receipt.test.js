// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";

const RIDER = { id: "rider-1001", type: "standard" };

// Daytime rides in the zone for a standard rider, so the amount due is the T3 time charge alone:
// every started 30 minutes is a block, 25 UAH classic, 40 UAH e-bike (docs/spec/tariffs.md:62-67).
// The durations cover the range the old random data drew from (5–89 min) and both sides of every
// block boundary. The first three rows are the rides that failed in ai-runs/d-repeat-before.txt.
const RIDES = [
  { bike: "classic", pickupAt: "2026-09-21T06:57:00Z", minutes: 30, due: "25,00 грн" }, // 1 block
  { bike: "classic", pickupAt: "2026-09-21T09:58:00Z", minutes: 60, due: "50,00 грн" }, // 2 blocks
  { bike: "ebike", pickupAt: "2026-09-21T13:21:00Z", minutes: 30, due: "40,00 грн" }, // 1 block
  { bike: "classic", pickupAt: "2026-09-21T06:00:00Z", minutes: 5, due: "25,00 грн" }, // 1 block
  { bike: "classic", pickupAt: "2026-09-21T07:00:00Z", minutes: 29, due: "25,00 грн" }, // 1 block
  { bike: "classic", pickupAt: "2026-09-21T08:00:00Z", minutes: 31, due: "50,00 грн" }, // 2 blocks
  { bike: "classic", pickupAt: "2026-09-21T09:00:00Z", minutes: 59, due: "50,00 грн" }, // 2 blocks
  { bike: "classic", pickupAt: "2026-09-21T10:00:00Z", minutes: 61, due: "75,00 грн" }, // 3 blocks
  { bike: "classic", pickupAt: "2026-09-21T16:00:00Z", minutes: 89, due: "75,00 грн" }, // 3 blocks
  { bike: "ebike", pickupAt: "2026-09-21T06:00:00Z", minutes: 5, due: "40,00 грн" }, // 1 block
  { bike: "ebike", pickupAt: "2026-09-21T11:00:00Z", minutes: 31, due: "80,00 грн" }, // 2 blocks
  { bike: "ebike", pickupAt: "2026-09-21T12:00:00Z", minutes: 60, due: "80,00 грн" }, // 2 blocks
  { bike: "ebike", pickupAt: "2026-09-21T14:00:00Z", minutes: 61, due: "120,00 грн" }, // 3 blocks
  { bike: "ebike", pickupAt: "2026-09-21T16:00:00Z", minutes: 89, due: "120,00 грн" }, // 3 blocks
];

for (const { bike, pickupAt, minutes, due } of RIDES) {
  test(`every receipt of a week of rides ends with the amount due: ${bike}, ${minutes} min from ${pickupAt}`, () => {
    const returnAt = new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString();
    const ride = { pickupAt, returnAt, bike, returnStation: "S03" };

    const lines = formatReceipt(quote(ride, RIDER));

    assert.ok(lines.at(-1).startsWith("До сплати "), `the last line is not the amount due: "${lines.at(-1)}"`);
    assert.ok(lines.at(-1).endsWith(` ${due}`), `got "${lines.at(-1)}", expected ${due}`);
  });
}

test("a receipt lists the fee for a return outside the zone", () => {
  const ride = {
    pickupAt: "2026-09-21T07:15:00Z",
    returnAt: "2026-09-21T07:35:00Z",
    bike: "classic",
    returnStation: "X02",
  };

  const lines = formatReceipt(quote(ride, RIDER));

  assert.deepEqual(lines, [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ]);
});
