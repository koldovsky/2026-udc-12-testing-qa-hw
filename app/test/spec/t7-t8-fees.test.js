// Автоматизація тест-кейсів TC-34…TC-39 і TC-56 з docs/test-cases.md (правила T7, T8).
// Оракул очікувань — docs/test-cases.md і docs/spec/tariffs.md.

import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";

const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;
const plus = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
const standard = { type: "standard" };

// Збори звіряються складом — код і сума кожного, а не лише суми: тест має падати від зміни
// поведінки, а не від зміни порядку, тож обидві сторони сортуємо за кодом (`app/AGENTS.md`,
// правило 5). Саме слабка перевірка зборів пропустила дефект CI-1152 (`docs/bugs/CI-1152.md`).
const byCode = (fees) => [...fees].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

const cases = [
  {
    tc: "TC-34",
    rule: "T7",
    name: "стандартний, класичний, 20 хв, станція X01 (поза зоною) → 2500 + збір 15000",
    minutes: 20,
    returnStation: "X01",
    timeCharge: 2500,
    fees: [{ code: "out-of-zone", amount: 15000 }],
    total: 17500,
  },
  {
    tc: "TC-35",
    rule: "T7",
    name: "стандартний, класичний, 20 хв, станція S03 (у зоні) → збору немає",
    minutes: 20,
    returnStation: "S03",
    timeCharge: 2500,
    fees: [],
    total: 2500,
  },
  {
    tc: "TC-56",
    rule: "T7 (регресія v3)",
    name: "збір поза зоною — 15000, а не 10000 як у версії 2",
    minutes: 20,
    returnStation: "X01",
    timeCharge: 2500,
    fees: [{ code: "out-of-zone", amount: 15000 }],
    total: 17500,
  },
  {
    tc: "TC-36",
    rule: "T8",
    name: "рівно 24 год 00 хв → 1440 хв, 48 блоків обмежено лімітом 30000; збору T8 немає",
    minutes: 24 * 60,
    returnStation: "S01",
    timeCharge: 120000,
    fees: [],
    total: 30000,
  },
  {
    tc: "TC-37",
    rule: "T8",
    name: "24 год 01 хв → 1441 хв, 49 блоків обмежено лімітом 30000; збір 200000",
    minutes: 24 * 60 + 1,
    returnStation: "S01",
    timeCharge: 122500,
    fees: [{ code: "unreturned", amount: 200000 }],
    total: 230000,
  },
  {
    tc: "TC-38",
    rule: "T8 + T6",
    name: "25 год → 50 блоків обмежено лімітом 30000; збір 200000",
    minutes: 25 * 60,
    returnStation: "S01",
    timeCharge: 125000,
    fees: [{ code: "unreturned", amount: 200000 }],
    total: 230000,
  },
  {
    tc: "TC-39",
    rule: "T7 + T8",
    name: "25 год, станція X03 (поза зоною) → обидва збори незалежно: 30000 + 15000 + 200000",
    minutes: 25 * 60,
    returnStation: "X03",
    timeCharge: 125000,
    fees: [
      { code: "out-of-zone", amount: 15000 },
      { code: "unreturned", amount: 200000 },
    ],
    total: 245000,
  },
];

for (const c of cases) {
  test(`${c.rule} (${c.tc}): ${c.name}`, () => {
    const pickupAt = at("10:00:00");
    const result = quote(
      { pickupAt, returnAt: plus(pickupAt, c.minutes), bike: "classic", returnStation: c.returnStation },
      standard,
    );
    assert.equal(result.minutes, c.minutes, "тривалість у хвилинах");
    assert.equal(result.timeCharge, c.timeCharge, "нарахування за T3 до ліміту");
    assert.deepEqual(byCode(result.fees), byCode(c.fees), "збори: код і сума кожного");
    assert.equal(result.total, c.total, "до сплати");
  });
}
