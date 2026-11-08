// T9 — суми, округлення, чек: docs/test-cases.md, TC-70…TC-77, TC-94…TC-98.
// Знак мінуса — «-» чи «−»: перевіряється наявність знака, а не символ.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { discount } from "../../src/tariff.js";
import { ABOUT, assertReceipt, minusLine, plusLine, quoteRow, REDUCED, ride, SUBSCRIBER } from "./helpers.js";

// Знижка до суми: до сплати округлюється вниз до цілої копійки.
const ROUNDING = [
  { id: "TC-70", note: "30 % від 1235 коп.: 864,5 → 864", amount: 1235, percent: 30, due: 864, discount: 371 },
  { id: "TC-71", note: "50 % від 1003 коп.: рівно 501,5 → вниз, 501", amount: 1003, percent: 50, due: 501, discount: 502 },
  { id: "TC-72", note: "30 % від 1 коп.: 0,7 → 0", amount: 1, percent: 30, due: 0, discount: 1 },
];

for (const row of ROUNDING) {
  test(`T9: ${row.id} — ${row.note}`, () => {
    const off = discount(row.amount, row.percent);
    assert.deepEqual({ due: row.amount - off, discount: off }, { due: row.due, discount: row.discount });
  });
}

const ebike = { bike: "ebike" };

// Клас., станд., якщо не вказано інше.
const RECEIPTS = [
  {
    id: "TC-73",
    note: "чек TC-57: 20 хв, X01",
    ride: ride("16.09 10:00:00", "16.09 10:20:00", { station: "X01" }),
    duration: 20,
    items: [plusLine(ABOUT.hourly, "25,00 грн"), plusLine(ABOUT.outOfZone, "150,00 грн"), plusLine(ABOUT.due, "175,00 грн")],
  },
  {
    id: "TC-74",
    note: "чек TC-32: пільг., 40 хв",
    rider: REDUCED,
    ride: ride("16.09 10:00:00", "16.09 10:40:00"),
    duration: 40,
    items: [plusLine(ABOUT.hourly, "50,00 грн"), minusLine(ABOUT.reduced, "25,00 грн"), plusLine(ABOUT.due, "25,00 грн")],
  },
  {
    id: "TC-75",
    note: "чек TC-78: 01:10–01:40, нічна знижка",
    ride: ride("16.09 01:10:00", "16.09 01:40:00"),
    items: [plusLine(ABOUT.hourly, "25,00 грн"), minusLine(ABOUT.night, "7,50 грн"), plusLine(ABOUT.due, "17,50 грн")],
  },
  {
    id: "TC-76",
    note: "чек TC-63: 25 год, суми ≥ 1000 грн",
    ride: ride("16.09 10:00:00", "17.09 11:00:00"),
    items: [
      plusLine(ABOUT.hourly, "1 250,00 грн"),
      plusLine(ABOUT.unreturned, "2 000,00 грн"),
      minusLine(ABOUT.dayCap), // суму не перевіряємо — залежить від Q-1
      plusLine(ABOUT.due, "2 300,00 грн"),
    ],
  },
  {
    id: "TC-77",
    note: "чек TC-48: 361 хв, рядок ліміту",
    ride: ride("16.09 10:00:00", "16.09 16:00:01"),
    duration: 361, // «Чек містить тривалість поїздки» (docs/spec/tariffs.md:133)
    items: [plusLine(ABOUT.hourly, "325,00 грн"), minusLine(ABOUT.dayCap, "25,00 грн"), plusLine(ABOUT.due, "300,00 грн")],
  },
  {
    id: "TC-94",
    note: "чек TC-67: 25 год, X01 — два окремі рядки зборів",
    ride: ride("16.09 10:00:00", "17.09 11:00:00", { station: "X01" }),
    items: [
      plusLine(ABOUT.unreturned, "2 000,00 грн"),
      plusLine(ABOUT.outOfZone, "150,00 грн"),
      plusLine(ABOUT.due, "2 450,00 грн"),
    ],
  },
  {
    id: "TC-95",
    note: "чек TC-49: ел., абон., за добу 22500 (П2), 75 хв",
    before: ["P2"],
    rider: SUBSCRIBER,
    ride: ride("16.09 13:00:00", "16.09 14:15:00", ebike),
    items: [
      plusLine(ABOUT.hourly, "120,00 грн"),
      minusLine(ABOUT.subscription, "24,00 грн"),
      minusLine(ABOUT.dayCap, "21,00 грн"),
      plusLine(ABOUT.due, "75,00 грн"),
    ],
  },
  {
    id: "TC-96",
    note: "чек: ел., 720 хв, 960,00 грн",
    ride: ride("16.09 10:00:00", "16.09 22:00:00", ebike),
    items: [plusLine(ABOUT.hourly, "960,00 грн"), minusLine(ABOUT.dayCap, "660,00 грн"), plusLine(ABOUT.due, "300,00 грн")],
  },
  {
    id: "TC-97",
    note: "чек: ел., 721 хв, 1 000,00 грн — тисячі через пробіл",
    ride: ride("16.09 10:00:00", "16.09 22:00:01", ebike),
    duration: 721, // «Чек містить тривалість поїздки» (docs/spec/tariffs.md:133)
    items: [plusLine(ABOUT.hourly, "1 000,00 грн"), minusLine(ABOUT.dayCap, "700,00 грн"), plusLine(ABOUT.due, "300,00 грн")],
  },
  {
    id: "TC-98",
    note: "чек TC-24: клас., абон., 100 хв",
    rider: SUBSCRIBER,
    ride: ride("16.09 10:00:00", "16.09 11:40:00"),
    items: [plusLine(ABOUT.hourly, "100,00 грн"), minusLine(ABOUT.subscription, "50,00 грн"), plusLine(ABOUT.due, "50,00 грн")],
  },
];

for (const row of RECEIPTS) {
  test(`T9: ${row.id} — ${row.note}`, () => {
    assertReceipt(formatReceipt(quoteRow(row)), row);
  });
}
