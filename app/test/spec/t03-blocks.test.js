// T3 — погодинне нарахування. Кейси TC-16…TC-21 з docs/test-cases.md.
import test from "node:test";
import { EL, KL, ST, assertQuote, label, quoteRow } from "./support.js";

const ROWS = [
  { id: "TC-16", rule: "T3", rider: ST, bike: KL, from: "10:00:00", to: "10:50:00", total: 5000 },
  { id: "TC-17", rule: "T3", rider: ST, bike: EL, from: "10:00:00", to: "11:15:00", total: 12000 },
  { id: "TC-18", rule: "T3", rider: ST, bike: EL, from: "10:00:00", to: "10:30:00", total: 4000 },
  { id: "TC-19", rule: "T3", rider: ST, bike: EL, from: "10:00:00", to: "10:31:00", total: 8000 },
  { id: "TC-20", rule: "T3", rider: ST, bike: KL, from: "10:00:00", to: "11:00:00", total: 5000 },
  { id: "TC-21", rule: "T3", rider: ST, bike: KL, from: "10:00:00", to: "11:01:00", total: 7500 },
];

for (const row of ROWS) {
  test(`${row.rule}: ${row.id} ${label(row)} → ${row.total} коп.`, () => {
    assertQuote(quoteRow(row), row);
  });
}
