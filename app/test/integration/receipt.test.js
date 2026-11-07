// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";

// Fixed rides on both sides of the 30- and 60-minute block boundaries, so every run checks the
// same cases. A block is each started 30 minutes (docs/spec/tariffs.md:29, 62); the block price is
// 25 UAH for a classic bike and 40 UAH for an e-bike (docs/spec/tariffs.md:66-67). Pickups are
// daytime in Kyiv (UTC+3 on 21.09.2026), so the night discount (T10) does not apply. The two
// 30-minute pickups are those of the failed runs in ai-runs/d-repeat-before.txt.
const rider = { id: "rider-1001", type: "standard" };
const rides = [
  { case: "classic, 5 min is 1 block", bike: "classic", pickupAt: "2026-09-21T07:00:00Z", minutes: 5, due: "25,00 грн" },
  { case: "classic, 30 min is 1 block", bike: "classic", pickupAt: "2026-09-21T06:03:00Z", minutes: 30, due: "25,00 грн" },
  { case: "classic, 31 min is 2 blocks", bike: "classic", pickupAt: "2026-09-21T07:00:00Z", minutes: 31, due: "50,00 грн" },
  { case: "classic, 60 min is 2 blocks", bike: "classic", pickupAt: "2026-09-21T07:00:00Z", minutes: 60, due: "50,00 грн" },
  { case: "classic, 61 min is 3 blocks", bike: "classic", pickupAt: "2026-09-21T07:00:00Z", minutes: 61, due: "75,00 грн" },
  { case: "e-bike, 30 min is 1 block", bike: "ebike", pickupAt: "2026-09-21T14:43:00Z", minutes: 30, due: "40,00 грн" },
  { case: "e-bike, 31 min is 2 blocks", bike: "ebike", pickupAt: "2026-09-21T07:00:00Z", minutes: 31, due: "80,00 грн" },
  { case: "e-bike, 60 min is 2 blocks", bike: "ebike", pickupAt: "2026-09-21T07:00:00Z", minutes: 60, due: "80,00 грн" },
  { case: "e-bike, 61 min is 3 blocks", bike: "ebike", pickupAt: "2026-09-21T07:00:00Z", minutes: 61, due: "120,00 грн" },
  { case: "e-bike, 89 min is 3 blocks", bike: "ebike", pickupAt: "2026-09-21T07:00:00Z", minutes: 89, due: "120,00 грн" },
];

for (const { case: name, bike, pickupAt, minutes, due } of rides) {
  test(`T3, T9: every receipt ends with the amount due, ${name}`, () => {
    const ride = {
      pickupAt,
      returnAt: new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString(),
      bike,
      returnStation: "S03",
    };

    const lines = formatReceipt(quote(ride, rider));

    assert.ok(lines.at(-1).startsWith("До сплати "), `got "${lines.at(-1)}"`);
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

  const lines = formatReceipt(quote(ride, rider));

  assert.deepEqual(lines, [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ]);
});
