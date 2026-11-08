import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt, formatUah } from "../../src/receipt.js";

test("amounts are shown in hryvnias", () => {
  assert.equal(formatUah(5000), "50,00 грн");
  assert.equal(formatUah(230000), "2 300,00 грн");
  assert.equal(formatUah(-1250), "-12,50 грн");
});

test("a receipt has a line for every item", () => {
  const lines = formatReceipt({
    minutes: 40,
    timeCharge: 5000,
    discounts: [{ code: "night", amount: 1500 }],
    fees: [{ code: "out-of-zone", amount: 15000 }],
    total: 18500,
  });
  assert.equal(lines.length, 5);
  assert.ok(lines.at(-1).includes("185,00"));
  // T9, docs/spec/tariffs.md:132-135 — duration, T3 line, discount with a minus, fee, total.
  // Order of the middle lines and the minus character are open question Q-14 (docs/test-plan.md): not asserted.
  assert.ok(lines.some((l) => l.includes("40 хв")));
  assert.ok(lines.some((l) => l.endsWith(" 50,00 грн")));
  assert.ok(lines.some((l) => /[-−]15,00 грн$/.test(l)));
  assert.ok(lines.some((l) => l.endsWith(" 150,00 грн")));
  assert.ok(lines.at(-1).startsWith("До сплати"));
});
