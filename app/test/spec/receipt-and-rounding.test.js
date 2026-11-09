import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt, formatUah } from "../../src/receipt.js";
import { discount } from "../../src/tariff.js";
import { at, run } from "../helpers/spec.js";

// T9. The spec fixes the amounts and the order of receipt lines, not their labels or the exact
// minus / thousands-separator characters (Q-6), so receipts are checked by amounts and order only.
const plain = (s) => s.replace(/[  ]/g, " ").replace(/−/g, "-");
const receipt = (input) => formatReceipt(run(input)).map(plain);

const roundingCases = [
  { id: "TC-57", percent: 30, of: 1235, due: 864, off: 371 },
  { id: "TC-58", percent: 50, of: 1001, due: 500, off: 501 },
];

for (const c of roundingCases) {
  test(`T9: ${c.id} ${c.percent} % off ${c.of} kopecks rounds the amount due down`, () => {
    const off = discount(c.of, c.percent);
    assert.equal(c.of - off, c.due);
    assert.equal(off, c.off);
  });
}

const formatCases = [
  { id: "TC-59", kopecks: 230000, text: "2 300,00 грн" },
  { id: "TC-61", kopecks: 0, text: "0,00 грн" },
  { id: "TC-61", kopecks: 5, text: "0,05 грн" },
  { id: "TC-61", kopecks: 100000, text: "1 000,00 грн" },
  { id: "TC-61", kopecks: 245000, text: "2 450,00 грн" },
];

for (const c of formatCases) {
  test(`T9: ${c.id} ${c.kopecks} kopecks is «${c.text}»`, () => {
    assert.equal(plain(formatUah(c.kopecks)), c.text);
  });
}

test("T9: TC-60 receipt for 25 h: duration, time charge, cap, fee, total in order", () => {
  const lines = receipt({ from: at(16, "12:00:00"), to: at(17, "13:00:00") });
  assert.equal(lines.length, 5);
  assert.ok(lines[0].includes("1500"));
  assert.ok(lines[1].endsWith("1 250,00 грн"));
  assert.ok(lines[2].endsWith("-950,00 грн"));
  assert.ok(lines[3].endsWith("2 000,00 грн"));
  assert.ok(lines[4].endsWith("2 300,00 грн"));
});

test("T9: TC-62 receipt for a reduced-fare ride: separate discount line with a minus", () => {
  const lines = receipt({ rider: "reduced", from: at(16, "12:00:00"), to: at(16, "12:40:00") });
  assert.equal(lines.length, 4);
  assert.ok(lines[1].endsWith("50,00 грн"));
  assert.ok(lines[2].endsWith("-25,00 грн"));
  assert.ok(lines[3].endsWith("25,00 грн"));
});

test("T9: TC-63 receipt for an out-of-zone ride: separate fee line", () => {
  const lines = receipt({ station: "X01", from: at(16, "12:00:00"), to: at(16, "12:20:00") });
  assert.equal(lines.length, 4);
  assert.ok(lines[0].includes("20"));
  assert.ok(lines[1].endsWith("25,00 грн"));
  assert.ok(lines[2].endsWith("150,00 грн"));
  assert.ok(lines[3].endsWith("175,00 грн"));
});
