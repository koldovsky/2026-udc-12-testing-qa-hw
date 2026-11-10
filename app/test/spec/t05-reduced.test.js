// T5 — пільговий тариф; пільга проти абонемента. Кейси TC-31…TC-40 з docs/test-cases.md.
import test from "node:test";
import { AB_P, EL, KL, PIL, assertQuote, label, quoteRow } from "./support.js";

const ROWS = [
  { id: "TC-31", rule: "T5", rider: PIL, bike: KL, from: "10:00:00", to: "10:40:00", total: 2500 },
  { id: "TC-32", rule: "T5", rider: PIL, bike: EL, from: "10:00:00", to: "11:15:00", total: 6000 },
  // Абонент із правом на пільгу: застосовується менша сума, за рівних — абонемент.
  { id: "TC-33", rule: "T5", rider: AB_P, bike: KL, from: "10:00:00", to: "11:20:00", plan: "reduced", total: 3750 },
  { id: "TC-34", rule: "T5", rider: AB_P, bike: KL, from: "10:00:00", to: "10:40:00", plan: "subscription", total: 0 },
  { id: "TC-35", rule: "T5", rider: AB_P, bike: KL, from: "10:00:00", to: "10:50:00", plan: "subscription", total: 2500 },
  { id: "TC-36", rule: "T5", rider: AB_P, bike: KL, from: "10:00:00", to: "11:40:00", plan: "subscription", total: 5000 },
  { id: "TC-37", rule: "T5", rider: AB_P, bike: EL, from: "10:00:00", to: "11:00:00", total: 4000 },
  // Пільга не поширюється на збори.
  { id: "TC-38", rule: "T5, T7", rider: PIL, bike: KL, from: "10:00:00", to: "10:20:00", station: "X01", total: 16250 },
  { id: "TC-39", rule: "T5, T8, T6", rider: PIL, bike: KL, from: "16.09 10:00:00", to: "17.09 11:00:00", total: 230000 },
  {
    id: "TC-40",
    rule: "T5, T7",
    rider: AB_P,
    bike: KL,
    from: "10:00:00",
    to: "10:30:00",
    station: "X01",
    plan: "subscription",
    total: 15000,
  },
];

for (const row of ROWS) {
  const applied = row.plan ? ` (${row.plan})` : "";
  test(`${row.rule}: ${row.id} ${label(row)} → ${row.total} коп.${applied}`, () => {
    assertQuote(quoteRow(row), row);
  });
}
