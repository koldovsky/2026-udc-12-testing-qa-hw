// Автоматизація тест-кейсів TC-01…TC-09 з docs/test-cases.md.
// Оракул очікувань — docs/test-cases.md і docs/spec/tariffs.md (T1, T2, §4).
// З app/src/ узято лише спосіб виклику quote() і форму результату.

import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";

// Умовності docs/test-cases.md: київський час (вересень 2026 → +03:00), дата 2026-09-16,
// станція повернення S01, класичний велосипед, стандартний користувач.
const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;
const standard = { type: "standard" };
const ride = (pickupAt, returnAt, extra = {}) => ({
  pickupAt,
  returnAt,
  bike: "classic",
  returnStation: "S01",
  ...extra,
});

// Кожен рядок — окремий кейс docs/test-cases.md; граничні значення — окремими рядками.
const cases = [
  {
    tc: "TC-01",
    rule: "T1",
    name: "взяття 10:00:00, повернення 10:12:40 → 13 хв, 1 блок",
    pickupAt: at("10:00:00"),
    returnAt: at("10:12:40"),
    minutes: 13,
    timeCharge: 2500,
    total: 2500,
    fees: [],
  },
  {
    tc: "TC-02",
    rule: "T1",
    name: "взяття 14:05:00, повернення 14:41:00 → 36 хв, 2 блоки",
    pickupAt: at("14:05:00"),
    returnAt: at("14:41:00"),
    minutes: 36,
    timeCharge: 5000,
    total: 5000,
    fees: [],
  },
  {
    tc: "TC-03",
    rule: "T1 + T3",
    name: "рівно 30 хв → 1 блок",
    pickupAt: at("10:00:00"),
    returnAt: at("10:30:00"),
    minutes: 30,
    timeCharge: 2500,
    total: 2500,
    fees: [],
  },
  {
    tc: "TC-04",
    rule: "T1 + T3",
    name: "30 хв 1 с → 31 хв (неповна хвилина як повна), 2 блоки",
    pickupAt: at("10:00:00"),
    returnAt: at("10:30:01"),
    minutes: 31,
    timeCharge: 5000,
    total: 5000,
    fees: [],
  },
  {
    tc: "TC-05",
    rule: "T1 + §4",
    name: "моменти взяття й повернення рівні → запит не відхиляється, 0 хв, погодинне 0",
    pickupAt: at("10:00:00"),
    returnAt: at("10:00:00"),
    minutes: 0,
    timeCharge: 0,
    total: 0,
    fees: [],
  },
  {
    tc: "TC-06",
    rule: "T2",
    name: "рівно 2 хв → хибний старт, погодинне 0",
    pickupAt: at("10:00:00"),
    returnAt: at("10:02:00"),
    minutes: 2,
    timeCharge: 0,
    total: 0,
    fees: [],
  },
  {
    tc: "TC-07",
    rule: "T2",
    name: "2 хв 1 с → 3 хв (понад 2) → нараховується за T3: 1 блок",
    pickupAt: at("10:00:00"),
    returnAt: at("10:02:01"),
    minutes: 3,
    timeCharge: 2500,
    total: 2500,
    fees: [],
  },
  {
    tc: "TC-08",
    rule: "T2",
    name: "50 с → 1 хв, погодинне 0",
    pickupAt: at("10:00:00"),
    returnAt: at("10:00:50"),
    minutes: 1,
    timeCharge: 0,
    total: 0,
    fees: [],
  },
  {
    tc: "TC-09",
    rule: "T2 + T7",
    name: "хибний старт + повернення поза зоною (X01) → погодинне 0, збір 15000 на загальних підставах",
    pickupAt: at("10:00:00"),
    returnAt: at("10:00:50"),
    returnStation: "X01",
    minutes: 1,
    timeCharge: 0,
    total: 15000,
    fees: [15000],
  },
];

for (const c of cases) {
  test(`${c.rule} (${c.tc}): ${c.name}`, () => {
    const result = quote(
      ride(c.pickupAt, c.returnAt, c.returnStation ? { returnStation: c.returnStation } : {}),
      standard,
    );
    assert.equal(result.minutes, c.minutes, "тривалість у хвилинах");
    assert.equal(result.timeCharge, c.timeCharge, "нарахування за T3 до знижок");
    assert.deepEqual(
      result.fees.map((fee) => fee.amount).sort((a, b) => a - b),
      c.fees,
      "збори",
    );
    assert.equal(result.total, c.total, "до сплати");
  });
}
