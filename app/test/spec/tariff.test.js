// Automated test cases from docs/test-cases.md.
// Expected values are taken only from docs/test-cases.md and docs/spec/tariffs.md.
// app/src/ is used only for the call convention and the return shape of `quote`.
// Money is in integer kopecks. Each test name carries the rule id (T1..T10).
// Cases from the section «Питання до специфікації» (Q-1..Q-4) are not automated.

import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { discount, quote } from "../../src/tariff.js";

const MIN = 60_000;
const KYIV = "+03:00";

const standard = { type: "standard" };
const subscriber = { type: "subscriber" };
const reduced = { type: "reduced" };
const subscriberConcession = { type: "subscriber", concession: true };

const ride = (pickupAt, returnAt, bike = "classic", returnStation = "S01") => ({
  pickupAt,
  returnAt,
  bike,
  returnStation,
});

/** A fresh daily-cap ledger, optionally pre-charged for rider-t6 on 2026-09-16. */
const dayCapWith = (preCharged = 0) => {
  const cap = createDayCap();
  if (preCharged) {
    cap.record("rider-t6", "2026-09-16T09:00:00+03:00", preCharged);
  }
  return {
    rider: { id: "rider-t6", type: "standard" },
    dayCap: cap,
  };
};

const expectLines = (actual, expected, label) => {
  // The length check rejects an extra entry whose amount is already covered by
  // one of the expected entries; `some(...)` alone would let it pass.
  assert.equal(actual.length, expected.length, `${label} count`);
  for (const e of expected) {
    assert.ok(
      actual.some((x) => x.code === e.code && x.amount === e.amount),
      `missing ${label} ${e.code} ${e.amount}`,
    );
  }
};

const expectQuote = (result, expected) => {
  assert.equal(result.minutes, expected.minutes, "minutes");
  assert.equal(result.timeCharge, expected.timeCharge, "timeCharge");
  assert.equal(result.total, expected.total, "total");
  // An omitted list means "none expected" — every scenario asserts the absence
  // of unexpected discounts and fees, not only the presence of the listed ones.
  expectLines(result.discounts, expected.discounts ?? [], "discount");
  expectLines(result.fees, expected.fees ?? [], "fee");
};

// ---------------------------------------------------------------------------
// T1 / T2 — тривалість поїздки і хибний старт
// ---------------------------------------------------------------------------
// TC-02 and TC-04 are an intentional duplicate: T1's rounding and T2's paid
// start both need the same 121 s (3 min) input at the boundary. The recorded
// run `ai-runs/b2-run.txt` (and BUG-1) cites TC-04 at 121 s, so changing its
// input would invalidate that evidence.
const t1t2 = [
  {
    id: "TC-01",
    rule: "T1",
    name: "50 с округляється вгору до 1 хв; 1 ≤ 2 хв → 0 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:00:50+03:00"),
    rider: standard,
    expected: { minutes: 1, timeCharge: 0, total: 0 },
  },
  {
    id: "TC-02",
    rule: "T1",
    name: "121 с → 3 хв; > 2 хв → ceil(3/30)=1 блок, класичний 25 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:02:01+03:00"),
    rider: standard,
    expected: { minutes: 3, timeCharge: 2500, total: 2500 },
  },
  {
    id: "TC-03",
    rule: "T2",
    name: "120 с = 2 хв; ≤ 2 хв → погодинне нарахування 0 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:02:00+03:00"),
    rider: standard,
    expected: { minutes: 2, timeCharge: 0, total: 0 },
  },
  {
    id: "TC-04",
    rule: "T2",
    name: "121 с → 3 хв; > 2 хв → ceil(3/30)=1 блок, класичний 25 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:02:01+03:00"),
    rider: standard,
    expected: { minutes: 3, timeCharge: 2500, total: 2500 },
  },
];
for (const c of t1t2) {
  test(`${c.rule}: ${c.name} (${c.id})`, () => {
    expectQuote(quote(c.ride, c.rider), c.expected);
  });
}

