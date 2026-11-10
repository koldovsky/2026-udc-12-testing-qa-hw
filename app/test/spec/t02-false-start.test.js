// T2 — хибний старт. Кейси TC-07…TC-15 з docs/test-cases.md.
import test from "node:test";
import { AB, EL, KL, PIL, ST, assertQuote, label, quoteRow } from "./support.js";

const ROWS = [
  { id: "TC-07", rule: "T2", rider: ST, bike: KL, from: "10:00:00", to: "10:00:50", minutes: 1, total: 0 },
  { id: "TC-08", rule: "T2", rider: ST, bike: KL, from: "10:00:00", to: "10:00:00", minutes: 0, total: 0 },
  { id: "TC-09", rule: "T2", rider: ST, bike: KL, from: "10:00:00", to: "10:02:00", minutes: 2, total: 0 },
  { id: "TC-10", rule: "T2", rider: ST, bike: KL, from: "10:00:00", to: "10:02:01", minutes: 3, total: 2500 },
  { id: "TC-11", rule: "T2", rider: ST, bike: EL, from: "10:00:00", to: "10:01:30", minutes: 2, total: 0 },
  { id: "TC-12", rule: "T2", rider: ST, bike: KL, from: "10:00:00", to: "10:04:00", minutes: 4, total: 2500 },
  { id: "TC-13", rule: "T2, T7", rider: ST, bike: KL, from: "10:00:00", to: "10:01:30", station: "X01", total: 15000 },
  { id: "TC-14", rule: "T2, T5, T7", rider: PIL, bike: EL, from: "10:00:00", to: "10:00:30", station: "X03", total: 15000 },
  { id: "TC-15", rule: "T2, T4", rider: AB, bike: EL, from: "10:00:00", to: "10:01:00", minutes: 1, total: 0 },
];

for (const row of ROWS) {
  test(`${row.rule}: ${row.id} ${label(row)} → ${row.total} коп.`, () => {
    assertQuote(quoteRow(row), row);
  });
}
