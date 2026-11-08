// Автоматизація тест-кейсів TC-15…TC-20 і TC-54 з docs/test-cases.md (правило T4).
// Оракул очікувань — docs/test-cases.md і docs/spec/tariffs.md.

import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";

const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;
const plus = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
const subscriber = { type: "subscriber" };

const cases = [
  { tc: "TC-15", name: "абонент, класичний, 40 хв → 0 (у межах перших 45 безкоштовних хвилин)", bike: "classic", minutes: 40, timeCharge: 5000, total: 0 },
  { tc: "TC-16", name: "абонент, класичний, рівно 45 хв → 0 (45-та хвилина ще безкоштовна)", bike: "classic", minutes: 45, timeCharge: 5000, total: 0 },
  { tc: "TC-17", name: "абонент, класичний, 46 хв → платних 1 хв, 1 блок", bike: "classic", minutes: 46, timeCharge: 5000, total: 2500 },
  { tc: "TC-18", name: "абонент, класичний, 100 хв → платних 55 хв, 2 блоки", bike: "classic", minutes: 100, timeCharge: 10000, total: 5000 },
  { tc: "TC-19", name: "абонент, електровелосипед, 30 хв → безкоштовних хвилин немає: 4000 − 20 %", bike: "ebike", minutes: 30, timeCharge: 4000, total: 3200 },
  { tc: "TC-20", name: "абонент, електровелосипед, 40 хв → 8000 − 20 % (45 безкоштовних хвилин на e-bike не діють)", bike: "ebike", minutes: 40, timeCharge: 8000, total: 6400 },
];

for (const c of cases) {
  test(`T4 (${c.tc}): ${c.name}`, () => {
    const pickupAt = at("10:00:00");
    const result = quote(
      { pickupAt, returnAt: plus(pickupAt, c.minutes), bike: c.bike, returnStation: "S01" },
      subscriber,
    );
    assert.equal(result.minutes, c.minutes, "тривалість у хвилинах");
    assert.equal(result.timeCharge, c.timeCharge, "нарахування за T3 до знижки абонемента");
    assert.equal(result.total, c.total, "до сплати");
  });
}

test("T4 (TC-54): 45 безкоштовних хвилин — кожної поїздки, а не доби: дві поїздки 40 хв → 0 і 0", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-54", type: "subscriber" };
  const totals = [];
  for (const time of ["10:00:00", "12:00:00"]) {
    const pickupAt = at(time);
    const result = quote(
      { pickupAt, returnAt: plus(pickupAt, 40), bike: "classic", returnStation: "S01" },
      rider,
      { dayCap },
    );
    totals.push(result.total);
  }
  assert.deepEqual(totals, [0, 0], "погодинне нарахування обох поїздок");
});