// ---------------------------------------------------------------------------
// T3 — погодинне нарахування
// ---------------------------------------------------------------------------
const t3 = [
  {
    id: "TC-05",
    rule: "T3",
    name: "класичний 50 хв → ceil(50/30)=2 блоки, 50 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:50:00+03:00"),
    rider: standard,
    expected: { minutes: 50, timeCharge: 5000, total: 5000 },
  },
  {
    id: "TC-06",
    rule: "T3",
    name: "електровелосипед 75 хв → ceil(75/30)=3 блоки, 120 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:15:00+03:00", "ebike"),
    rider: standard,
    expected: { minutes: 75, timeCharge: 12000, total: 12000 },
  },
  {
    id: "TC-07",
    rule: "T3",
    name: "класичний 30 хв (рівно 1 блок) → 25 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:30:00+03:00"),
    rider: standard,
    expected: { minutes: 30, timeCharge: 2500, total: 2500 },
  },
  {
    id: "TC-08",
    rule: "T3",
    name: "класичний 31 хв (2 блоки) → 50 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:31:00+03:00"),
    rider: standard,
    expected: { minutes: 31, timeCharge: 5000, total: 5000 },
  },
];
for (const c of t3) {
  test(`${c.rule}: ${c.name} (${c.id})`, () => {
    expectQuote(quote(c.ride, c.rider), c.expected);
  });
}

// ---------------------------------------------------------------------------
// T4 — абонемент
// ---------------------------------------------------------------------------
const t4 = [
  {
    id: "TC-09",
    rule: "T4",
    name: "абонент, класичний 40 хв → перші 45 безкоштовно → 0 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:40:00+03:00"),
    rider: subscriber,
    expected: {
      minutes: 40,
      timeCharge: 5000,
      total: 0,
      discounts: [{ code: "subscription", amount: 5000 }],
    },
  },
  {
    id: "TC-10",
    rule: "T4",
    name: "абонент, класичний 45 хв (межа безкоштовних) → 0 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:45:00+03:00"),
    rider: subscriber,
    expected: {
      minutes: 45,
      timeCharge: 5000,
      total: 0,
      discounts: [{ code: "subscription", amount: 5000 }],
    },
  },
  {
    id: "TC-11",
    rule: "T4",
    name: "абонент, класичний 46 хв → платних 1 хв → 1 блок, 25 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:46:00+03:00"),
    rider: subscriber,
    expected: {
      minutes: 46,
      timeCharge: 5000,
      total: 2500,
      discounts: [{ code: "subscription", amount: 2500 }],
    },
  },
  {
    id: "TC-12",
    rule: "T4",
    name: "абонент, класичний 100 хв → платних 55 хв → 2 блоки, 50 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:40:00+03:00"),
    rider: subscriber,
    expected: {
      minutes: 100,
      timeCharge: 10000,
      total: 5000,
      discounts: [{ code: "subscription", amount: 5000 }],
    },
  },
  {
    id: "TC-13",
    rule: "T4",
    name: "абонент, електровелосипед 75 хв → 3 блоки 120 грн, −20% → 96 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:15:00+03:00", "ebike"),
    rider: subscriber,
    expected: {
      minutes: 75,
      timeCharge: 12000,
      total: 9600,
      discounts: [{ code: "subscription", amount: 2400 }],
    },
  },
];
for (const c of t4) {
  test(`${c.rule}: ${c.name} (${c.id})`, () => {
    expectQuote(quote(c.ride, c.rider), c.expected);
  });
}

