// Автоматизація тест-кейсів TC-27…TC-33, TC-55, TC-57 з docs/test-cases.md (правило T6).
// Оракул очікувань — docs/test-cases.md і docs/spec/tariffs.md.

import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";

const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;
const plus = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

const quoteRide = (spec, rider, dayCap) => {
  const pickupAt = at(spec.pickup, spec.date);
  return quote(
    {
      pickupAt,
      returnAt: spec.returnAt ?? plus(pickupAt, spec.minutes),
      bike: spec.bike ?? "classic",
      returnStation: spec.returnStation ?? "S01",
    },
    rider,
    { dayCap },
  );
};

// Послідовності поїздок одного користувача за одну добу: ліміт з'їдається поїздка за поїздкою.
const sequences = [
  {
    tc: "TC-27",
    name: "три поїздки e-bike по 80 хв (09:00, 13:00, 18:00) → 12000, 12000, 6000; разом рівно 30000",
    rides: [
      { pickup: "09:00:00", minutes: 80, bike: "ebike" },
      { pickup: "13:00:00", minutes: 80, bike: "ebike" },
      { pickup: "18:00:00", minutes: 80, bike: "ebike" },
    ],
    totals: [12000, 12000, 6000],
    sum: 30000,
  },
  {
    tc: "TC-55",
    name: "ліміт спільний для різних типів велосипедів: e-bike 180 хв, класичний 60 хв, класичний 30 хв",
    rides: [
      { pickup: "09:00:00", minutes: 180, bike: "ebike" },
      { pickup: "14:00:00", minutes: 60, bike: "classic" },
      { pickup: "16:00:00", minutes: 30, bike: "classic" },
    ],
    totals: [24000, 5000, 1000],
    sum: 30000,
  },
  {
    tc: "TC-57",
    name: "регресія v3: ліміт 30000, а не 25000 — чотири поїздки e-bike по 60 хв",
    rides: [
      { pickup: "09:00:00", minutes: 60, bike: "ebike" },
      { pickup: "12:00:00", minutes: 60, bike: "ebike" },
      { pickup: "15:00:00", minutes: 60, bike: "ebike" },
      { pickup: "18:00:00", minutes: 60, bike: "ebike" },
    ],
    totals: [8000, 8000, 8000, 6000],
    sum: 30000,
  },
];

for (const c of sequences) {
  test(`T6 (${c.tc}): ${c.name}`, () => {
    const dayCap = createDayCap();
    const rider = { id: `rider-${c.tc}`, type: "standard" };
    const totals = c.rides.map((spec) => quoteRide(spec, rider, dayCap).total);
    assert.deepEqual(totals, c.totals, "погодинне нарахування кожної поїздки");
    assert.equal(
      totals.reduce((sum, value) => sum + value, 0),
      c.sum,
      "сума погодинних нарахувань за добу",
    );
  });
}

// Поїздки на тлі вже нарахованої за добу 16.09 суми. Кожне граничне значення — окремим рядком.
const seeded = [
  {
    tc: "TC-28",
    rule: "T6",
    name: "за добу вже нараховано 29900; класичний, 40 хв, взяття 12:00 → до сплати залишок ліміту 100",
    charged: 29900,
    ride: { pickup: "12:00:00", minutes: 40 },
    minutes: 40,
    timeCharge: 5000,
    fees: [],
    total: 100,
  },
  {
    tc: "TC-29",
    rule: "T6",
    name: "за добу вже нараховано 30000; класичний, 40 хв, взяття 12:00 → погодинне 0 (ліміт вичерпано)",
    charged: 30000,
    ride: { pickup: "12:00:00", minutes: 40 },
    minutes: 40,
    timeCharge: 5000,
    fees: [],
    total: 0,
  },
  {
    tc: "TC-30",
    rule: "T6",
    name: "взяття 16.09 23:40, повернення 17.09 00:20 → поїздка належить добі 16.09 (за моментом взяття) → 0",
    charged: 30000,
    ride: { pickup: "23:40:00", returnAt: at("00:20:00", "2026-09-17") },
    minutes: 40,
    timeCharge: 5000,
    fees: [],
    total: 0,
  },
  {
    tc: "TC-31",
    rule: "T6 + T10",
    name: "взяття 17.09 00:20 → поїздка належить добі 17.09, ліміт 16.09 не діє; 2500 − 30 % (нічна)",
    charged: 30000,
    ride: { pickup: "00:20:00", date: "2026-09-17", minutes: 30 },
    minutes: 30,
    timeCharge: 2500,
    fees: [],
    total: 1750,
  },
  {
    tc: "TC-32",
    rule: "T6 + T7",
    name: "ліміт вичерпано; класичний, 20 хв, станція X02 → погодинне 0, збір 15000 у ліміт не входить",
    charged: 30000,
    ride: { pickup: "12:00:00", minutes: 20, returnStation: "X02" },
    minutes: 20,
    timeCharge: 2500,
    fees: [15000],
    total: 15000,
  },
];

for (const c of seeded) {
  test(`${c.rule} (${c.tc}): ${c.name}`, () => {
    const dayCap = createDayCap();
    const rider = { id: `rider-${c.tc}`, type: "standard" };
    // Стан «за 16.09 користувачеві вже нараховано N» (умовності docs/test-cases.md).
    dayCap.record(rider.id, Date.parse(at("12:00:00")), c.charged);

    const result = quoteRide(c.ride, rider, dayCap);
    assert.equal(result.minutes, c.minutes, "тривалість у хвилинах");
    assert.equal(result.timeCharge, c.timeCharge, "нарахування за T3 до ліміту");
    assert.deepEqual(
      result.fees.map((fee) => fee.amount).sort((a, b) => a - b),
      c.fees,
      "збори (у ліміт не входять і ним не обмежуються)",
    );
    assert.equal(result.total, c.total, "до сплати");
  });
}

test("T6 (TC-33): ліміт рахується для кожного користувача окремо → першому 0, другому 12000", () => {
  const dayCap = createDayCap();
  const first = { id: "rider-33-a", type: "standard" };
  const second = { id: "rider-33-b", type: "standard" };
  dayCap.record(first.id, Date.parse(at("12:00:00")), 30000);

  const spec = { pickup: "18:00:00", minutes: 80, bike: "ebike" };
  assert.equal(quoteRide(spec, first, dayCap).total, 0, "користувач, що вичерпав ліміт");
  assert.equal(quoteRide(spec, second, dayCap).total, 12000, "інший користувач");
});
