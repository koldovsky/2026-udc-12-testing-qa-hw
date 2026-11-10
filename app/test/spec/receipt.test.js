// Spec-based tests for the receipt and amount format (T9, docs/spec/tariffs.md:132-135).
// Expected values: docs/test-cases.md only.

import { test } from "node:test";
import assert from "node:assert/strict";

import { quote } from "../../src/tariff.js";
import { formatReceipt, formatUah } from "../../src/receipt.js";
import { ride, rider } from "./support.js";

test("T9: TC-46 форматування 230000 коп. → «2 300,00 грн»", () => {
  assert.equal(formatUah(230000), "2 300,00 грн");
});

/** Each line must end with the amount; "-" and the minus sign "−" are both accepted for negatives. */
const endsWith = (line, amount) => new RegExp(`${amount.replace(/[-−]/, "[-−]")}$`).test(line);

const receipts = [
  {
    id: "TC-47",
    name: "чек 20 хв, X01",
    quote: () => quote(ride("10:00", "10:20", { station: "X01" }), rider()),
    lines: [["Тривалість", "20 хв"], ["Погодинне", "25,00 грн"], ["Збір", "150,00 грн"], ["До сплати", "175,00 грн"]],
  },
  {
    id: "TC-48",
    name: "чек 25 год",
    quote: () => quote(ride("09:00", ["10:00", "2026-09-17"]), rider()),
    lines: [
      ["Тривалість", "1500 хв"],
      ["Погодинне", "1 250,00 грн"],
      ["Денний ліміт", "−950,00 грн"],
      ["Збір", "2 000,00 грн"],
      ["До сплати", "2 300,00 грн"],
    ],
  },
  {
    id: "TC-60",
    name: "чек абонент+пільга, 80 хв",
    quote: () => quote(ride("10:00", "11:20"), rider("subscriber", { concession: true })),
    lines: [["Тривалість", "80 хв"], ["Погодинне", "75,00 грн"], ["Знижка", "−37,50 грн"], ["До сплати", "37,50 грн"]],
  },
];

for (const row of receipts) {
  test(`T9: ${row.id} ${row.name}: рядки по черзі з правильними сумами`, () => {
    const lines = formatReceipt(row.quote());
    assert.equal(lines.length, row.lines.length, `кількість рядків: ${lines.join(" | ")}`);
    row.lines.forEach(([label, amount], i) => {
      assert.ok(lines[i].startsWith(label), `рядок ${i + 1} починається з «${label}»: ${lines[i]}`);
      if (label === "Тривалість") assert.ok(lines[i].endsWith(amount), `рядок ${i + 1}: ${lines[i]}`);
      else assert.ok(endsWith(lines[i], amount), `рядок ${i + 1} закінчується на ${amount}: ${lines[i]}`);
    });
  });
}
