// Автоматизація тест-кейсів TC-10…TC-14 з docs/test-cases.md (правило T3).
// Оракул очікувань — docs/test-cases.md і docs/spec/tariffs.md.

import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";

const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;
const plus = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
const standard = { type: "standard" };

const cases = [
  { tc: "TC-10", name: "класичний, 50 хв → 2 блоки", bike: "classic", minutes: 50, timeCharge: 5000, total: 5000 },
  { tc: "TC-11", name: "електровелосипед, 75 хв → 3 блоки", bike: "ebike", minutes: 75, timeCharge: 12000, total: 12000 },
  { tc: "TC-12", name: "електровелосипед, рівно 30 хв → 1 блок", bike: "ebike", minutes: 30, timeCharge: 4000, total: 4000 },
  { tc: "TC-13", name: "класичний, рівно 60 хв → 2 блоки", bike: "classic", minutes: 60, timeCharge: 5000, total: 5000 },
  { tc: "TC-14", name: "класичний, 61 хв → 3 блоки (розпочатий третій)", bike: "classic", minutes: 61, timeCharge: 7500, total: 7500 },
];

for (const c of cases) {
  test(`T3 (${c.tc}): ${c.name}`, () => {
    const pickupAt = at("10:00:00");
    const result = quote(
      { pickupAt, returnAt: plus(pickupAt, c.minutes), bike: c.bike, returnStation: "S01" },
      standard,
    );
    assert.equal(result.minutes, c.minutes, "тривалість у хвилинах");
    assert.equal(result.timeCharge, c.timeCharge, "нарахування за T3");
    assert.equal(result.total, c.total, "до сплати");
  });
}
