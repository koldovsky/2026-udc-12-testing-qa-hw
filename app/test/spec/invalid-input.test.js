// Розділ 4 — некоректні дані: docs/test-cases.md, TC-86…TC-90.
// Очікування: розрахунку немає, запит відхилено з поясненням. Тексти пояснень специфікація
// не визначає — перевіряємо лише, що пояснення є.
import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError } from "../../src/tariff.js";
import { quoteRow, ride } from "./helpers.js";

// Решта як у TC-17: клас., станд., 16.09 10:00:00 → 10:50:00, S01.
const CASES = [
  { id: "TC-86", rule: "T1", note: "повернення на 1 с раніше за взяття", ride: ride("16.09 10:00:00", "16.09 09:59:59") },
  { id: "TC-87", rule: "T3", note: "тип велосипеда «тандем»", ride: ride("16.09 10:00:00", "16.09 10:50:00", { bike: "tandem" }) },
  { id: "TC-88", rule: "T5", note: "категорія «корпоративний»", rider: { type: "corporate" }, ride: ride("16.09 10:00:00", "16.09 10:50:00") },
  { id: "TC-89", rule: "T7", note: "станції S09 немає в додатку А", ride: ride("16.09 10:00:00", "16.09 10:50:00", { station: "S09" }) },
  { id: "TC-90", rule: "T7", note: "точки X04 немає в додатку А — відхилення, а не збір", ride: ride("16.09 10:00:00", "16.09 10:50:00", { station: "X04" }) },
];

for (const row of CASES) {
  test(`${row.rule} (розд. 4): ${row.id} — ${row.note}: запит відхилено з поясненням`, () => {
    assert.throws(
      () => quoteRow(row),
      (err) => err instanceof QuoteError && err.message.trim() !== "",
    );
  });
}
