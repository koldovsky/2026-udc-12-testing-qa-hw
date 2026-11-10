// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";

const rider = { id: "rider-1", type: "standard" };

// A week of day-time rides (21.09.2026, Kyiv, EEST +03:00 — no night discount, in-zone station).
// Fixed data instead of random rides: the old test drew 5–89 random minutes and expected
// (floor(min / 30) + 1) blocks, which is one block too many exactly at 30 and 60 min — it failed
// whenever the dice landed there (Task D, docs/triage.md). Every block boundary is now a row.
// Expected amounts: T3 (docs/spec/tariffs.md:62-67) — 25 / 40 UAH per started 30 minutes.
const WEEK = [
  { bike: "classic", from: "09:00", to: "09:05", due: "25,00 грн" }, // 5 min → 1 block
  { bike: "classic", from: "09:30", to: "09:59", due: "25,00 грн" }, // 29 min → 1 block
  { bike: "classic", from: "10:00", to: "10:30", due: "25,00 грн" }, // 30 min → 1 block (was the flaky case)
  { bike: "classic", from: "11:00", to: "11:31", due: "50,00 грн" }, // 31 min → 2 blocks
  { bike: "classic", from: "12:00", to: "13:00", due: "50,00 грн" }, // 60 min → 2 blocks (was the flaky case)
  { bike: "classic", from: "13:30", to: "14:31", due: "75,00 грн" }, // 61 min → 3 blocks
  { bike: "classic", from: "15:00", to: "16:29", due: "75,00 грн" }, // 89 min → 3 blocks
  { bike: "ebike", from: "16:30", to: "17:00", due: "40,00 грн" }, // 30 min → 1 block
  { bike: "ebike", from: "17:10", to: "18:10", due: "80,00 грн" }, // 60 min → 2 blocks
  { bike: "ebike", from: "18:15", to: "19:16", due: "120,00 грн" }, // 61 min → 3 blocks
];

for (const { bike, from, to, due } of WEEK) {
  test(`T3: a receipt ends with the amount due — ${bike}, ${from}–${to} → ${due}`, () => {
    const ride = { pickupAt: `2026-09-21T${from}:00+03:00`, returnAt: `2026-09-21T${to}:00+03:00`, bike, returnStation: "S03" };

    const lines = formatReceipt(quote(ride, rider));

    assert.ok(lines.at(-1).startsWith("До сплати "), lines.at(-1));
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
