// docs/test-cases.md TC-48…TC-50 — T9 (amounts, rounding, receipt).
// Expectations: docs/test-cases.md, docs/spec/tariffs.md:127-137.

import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { discount, quote } from "../../src/tariff.js";
import { ride, rider } from "../helpers/spec.js";

// "Пробіл" between thousands (:132-133): a plain, no-break or narrow no-break space.
const SP = "[ \\u00a0\\u202f]";
const MINUS = "[-−]";

test("T9: TC-48 — знижка 30 % від 1 235 коп. → до сплати 864 (вниз), знижка 371", () => {
  const off = discount(1235, 30);
  assert.deepEqual({ due: 1235 - off, discount: off }, { due: 864, discount: 371 });
});

test("T9: TC-49 — чек поїздки TC-44 (25 год): «До сплати» — 2 300,00 грн", () => {
  const result = quote(ride({ from: "10:00", to: "11:00", toDate: "2026-09-17" }), rider());
  const lines = formatReceipt(result);
  const due = lines.find((line) => line.startsWith("До сплати"));
  assert.ok(due, `немає рядка «До сплати»:\n${lines.join("\n")}`);
  assert.match(due, new RegExp(`${SP}2${SP}300,00 грн$`));
});

// TC-50: the receipt of TC-29 (reduced, 20 min, X01) — one row per required line.
const TC50_LINES = [
  { what: "тривалість 20 хв", pattern: /(^|\D)20 хв/ },
  { what: "погодинне за T3 25,00 грн", pattern: new RegExp(`${SP}25,00 грн$`) },
  { what: "пільга зі знаком мінус −12,50 грн", pattern: new RegExp(`${MINUS}${SP}?12,50 грн$`) },
  { what: "збір T7 150,00 грн", pattern: new RegExp(`${SP}150,00 грн$`) },
  { what: "«До сплати» 162,50 грн", pattern: new RegExp(`^До сплати.*${SP}162,50 грн$`) },
];

const tc50Receipt = () => formatReceipt(quote(ride({ minutes: 20, station: "X01" }), rider("reduced")));

for (const expected of TC50_LINES) {
  test(`T9: TC-50 — чек поїздки TC-29 містить рядок: ${expected.what}`, () => {
    const lines = tc50Receipt();
    assert.ok(
      lines.some((line) => expected.pattern.test(line)),
      `немає рядка «${expected.what}» у чеку:\n${lines.join("\n")}`,
    );
  });
}
