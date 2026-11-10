// T7 — повернення поза зоною. Кейси TC-53…TC-56 з docs/test-cases.md.
import test from "node:test";
import { AB, KL, ST, assertQuote, label, quoteRow } from "./support.js";

const ROWS = [
  { id: "TC-53", rule: "T7", rider: ST, bike: KL, from: "10:00:00", to: "10:20:00", station: "X01", total: 17500 },
  // Кожна точка поза зоною (додаток А).
  ...["X02", "X03"].map((station) => ({
    id: "TC-54",
    rule: "T7",
    rider: ST,
    bike: KL,
    from: "10:00:00",
    to: "10:20:00",
    station,
    total: 17500,
  })),
  // Кожна станція в зоні (додаток А): збору немає.
  ...["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((station) => ({
    id: "TC-55",
    rule: "T7",
    rider: ST,
    bike: KL,
    from: "10:00:00",
    to: "10:20:00",
    station,
    total: 2500,
  })),
  { id: "TC-56", rule: "T7, T4", rider: AB, bike: KL, from: "10:00:00", to: "10:30:00", station: "X02", total: 15000 },
];

for (const row of ROWS) {
  // label() omits the default S01, so name the station explicitly for TC-55.
  const station = row.station === "S01" ? " · S01" : "";
  test(`${row.rule}: ${row.id} ${label(row)}${station} → ${row.total} коп.`, () => {
    assertQuote(quoteRow(row), row);
  });
}
