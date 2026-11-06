// T9: rounding and the receipt. Rows follow docs/test-cases.md.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt, formatUah } from "../../src/receipt.js";
import { discount, quote } from "../../src/tariff.js";
import { HOUR, MINUTE, concession, ride, standard, subscriber } from "./support.js";

const roundingRows = [
  { id: "TC-72", amount: 1235, percent: 30, payable: 864, discounted: 371 },
  { id: "TC-73", amount: 999, percent: 50, payable: 499, discounted: 500 },
  { id: "TC-74", amount: 1, percent: 50, payable: 0, discounted: 1 },
];

for (const { id, amount, percent, payable, discounted } of roundingRows) {
  test(`T9: ${id} ${percent} % off ${amount}: payable ${payable}, rounded down`, () => {
    const result = discount(amount, percent);
    assert.deepEqual({ payable: amount - result, discounted: result }, { payable, discounted });
  });
}

const amountRows = [
  { id: "TC-75", kopecks: 230000, text: "2 300,00 грн" },
  { id: "TC-76", kopecks: 99999, text: "999,99 грн" },
  { id: "TC-76", kopecks: 100000, text: "1 000,00 грн" },
  { id: "TC-77", kopecks: 0, text: "0,00 грн" },
  { id: "TC-77", kopecks: 5, text: "0,05 грн" },
  { id: "TC-77", kopecks: 1750, text: "17,50 грн" },
];

for (const { id, kopecks, text } of amountRows) {
  test(`T9: ${id} receipt amount ${kopecks} is ${text}`, () => {
    assert.equal(formatUah(kopecks), text);
  });
}

// Only `До сплати` has fixed wording and the minus character is open (Q-5), so lines are
// found by their amount: any label, either minus character.
const LINE_AMOUNT = /([−-]?\d{1,3}(?: \d{3})*,\d{2} грн)$/;

const amountOf = (line) => line.match(LINE_AMOUNT)?.[1].replace("−", "-");

function assertReceipt(lines, { minutes, items, total, onlyTheseItems = false, minusLine = false }) {
  const summary = lines.filter((line) => line.startsWith("До сплати"));
  assert.deepEqual(summary.map(amountOf), [total]);

  if (minutes !== undefined) {
    assert.ok(lines.some((line) => new RegExp(`\\b${minutes} хв`).test(line)), `no duration in:\n${lines.join("\n")}`);
  }

  const left = lines.filter((line) => !summary.includes(line)).map(amountOf).filter(Boolean);
  for (const item of items) {
    const index = left.indexOf(item);
    assert.notEqual(index, -1, `no line with ${item} in:\n${lines.join("\n")}`);
    left.splice(index, 1);
  }
  if (onlyTheseItems) assert.deepEqual(left, []);
  if (minusLine) assert.ok(left.some((amount) => amount.startsWith("-")), `no minus line in:\n${lines.join("\n")}`);
}

const receiptRows = [
  {
    id: "TC-78",
    title: "25 h, return X01: T3, cap, T7 and T8 lines (cap amount depends on Q-1, not asserted)",
    ride: { after: 25 * HOUR, returnStation: "X01" },
    expected: {
      minutes: 1500,
      items: ["1 250,00 грн", "150,00 грн", "2 000,00 грн"],
      minusLine: true,
      total: "2 450,00 грн",
    },
  },
  {
    id: "TC-79",
    title: "concession, classic, 40 min: T3 and discount lines",
    ride: { after: 40 * MINUTE },
    rider: concession,
    expected: { items: ["50,00 грн", "-25,00 грн"], total: "25,00 грн" },
  },
  {
    id: "TC-80",
    title: "classic, 50 min: no discount, cap or fee lines",
    ride: { after: 50 * MINUTE },
    expected: { items: ["50,00 грн"], onlyTheseItems: true, total: "50,00 грн" },
  },
  {
    id: "TC-89",
    title: "classic, 361 min, return X01: T3, cap and T7 lines",
    ride: { after: 361 * MINUTE, returnStation: "X01" },
    expected: { minutes: 361, items: ["325,00 грн", "-25,00 грн", "150,00 грн"], total: "450,00 грн" },
  },
  {
    id: "TC-95",
    title: "the night ride of TC-81: T3 and discount lines",
    ride: { pickupAt: "2026-09-16T22:10:00Z", returnAt: "2026-09-16T22:40:00Z" },
    expected: { items: ["25,00 грн", "-7,50 грн"], total: "17,50 грн" },
  },
  {
    id: "TC-96",
    title: "subscriber, e-bike, 30 min: T3 and discount lines",
    ride: { after: 30 * MINUTE, bike: "ebike" },
    rider: subscriber,
    expected: { items: ["40,00 грн", "-8,00 грн"], total: "32,00 грн" },
  },
];

for (const { id, title, ride: rideSpec, rider = standard, expected } of receiptRows) {
  test(`T9: ${id} receipt, ${title}`, () => {
    assertReceipt(formatReceipt(quote(ride(rideSpec), rider)), expected);
  });
}
