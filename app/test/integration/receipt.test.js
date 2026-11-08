// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";

const RIDER = { id: "rider-1", type: "standard" };
const PICKUP = "2026-09-21T09:00:00+03:00"; // a weekday morning in Kyiv: no night discount (T10)

const rideOf = (bike, minutes) => ({
  pickupAt: PICKUP,
  returnAt: new Date(Date.parse(PICKUP) + minutes * 60_000).toISOString(),
  bike,
  returnStation: "S01",
});

// T3 (docs/spec/tariffs.md:62, :29): a fee for every started 30 minutes — 25 UAH classic,
// 40 UAH e-bike. A ride of exactly 30 or 60 min starts no new block. T9 (:132–:135): the last
// line is «До сплати» with the amount in UAH.
const CASES = [
  { bike: "classic", minutes: 29, due: "25,00 грн" }, // 1 block × 25
  { bike: "classic", minutes: 30, due: "25,00 грн" }, // 1 block × 25
  { bike: "classic", minutes: 31, due: "50,00 грн" }, // 2 blocks × 25
  { bike: "ebike", minutes: 59, due: "80,00 грн" }, // 2 blocks × 40
  { bike: "ebike", minutes: 60, due: "80,00 грн" }, // 2 blocks × 40
  { bike: "ebike", minutes: 61, due: "120,00 грн" }, // 3 blocks × 40
];

for (const { bike, minutes, due } of CASES) {
  test(`T3, T9: the receipt of a ${minutes}-min ${bike} ride ends with «До сплати» ${due}`, () => {
    const last = formatReceipt(quote(rideOf(bike, minutes), RIDER)).at(-1);

    assert.ok(last.startsWith("До сплати "), last);
    assert.ok(last.endsWith(` ${due}`), last);
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
