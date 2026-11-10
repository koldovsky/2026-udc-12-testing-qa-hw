// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
import { randomRider, randomRides } from "../helpers/factory.js";

const PRICE = { classic: 2500, ebike: 4000 };
const uah = (kopecks) => `${(kopecks / 100).toFixed(2).replace(".", ",")} грн`;

const assertReceiptEndsWithAmountDue = (ride, rider) => {
  const minutes = (Date.parse(ride.returnAt) - Date.parse(ride.pickupAt)) / 60_000;
  const expected = Math.ceil(minutes / 30) * PRICE[ride.bike];

  const lines = formatReceipt(quote(ride, rider));

  assert.ok(lines.at(-1).startsWith("До сплати "));
  assert.ok(
    lines.at(-1).endsWith(` ${uah(expected)}`),
    `${ride.bike}, ${minutes} min from ${ride.pickupAt}: got "${lines.at(-1)}", expected ${uah(expected)}`,
  );
};

test("T3: every receipt of a week of rides ends with the amount due", () => {
  const rider = randomRider();
  for (const ride of randomRides(10)) {
    assertReceiptEndsWithAmountDue(ride, rider);
  }
});

// Boundaries of T3: exactly 30 min is one block (spec: TC-07); rides of exactly
// multiple-of-30 minutes used to flake when random picks happened to hit them.
test("T3: a receipt for a ride of exactly 30 min bills one block", () => {
  const ride = {
    pickupAt: "2026-09-21T09:00:00Z",
    returnAt: "2026-09-21T09:30:00Z",
    bike: "classic",
    returnStation: "S01",
  };

  assert.deepEqual(formatReceipt(quote(ride, randomRider())), [
    "Тривалість поїздки: 30 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "До сплати .......................... 25,00 грн",
  ]);
});

test("T3: a receipt for a ride of exactly 60 min bills two blocks", () => {
  const ride = {
    pickupAt: "2026-09-21T09:00:00Z",
    returnAt: "2026-09-21T10:00:00Z",
    bike: "classic",
    returnStation: "S01",
  };

  assert.deepEqual(formatReceipt(quote(ride, randomRider())), [
    "Тривалість поїздки: 60 хв",
    "Погодинне нарахування .............. 50,00 грн",
    "До сплати .......................... 50,00 грн",
  ]);
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
