// T1 — тривалість поїздки. Кейси TC-01…TC-06 з docs/test-cases.md.
import test from "node:test";
import { KL, ST, assertQuote, label, quoteRow } from "./support.js";

const ROWS = [
  { id: "TC-01", rule: "T1", rider: ST, bike: KL, from: "10:00:00", to: "10:12:40", minutes: 13, total: 2500 },
  { id: "TC-02", rule: "T1", rider: ST, bike: KL, from: "14:05:00", to: "14:41:00", minutes: 36, total: 5000 },
  { id: "TC-03", rule: "T1", rider: ST, bike: KL, from: "10:00:00", to: "10:30:00", minutes: 30, total: 2500 },
  { id: "TC-04", rule: "T1", rider: ST, bike: KL, from: "10:00:00", to: "10:30:01", minutes: 31, total: 5000 },
  { id: "TC-05", rule: "T1", rider: ST, bike: KL, from: "10:00:00", to: "10:30:29", minutes: 31, total: 5000 },
  // Перехід на зимовий час: фактично 140 хв, не 80 «за годинником»; уся поїздка в 00:00–06:00.
  {
    id: "TC-06",
    rule: "T1, T10",
    rider: ST,
    bike: KL,
    from: "2026-10-25T02:50:00+03:00",
    to: "2026-10-25T04:10:00+02:00",
    minutes: 140,
    total: 8750,
  },
];

for (const row of ROWS) {
  test(`${row.rule}: ${row.id} ${label(row)} → ${row.minutes} хв, ${row.total} коп.`, () => {
    assertQuote(quoteRow(row), row);
  });
}