// ---------------------------------------------------------------------------
// T5 — пільговий тариф
// ---------------------------------------------------------------------------
const t5 = [
  {
    id: "TC-14",
    rule: "T5",
    name: "пільговий (не абонент), класичний 40 хв → 2 блоки 50 грн − 50% → 25 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:40:00+03:00"),
    rider: reduced,
    expected: {
      minutes: 40,
      timeCharge: 5000,
      total: 2500,
      discounts: [{ code: "reduced", amount: 2500 }],
    },
  },
  {
    id: "TC-15",
    rule: "T5",
    name: "абонент із пільгою, класичний 80 хв → менше з пільги: 37,50 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:20:00+03:00"),
    rider: subscriberConcession,
    expected: {
      minutes: 80,
      timeCharge: 7500,
      total: 3750,
      discounts: [{ code: "reduced", amount: 3750 }],
    },
  },
  {
    id: "TC-16",
    rule: "T5",
    name: "абонент із пільгою, класичний 100 хв → рівні суми → абонемент: 50 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:40:00+03:00"),
    rider: subscriberConcession,
    expected: {
      minutes: 100,
      timeCharge: 10000,
      total: 5000,
      discounts: [{ code: "subscription", amount: 5000 }],
    },
  },
];
for (const c of t5) {
  test(`${c.rule}: ${c.name} (${c.id})`, () => {
    expectQuote(quote(c.ride, c.rider), c.expected);
  });
}

// ---------------------------------------------------------------------------
// T6 — денний ліміт (кожен кейс має власний ledger)
// ---------------------------------------------------------------------------
const t6 = [
  {
    id: "TC-17",
    rule: "T6",
    name: "електровелосипед 80 хв, перша поїздка за 16.09 → 120 ≤ 300 → 120 грн",
    ride: ride("2026-09-16T09:00:00+03:00", "2026-09-16T10:20:00+03:00", "ebike"),
    ctx: dayCapWith(0),
    expected: { minutes: 80, timeCharge: 12000, total: 12000 },
  },
  {
    id: "TC-18",
    rule: "T6",
    name: "електровелосипед 80 хв, вже нараховано 120 грн → 120+120=240 ≤ 300 → 120 грн",
    ride: ride("2026-09-16T09:00:00+03:00", "2026-09-16T10:20:00+03:00", "ebike"),
    ctx: dayCapWith(12000),
    expected: { minutes: 80, timeCharge: 12000, total: 12000 },
  },
  {
    id: "TC-19",
    rule: "T6",
    name: "електровелосипед 80 хв, вже нараховано 240 грн → залишок 60 грн → 60 грн",
    ride: ride("2026-09-16T09:00:00+03:00", "2026-09-16T10:20:00+03:00", "ebike"),
    ctx: dayCapWith(24000),
    expected: {
      minutes: 80,
      timeCharge: 12000,
      total: 6000,
      discounts: [{ code: "day-cap", amount: 6000 }],
    },
  },
  {
    id: "TC-20",
    rule: "T6",
    name: "взяття 16.09 23:40, повернення 17.09 00:20, класичний 40 хв → добу 16.09, 50 грн",
    ride: ride("2026-09-16T23:40:00+03:00", "2026-09-17T00:20:00+03:00"),
    ctx: dayCapWith(0),
    expected: { minutes: 40, timeCharge: 5000, total: 5000 },
  },
];
for (const c of t6) {
  test(`${c.rule}: ${c.name} (${c.id})`, () => {
    expectQuote(quote(c.ride, c.ctx.rider, { dayCap: c.ctx.dayCap }), c.expected);
  });
}

