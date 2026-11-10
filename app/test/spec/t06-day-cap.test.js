// T6 — денний ліміт. Кейси TC-41…TC-52 з docs/test-cases.md.
// «Сценарій» — поїздки одного користувача з одним денним леджером, у порядку взяття.
import test from "node:test";
import assert from "node:assert/strict";
import { EL, KL, PIL, ST, assertQuote, label, quoteRow, quoteScenario, scenarioLabel } from "./support.js";

// Одна поїздка: межа ліміту.
const SINGLE = [
  { id: "TC-42", rule: "T6", rider: ST, bike: KL, from: "10:00:00", to: "16:00:00", capLine: null, total: 30000 },
  { id: "TC-43", rule: "T6", rider: ST, bike: KL, from: "10:00:00", to: "16:01:00", capLine: 2500, total: 30000 },
];

for (const row of SINGLE) {
  test(`${row.rule}: ${row.id} ${label(row)} → ${row.total} коп.`, () => {
    assertQuote(quoteRow(row), row);
  });
}

const SCENARIOS = [
  {
    id: "TC-41",
    rule: "T6",
    steps: [
      { rider: ST, bike: EL, from: "09:00", to: "10:20", total: 12000 },
      { rider: ST, bike: EL, from: "13:00", to: "14:20", total: 12000 },
      { rider: ST, bike: EL, from: "18:00", to: "19:20", total: 6000 },
    ],
  },
  {
    id: "TC-44",
    rule: "T6",
    steps: [
      { rider: ST, bike: KL, from: "08:00", to: "14:01", total: 30000 },
      { rider: ST, bike: KL, from: "17:00", to: "17:30", total: 0 },
    ],
  },
  {
    id: "TC-45",
    rule: "T6, T7",
    steps: [
      { rider: ST, bike: KL, from: "08:00", to: "14:01", total: 30000 },
      { rider: ST, bike: KL, from: "17:00", to: "17:30", station: "X01", total: 15000 },
    ],
  },
  {
    id: "TC-46",
    rule: "T6, T7",
    steps: [
      { rider: ST, bike: KL, from: "09:00", to: "09:20", station: "X01", total: 17500 },
      { rider: ST, bike: EL, from: "11:00", to: "17:00", total: 27500 },
    ],
  },
  {
    id: "TC-47",
    rule: "T6",
    steps: [
      { rider: ST, bike: EL, from: "16.09 08:00", to: "16.09 15:00", total: 30000 },
      { rider: ST, bike: KL, from: "16.09 23:40", to: "17.09 00:20", total: 0 },
      { rider: ST, bike: EL, from: "17.09 08:00", to: "17.09 08:30", total: 4000 },
    ],
  },
  {
    id: "TC-48",
    rule: "T6",
    steps: [
      { rider: ST, bike: EL, from: "16.09 08:00", to: "16.09 15:00", total: 30000 },
      { rider: ST, bike: KL, from: "2026-09-17T00:30:00+03:00", to: "2026-09-17T01:00:00+03:00", total: 1750 },
    ],
  },
  {
    id: "TC-49",
    rule: "T6",
    steps: [
      { rider: ST, bike: EL, from: "2026-09-17T00:00:00+03:00", to: "2026-09-17T05:00:00+03:00", total: 28000 },
      { rider: ST, bike: EL, from: "17.09 10:00", to: "17.09 10:30", total: 2000 },
    ],
  },
  {
    id: "TC-50",
    rule: "T6, T10",
    steps: [
      { rider: ST, bike: EL, from: "18.09 01:00", to: "18.09 03:00", total: 11200 },
      { rider: ST, bike: EL, from: "18.09 09:00", to: "18.09 11:00", total: 16000 },
      { rider: ST, bike: KL, from: "18.09 12:00", to: "18.09 12:30", total: 2500 },
      { rider: ST, bike: KL, from: "18.09 14:00", to: "18.09 14:30", total: 300 },
    ],
  },
  {
    id: "TC-51",
    rule: "T6, T5",
    steps: [
      { rider: PIL, bike: EL, from: "10:00", to: "17:00", total: 28000 },
      { rider: PIL, bike: EL, from: "18:00", to: "19:00", total: 2000 },
    ],
  },
  {
    id: "TC-52",
    rule: "T6",
    steps: [
      { riderId: "A", rider: ST, bike: KL, from: "08:00", to: "14:01", total: 30000 },
      { riderId: "B", rider: ST, bike: KL, from: "17:00", to: "17:30", total: 2500 },
    ],
  },
];

for (const { id, rule, steps } of SCENARIOS) {
  const expected = steps.map((step) => step.total);
  test(`${rule}: ${id} ${scenarioLabel(steps)} → ${expected.join(", ")} коп.`, () => {
    const totals = quoteScenario(steps).map((result) => result.total);
    assert.deepEqual(totals, expected);
  });
}
