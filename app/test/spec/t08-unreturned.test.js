// T8 — неповернений велосипед. Кейси TC-57…TC-63 з docs/test-cases.md.
import test from "node:test";
import assert from "node:assert/strict";
import { AB, KL, ST, assertQuote, label, quoteRow, quoteScenario, scenarioLabel } from "./support.js";

const ROWS = [
  { id: "TC-57", rule: "T8", rider: ST, bike: KL, from: "16.09 10:00:00", to: "17.09 11:00:00", total: 230000 },
  { id: "TC-58", rule: "T8", rider: ST, bike: KL, from: "16.09 10:00:00", to: "17.09 10:00:00", total: 30000 },
  { id: "TC-59", rule: "T8", rider: ST, bike: KL, from: "16.09 10:00:00", to: "17.09 10:00:01", minutes: 1441, total: 230000 },
  { id: "TC-60", rule: "T8", rider: ST, bike: KL, from: "16.09 10:00:00", to: "17.09 10:00:29", minutes: 1441, total: 230000 },
  {
    id: "TC-61",
    rule: "T8, T7",
    rider: ST,
    bike: KL,
    from: "16.09 10:00:00",
    to: "17.09 11:00:00",
    station: "X02",
    total: 245000,
  },
  { id: "TC-63", rule: "T8, T4", rider: AB, bike: KL, from: "16.09 10:00:00", to: "17.09 11:00:00", total: 230000 },
];

for (const row of ROWS) {
  test(`${row.rule}: ${row.id} ${label(row)} → ${row.total} коп.`, () => {
    assertQuote(quoteRow(row), row);
  });
}

const SCENARIOS = [
  {
    id: "TC-62",
    rule: "T8, T6",
    steps: [
      { rider: ST, bike: KL, from: "16.09 08:00", to: "16.09 14:01", total: 30000 },
      { rider: ST, bike: KL, from: "16.09 20:00", to: "17.09 21:00", total: 200000 },
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