// ---------------------------------------------------------------------------
// T7 / T8 / T7+T8 — збори (поза зоною, неповернений велосипед)
// ---------------------------------------------------------------------------
const t7t8 = [
  {
    id: "TC-21",
    rule: "T7",
    name: "класичний 20 хв, повернення поза зоною X01 → 25 грн + збір 150 грн = 175 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:20:00+03:00", "classic", "X01"),
    rider: standard,
    expected: {
      minutes: 20,
      timeCharge: 2500,
      total: 17500,
      fees: [{ code: "out-of-zone", amount: 15000 }],
    },
  },
  {
    id: "TC-22",
    rule: "T8",
    name: "класичний 25 год = 1500 хв → 50 блоків 1250 грн → ліміт 300, + збір 2000 грн = 2300 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T11:00:00+03:00"),
    rider: { id: "rider-t8", type: "standard" },
    ctx: dayCapWith(0),
    expected: {
      minutes: 1500,
      timeCharge: 125000,
      total: 230000,
      discounts: [{ code: "day-cap", amount: 95000 }],
      fees: [{ code: "unreturned", amount: 200000 }],
    },
  },
  {
    id: "TC-23",
    rule: "T7+T8",
    name: "класичний 25 год, повернення поза зоною → 300 + 150 + 2000 = 2450 грн",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T11:00:00+03:00", "classic", "X01"),
    rider: { id: "rider-t8", type: "standard" },
    ctx: dayCapWith(0),
    expected: {
      minutes: 1500,
      timeCharge: 125000,
      total: 245000,
      discounts: [{ code: "day-cap", amount: 95000 }],
      fees: [
        { code: "out-of-zone", amount: 15000 },
        { code: "unreturned", amount: 200000 },
      ],
    },
  },
];
for (const c of t7t8) {
  test(`${c.rule}: ${c.name} (${c.id})`, () => {
    const options = c.ctx ? { dayCap: c.ctx.dayCap } : {};
    expectQuote(quote(c.ride, c.rider, options), c.expected);
  });
}

// ---------------------------------------------------------------------------
// T9 — суми та округлення
// ---------------------------------------------------------------------------
// T9 rounding is not observable through quote(): every amount quote() passes to
// discount() is a sum/difference of 2500/4000-kopeck blocks (and a day-cap
// allowance, itself a multiple of 250), so 20/30/50 % never yield a fraction of
// a kopeck. This direct test is therefore the only place the floor rounding
// itself can be checked.
test("T9: 30 % знижка від 1235 kop округляється вниз → до сплати 864 kop (TC-24)", () => {
  assert.equal(discount(1235, 30), 371);
  assert.equal(1235 - discount(1235, 30), 864);
});

// Integration check: quote() really applies discount() on its night path.
test("T9: quote() застосовує discount() для нічної знижки (T10)", () => {
  const result = quote(ride("2026-09-16T00:30:00+03:00", "2026-09-16T01:00:00+03:00"), standard);
  assert.equal(result.timeCharge, 2500);
  assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
  assert.equal(result.total, 1750);
});

// ---------------------------------------------------------------------------
// T10 — нічна знижка
// ---------------------------------------------------------------------------
const t10 = [
  {
    id: "TC-25",
    rule: "T10",
    name: "взяття 00:00, класичний 30 хв → нічна знижка −30% → 17,50 грн",
    ride: ride("2026-09-16T00:00:00+03:00", "2026-09-16T00:30:00+03:00"),
    rider: standard,
    expected: {
      minutes: 30,
      timeCharge: 2500,
      total: 1750,
      discounts: [{ code: "night", amount: 750 }],
    },
  },
  {
    id: "TC-26",
    rule: "T10",
    name: "взяття 06:00, класичний 30 хв → 06:00 не в нічному вікні → 25 грн",
    ride: ride("2026-09-16T06:00:00+03:00", "2026-09-16T06:30:00+03:00"),
    rider: standard,
    expected: { minutes: 30, timeCharge: 2500, total: 2500 },
  },
  {
    id: "TC-27",
    rule: "T10",
    name: "взяття 01:10, класичний 30 хв → нічна знижка −30% → 17,50 грн",
    ride: ride("2026-09-16T01:10:00+03:00", "2026-09-16T01:40:00+03:00"),
    rider: standard,
    expected: {
      minutes: 30,
      timeCharge: 2500,
      total: 1750,
      discounts: [{ code: "night", amount: 750 }],
    },
  },
];
for (const c of t10) {
  test(`${c.rule}: ${c.name} (${c.id})`, () => {
    expectQuote(quote(c.ride, c.rider), c.expected);
  });
}
