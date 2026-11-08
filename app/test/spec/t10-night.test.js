// Автоматизація тест-кейсів TC-44…TC-49 і TC-58 з docs/test-cases.md (правило T10).
// Оракул очікувань — docs/test-cases.md і docs/spec/tariffs.md.
// Кейси навмисно взяті так, що поїздка цілком усередині або цілком поза інтервалом
// 00:00–06:00: межу інтервалу не чіпаємо, бо це питання Q-1 до специфікації.

import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";

const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;

const cases = [
  {
    tc: "TC-44",
    rule: "T10",
    name: "стандартний, класичний, 01:10 → 01:40 → 1 блок 2500 − 30 %",
    rider: { type: "standard" },
    pickup: "01:10:00",
    ret: "01:40:00",
    minutes: 30,
    timeCharge: 2500,
    total: 1750,
  },
  {
    tc: "TC-45",
    rule: "T10",
    name: "нижня межа інтервалу входить: 00:00 → 00:30 → 1750",
    rider: { type: "standard" },
    pickup: "00:00:00",
    ret: "00:30:00",
    minutes: 30,
    timeCharge: 2500,
    total: 1750,
  },
  {
    tc: "TC-46",
    rule: "T10",
    name: "поїздка цілком у межах 00:00–06:00: 05:30 → 05:59 → 1750",
    rider: { type: "standard" },
    pickup: "05:30:00",
    ret: "05:59:00",
    minutes: 29,
    timeCharge: 2500,
    total: 1750,
  },
  {
    tc: "TC-47",
    rule: "T10",
    name: "поїздка цілком поза інтервалом: 06:00 → 06:30 → нічної знижки немає",
    rider: { type: "standard" },
    pickup: "06:00:00",
    ret: "06:30:00",
    minutes: 30,
    timeCharge: 2500,
    total: 2500,
  },
  {
    tc: "TC-48",
    rule: "T10",
    name: "23:00 → 23:30 → нічної знижки немає",
    rider: { type: "standard" },
    pickup: "23:00:00",
    ret: "23:30:00",
    minutes: 30,
    timeCharge: 2500,
    total: 2500,
  },
  {
    tc: "TC-49",
    rule: "T10 + T5",
    name: "пільговий, 01:00 → 01:30 → діють обидві знижки: 2500 → пільга → нічна = 875",
    rider: { type: "reduced" },
    pickup: "01:00:00",
    ret: "01:30:00",
    minutes: 30,
    timeCharge: 2500,
    total: 875,
  },
  {
    tc: "TC-58",
    rule: "T10 (регресія v3)",
    name: "у версії 3 нічна знижка діє: 01:10 → 01:40 = 1750, а не 2500",
    rider: { type: "standard" },
    pickup: "01:10:00",
    ret: "01:40:00",
    minutes: 30,
    timeCharge: 2500,
    total: 1750,
  },
];

for (const c of cases) {
  test(`${c.rule} (${c.tc}): ${c.name}`, () => {
    const result = quote(
      { pickupAt: at(c.pickup), returnAt: at(c.ret), bike: "classic", returnStation: "S01" },
      c.rider,
    );
    assert.equal(result.minutes, c.minutes, "тривалість у хвилинах");
    assert.equal(result.timeCharge, c.timeCharge, "нарахування за T3 до знижок");
    assert.equal(result.total, c.total, "до сплати");
  });
}
