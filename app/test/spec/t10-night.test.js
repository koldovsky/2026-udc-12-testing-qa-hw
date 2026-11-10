// T10 — нічна знижка (поїздки повністю всередині або повністю поза 00:00–06:00).
// Кейси TC-69…TC-76 з docs/test-cases.md. Поїздки через межу вікна — Q-1, не автоматизуються.
import test from "node:test";
import { AB, EL, KL, ST, assertQuote, label, quoteRow } from "./support.js";

const ROWS = [
  { id: "TC-69", rule: "T10", rider: ST, bike: KL, from: "01:10:00", to: "01:40:00", total: 1750 },
  { id: "TC-70", rule: "T10", rider: ST, bike: KL, from: "00:00:00", to: "00:30:00", total: 1750 },
  { id: "TC-71", rule: "T10", rider: ST, bike: KL, from: "06:00:00", to: "06:30:00", total: 2500 },
  { id: "TC-72", rule: "T10", rider: ST, bike: KL, from: "23:00:00", to: "23:30:00", total: 2500 },
  { id: "TC-73", rule: "T10", rider: ST, bike: EL, from: "02:00:00", to: "03:00:00", total: 5600 },
  { id: "TC-74", rule: "T10, T7", rider: ST, bike: KL, from: "01:10:00", to: "01:40:00", station: "X01", total: 16750 },
  { id: "TC-75", rule: "T10, T2", rider: ST, bike: EL, from: "03:00:00", to: "03:01:00", total: 0 },
  { id: "TC-76", rule: "T10, T4", rider: AB, bike: KL, from: "03:00:00", to: "03:30:00", total: 0 },
];

for (const row of ROWS) {
  test(`${row.rule}: ${row.id} ${label(row)} → ${row.total} коп.`, () => {
    assertQuote(quoteRow(row), row);
  });
}
