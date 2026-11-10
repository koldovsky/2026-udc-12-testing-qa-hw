// T9 — суми, округлення, чек. Кейси TC-64…TC-68 з docs/test-cases.md.
// Назви рядків чека специфікація не задає: перевіряються наявність рядка, сума і знак,
// а з тексту — лише «До сплати» (його називає специфікація).
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt, formatUah } from "../../src/receipt.js";
import { discount } from "../../src/tariff.js";
import { KL, ST, label, quoteRow } from "./support.js";

// Округлення вниз на рівні функції знижки.
const DISCOUNTS = [
  { id: "TC-64", rule: "T9", amount: 1235, percent: 30, due: 864, discount: 371 },
  { id: "TC-65", rule: "T9", amount: 2501, percent: 50, due: 1250, discount: 1251 },
];

for (const row of DISCOUNTS) {
  test(`${row.rule}: ${row.id} ${row.amount} коп. − ${row.percent} % → до сплати ${row.due}, знижка ${row.discount}`, () => {
    const off = discount(row.amount, row.percent);
    assert.equal(off, row.discount, "discount");
    assert.equal(row.amount - off, row.due, "amount due");
  });
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A receipt line that ends with this amount, «-» or «−» for the minus sign. */
const amountAtEnd = (uah) => new RegExp(`(^|\\s)${escape(uah).replace(/^-/, "[-−]")}$`);
const NEGATIVE_AMOUNT = /\s[-−]\d[\d ]*,\d{2} грн$/;

const RECEIPTS = [
  {
    id: "TC-66",
    rule: "T9, T8",
    ride: { rider: ST, bike: KL, from: "16.09 10:00:00", to: "17.09 11:00:00" }, // = TC-57
    lines: [
      { what: "duration 1500 хв", pattern: /(^|\D)1500 хв/ },
      { what: "T3 time charge 1 250,00 грн", pattern: amountAtEnd("1 250,00 грн") },
      { what: "day-cap line with a minus sign", pattern: NEGATIVE_AMOUNT },
      { what: "unreturned fee 2 000,00 грн", pattern: amountAtEnd("2 000,00 грн") },
    ],
    due: "2 300,00 грн",
  },
  {
    id: "TC-67",
    rule: "T9, T10, T7",
    ride: { rider: ST, bike: KL, from: "01:10:00", to: "01:40:00", station: "X01" }, // = TC-74
    lines: [
      { what: "duration 30 хв", pattern: /(^|\D)30 хв/ },
      { what: "T3 time charge 25,00 грн", pattern: amountAtEnd("25,00 грн") },
      { what: "night discount −7,50 грн", pattern: amountAtEnd("-7,50 грн") },
      { what: "out-of-zone fee 150,00 грн", pattern: amountAtEnd("150,00 грн") },
    ],
    due: "167,50 грн",
  },
];

for (const row of RECEIPTS) {
  test(`${row.rule}: ${row.id} чек ${label(row.ride)} → «До сплати» ${row.due}`, () => {
    const lines = formatReceipt(quoteRow(row.ride));
    for (const { what, pattern } of row.lines) {
      assert.ok(
        lines.some((line) => pattern.test(line)),
        `no receipt line for ${what}:\n${lines.join("\n")}`,
      );
    }
    const last = lines.at(-1);
    assert.ok(last.includes("До сплати"), `the last line is not «До сплати»: ${last}`);
    assert.match(last, amountAtEnd(row.due));
  });
}

// Формат суми: гривні, два знаки, кома, пробіл між тисячами.
const AMOUNTS = [
  { id: "TC-68", rule: "T9", kopecks: 300, text: "3,00 грн" },
  { id: "TC-68", rule: "T9", kopecks: 1750, text: "17,50 грн" },
  { id: "TC-68", rule: "T9", kopecks: 245000, text: "2 450,00 грн" },
];

for (const row of AMOUNTS) {
  test(`${row.rule}: ${row.id} ${row.kopecks} коп. → «${row.text}»`, () => {
    assert.equal(formatUah(row.kopecks), row.text);
  });
}
