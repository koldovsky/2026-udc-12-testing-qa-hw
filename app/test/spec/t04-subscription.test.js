// T4 — абонемент. Кейси TC-22…TC-30 з docs/test-cases.md.
import test from "node:test";
import { AB, EL, KL, assertQuote, label, quoteRow } from "./support.js";

const ROWS = [
  { id: "TC-22", rule: "T4", rider: AB, bike: KL, from: "10:00:00", to: "10:40:00", total: 0 },
  { id: "TC-23", rule: "T4", rider: AB, bike: KL, from: "10:00:00", to: "11:40:00", total: 5000 },
  { id: "TC-24", rule: "T4", rider: AB, bike: KL, from: "10:00:00", to: "10:45:00", total: 0 },
  { id: "TC-25", rule: "T4", rider: AB, bike: KL, from: "10:00:00", to: "10:46:00", total: 2500 },
  { id: "TC-26", rule: "T4", rider: AB, bike: KL, from: "10:00:00", to: "11:15:00", total: 2500 },
  { id: "TC-27", rule: "T4", rider: AB, bike: KL, from: "10:00:00", to: "11:16:00", total: 5000 },
  // Електровелосипед: безкоштовних хвилин немає, −20 %.
  { id: "TC-28", rule: "T4", rider: AB, bike: EL, from: "10:00:00", to: "10:30:00", total: 3200 },
  { id: "TC-29", rule: "T4", rider: AB, bike: EL, from: "10:00:00", to: "10:40:00", total: 6400 },
  { id: "TC-30", rule: "T4", rider: AB, bike: EL, from: "10:00:00", to: "11:40:00", total: 12800 },
];

for (const row of ROWS) {
  test(`${row.rule}: ${row.id} ${label(row)} → ${row.total} коп.`, () => {
    assertQuote(quoteRow(row), row);
  });
}
