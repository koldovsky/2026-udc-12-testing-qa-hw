// T9 (суми, округлення, чек) — docs/test-cases.md TC-55…TC-61.
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { formatReceipt, formatUah } from "../../src/receipt.js";
import { discount } from "../../src/tariff.js";
import { STANDARD, price, ride } from "../helpers/spec.js";

test("T9: TC-55 знижка 30 % від 1 235 коп. — до сплати округлюється вниз до 864, знижка 371", () => {
  const off = discount(1235, 30);
  assert.equal(off, 371, "знижка, коп.");
  assert.equal(1235 - off, 864, "до сплати, коп.");
});

const amounts = [
  { id: "TC-56", kopecks: 230000, text: "2 300,00 грн" },
  { id: "TC-57а", kopecks: 99999, text: "999,99 грн" },
  { id: "TC-57б", kopecks: 100000, text: "1 000,00 грн" },
  { id: "TC-58а", kopecks: 1750, text: "17,50 грн" },
  { id: "TC-58б", kopecks: 5, text: "0,05 грн" },
];

for (const c of amounts) {
  test(`T9: ${c.id} ${c.kopecks} коп. → «${c.text}»`, () => {
    assert.equal(formatUah(c.kopecks), c.text);
  });
}

// Receipt checks. Line labels are the receipt's format (src/receipt.js); amounts come from the spec.
const lineFor = (lines, label) => {
  const found = lines.find((l) => l.startsWith(`${label} `));
  assert.ok(found, `у чеку немає рядка «${label}»:\n${lines.join("\n")}`);
  return found;
};
const assertLine = (lines, label, amount) => {
  const found = lineFor(lines, label);
  assert.ok(found.endsWith(` ${amount}`), `рядок «${found}» має закінчуватися на «${amount}»`);
};

test("T9 (+T6): TC-59 чек третьої поїздки з TC-33 — T3 120,00, ліміт −60,00, до сплати 60,00", () => {
  const ledger = createDayCap();
  const quotes = [
    ["2026-09-16T09:00:00+03:00", "2026-09-16T10:20:00+03:00"],
    ["2026-09-16T13:00:00+03:00", "2026-09-16T14:20:00+03:00"],
    ["2026-09-16T18:00:00+03:00", "2026-09-16T19:20:00+03:00"],
  ].map(([from, to]) => price(ride(from, to, { bike: "ebike" }), STANDARD, { ledger, id: "U1" }));

  const lines = formatReceipt(quotes[2]);

  assert.equal(lines[0], "Тривалість поїздки: 80 хв");
  assertLine(lines, "Погодинне нарахування", "120,00 грн");
  assertLine(lines, "Денний ліміт", "-60,00 грн");
  assert.ok(lines.at(-1).startsWith("До сплати "), `останній рядок — «До сплати»: ${lines.at(-1)}`);
  assertLine(lines, "До сплати", "60,00 грн");
});

test("T9 (+T7): TC-60 чек поїздки з TC-43 — T3 25,00, збір 150,00, до сплати 175,00, без знижок", () => {
  const q = price(ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:20:00+03:00", { station: "X01" }));

  const lines = formatReceipt(q);

  assert.equal(lines[0], "Тривалість поїздки: 20 хв");
  assertLine(lines, "Погодинне нарахування", "25,00 грн");
  assertLine(lines, "Збір: повернення поза зоною", "150,00 грн");
  assert.ok(lines.at(-1).startsWith("До сплати "), `останній рядок — «До сплати»: ${lines.at(-1)}`);
  assertLine(lines, "До сплати", "175,00 грн");
  assert.equal(lines.length, 4, `рядків знижок не має бути:\n${lines.join("\n")}`);
});

test("T9 (+T10): TC-61 чек поїздки з TC-62 — T3 25,00, нічна −7,50, до сплати 17,50", () => {
  const q = price(ride("2026-09-17T01:10:00+03:00", "2026-09-17T01:40:00+03:00"));

  const lines = formatReceipt(q);

  assert.equal(lines[0], "Тривалість поїздки: 30 хв");
  assertLine(lines, "Погодинне нарахування", "25,00 грн");
  assertLine(lines, "Знижка: нічна", "-7,50 грн");
  assert.ok(lines.at(-1).startsWith("До сплати "), `останній рядок — «До сплати»: ${lines.at(-1)}`);
  assertLine(lines, "До сплати", "17,50 грн");
});
