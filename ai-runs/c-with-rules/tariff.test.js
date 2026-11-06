// Unit-тести для app/src/tariff.js.
//
// УВАГА: специфікація docs/spec/tariffs.md у цьому завданні недоступна (дозволено читати лише
// app/src/ і package.json). Тому кожне очікування тут — контракт коду, не правило специфікації:
// числа виведено вручну з констант і гілок tariff.js / day-cap.js і пояснено в коментарях.
// Випадки, де поведінка коду схожа на дефект або є відкритим питанням (округлення хвилин,
// межа й початок нічного вікна, накладання знижок, доба для денної межі тощо), навмисно
// НЕ закріплено тестами — їх перелічено у звіті як питання до специфікації.
//
// Усі моменти часу — з явним зсувом. Денні поїздки — 10:00 за Києвом (07:00Z), далеко від
// нічного вікна й від зміни доби.

import { test } from "node:test";
import assert from "node:assert/strict";

import { quote, discount, QuoteError } from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";

const STANDARD = Object.freeze({ type: "standard" });
const REDUCED = Object.freeze({ type: "reduced" });
const SUBSCRIBER = Object.freeze({ type: "subscriber" });
const CONCESSION_SUBSCRIBER = Object.freeze({ type: "subscriber", concession: true });

function ride(pickupAt, returnAt, { bike = "classic", returnStation = "S01" } = {}) {
  return { pickupAt, returnAt, bike, returnStation };
}

// ---------------------------------------------------------------------------------------------
// Погодинна оплата: безкоштовний старт і блоки по 30 хв (класичний 25 грн, електро 40 грн)
// ---------------------------------------------------------------------------------------------

test("контракт коду: повернення в момент взяття — 0 хв, 0 грн", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:00:00+03:00"), STANDARD);
  assert.deepEqual(r, { minutes: 0, timeCharge: 0, discounts: [], fees: [], total: 0 });
});

test("контракт коду: 1 хв — у безкоштовному старті (minutes < 2), 0 грн", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:01:00+03:00"), STANDARD);
  assert.deepEqual(r, { minutes: 1, timeCharge: 0, discounts: [], fees: [], total: 0 });
});

test("контракт коду: рівно 2 хв — уже платно, 1 блок × 25 грн = 2500 коп.", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:02:00+03:00"), STANDARD);
  assert.deepEqual(r, { minutes: 2, timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

test("контракт коду: 2 хв 1 с — платно, 1 блок × 25 грн = 2500 коп.", () => {
  // minutes не перевіряємо: округлення секунд — відкрите питання (див. звіт).
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:02:01+03:00"), STANDARD);
  assert.equal(r.timeCharge, 2500); // 1 блок × 25 грн
  assert.deepEqual(r.discounts, []);
  assert.deepEqual(r.fees, []);
  assert.equal(r.total, 2500);
});

const BLOCK_CASES = [
  { name: "класичний, рівно 30 хв — 1 блок", bike: "classic", ret: "10:30", minutes: 30, charge: 2500 }, // 1 × 25 грн
  { name: "класичний, 31 хв — 2 блоки", bike: "classic", ret: "10:31", minutes: 31, charge: 5000 }, // 2 × 25 грн
  { name: "електро, рівно 30 хв — 1 блок", bike: "ebike", ret: "10:30", minutes: 30, charge: 4000 }, // 1 × 40 грн
  { name: "електро, 31 хв — 2 блоки", bike: "ebike", ret: "10:31", minutes: 31, charge: 8000 }, // 2 × 40 грн
];
for (const c of BLOCK_CASES) {
  test(`контракт коду: ${c.name}`, () => {
    const r = quote(ride("2026-07-10T10:00:00+03:00", `2026-07-10T${c.ret}:00+03:00`, { bike: c.bike }), STANDARD);
    assert.deepEqual(r, { minutes: c.minutes, timeCharge: c.charge, discounts: [], fees: [], total: c.charge });
  });
}

// ---------------------------------------------------------------------------------------------
// Денна межа без журналу (dayCap не передано): 300 грн на поїздку
// ---------------------------------------------------------------------------------------------

test("контракт коду: рівно 300 грн (6 год = 12 блоків × 25 грн) — без знижки day-cap", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T16:00:00+03:00"), STANDARD);
  assert.deepEqual(r, { minutes: 360, timeCharge: 30000, discounts: [], fees: [], total: 30000 });
});

test("контракт коду: наступний блок після 300 грн (6 год 1 хв = 13 блоків) — day-cap 25 грн", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T16:01:00+03:00"), STANDARD);
  assert.deepEqual(r, {
    minutes: 361,
    timeCharge: 32500, // 13 блоків × 25 грн
    discounts: [{ code: "day-cap", amount: 2500 }], // 325 грн − 300 грн
    fees: [],
    total: 30000,
  });
});

// ---------------------------------------------------------------------------------------------
// Абонемент: перші 45 хв безкоштовно, далі блоки від 45-ї хвилини; електро −20 %
// ---------------------------------------------------------------------------------------------

test("контракт коду: абонемент, класичний, рівно 45 хв — безкоштовно", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:45:00+03:00"), SUBSCRIBER);
  assert.deepEqual(r, {
    minutes: 45,
    timeCharge: 5000, // 2 блоки × 25 грн
    discounts: [{ code: "subscription", amount: 5000 }], // уся вартість
    fees: [],
    total: 0,
  });
});

test("контракт коду: абонемент, класичний, 46 хв — 1 блок понад 45 хв", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:46:00+03:00"), SUBSCRIBER);
  assert.deepEqual(r, {
    minutes: 46,
    timeCharge: 5000, // 2 блоки × 25 грн
    discounts: [{ code: "subscription", amount: 2500 }], // 50 грн − (1 блок × 25 грн)
    fees: [],
    total: 2500,
  });
});

test("контракт коду: абонемент, електро, рівно 45 хв — безкоштовно", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:45:00+03:00", { bike: "ebike" }), SUBSCRIBER);
  assert.deepEqual(r, {
    minutes: 45,
    timeCharge: 8000, // 2 блоки × 40 грн
    discounts: [{ code: "subscription", amount: 8000 }],
    fees: [],
    total: 0,
  });
});

test("контракт коду: абонемент, електро, 46 хв — 1 блок понад 45 хв з −20 %", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:46:00+03:00", { bike: "ebike" }), SUBSCRIBER);
  assert.deepEqual(r, {
    minutes: 46,
    timeCharge: 8000, // 2 блоки × 40 грн
    discounts: [{ code: "subscription", amount: 4800 }], // 80 грн − 32 грн
    fees: [],
    total: 3200, // 1 блок × 40 грн × 80 %
  });
});

test("контракт коду: абонемент, 1 хв — 0 грн до сплати", () => {
  // Масив discounts не перевіряємо: чи має бути рядок знижки на 0 грн — відкрите питання.
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:01:00+03:00"), SUBSCRIBER);
  assert.equal(r.timeCharge, 0);
  assert.equal(r.total, 0);
});

// ---------------------------------------------------------------------------------------------
// Пільговий тариф: −50 %
// ---------------------------------------------------------------------------------------------

test("контракт коду: пільговий, класичний, 60 хв — −50 %", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T11:00:00+03:00"), REDUCED);
  assert.deepEqual(r, {
    minutes: 60,
    timeCharge: 5000, // 2 блоки × 25 грн
    discounts: [{ code: "reduced", amount: 2500 }], // 50 % від 50 грн
    fees: [],
    total: 2500,
  });
});

test("контракт коду: пільговий, електро, 31 хв — −50 %", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:31:00+03:00", { bike: "ebike" }), REDUCED);
  assert.deepEqual(r, {
    minutes: 31,
    timeCharge: 8000, // 2 блоки × 40 грн
    discounts: [{ code: "reduced", amount: 4000 }], // 50 % від 80 грн
    fees: [],
    total: 4000,
  });
});

// ---------------------------------------------------------------------------------------------
// Абонент із правом на пільгу: застосовується вигідніша з двох знижок (без нічиєї)
// ---------------------------------------------------------------------------------------------

test("контракт коду: абонент-пільговик, 40 хв — абонемент вигідніший (50 грн проти 25 грн)", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:40:00+03:00"), CONCESSION_SUBSCRIBER);
  assert.deepEqual(r, {
    minutes: 40,
    timeCharge: 5000, // 2 блоки × 25 грн
    discounts: [{ code: "subscription", amount: 5000 }], // ≤ 45 хв — безкоштовно; пільга дала б лише 25 грн
    fees: [],
    total: 0,
  });
});

test("контракт коду: абонент-пільговик, 120 хв — пільга вигідніша (50 грн проти 25 грн)", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T12:00:00+03:00"), CONCESSION_SUBSCRIBER);
  assert.deepEqual(r, {
    minutes: 120,
    timeCharge: 10000, // 4 блоки × 25 грн
    // абонемент: 75 хв понад 45 → 3 блоки × 25 грн = 75 грн, знижка 25 грн; пільга: 50 % = 50 грн
    discounts: [{ code: "reduced", amount: 5000 }],
    fees: [],
    total: 5000,
  });
});

// ---------------------------------------------------------------------------------------------
// Нічна знижка −30 % за київським часом взяття. Лише стандартний тариф (накладання знижок —
// відкрите питання), лише поїздки, що цілком у вікні або цілком поза ним, без межі 06:00:00.
// ---------------------------------------------------------------------------------------------

const NIGHT_60_MIN = {
  timeCharge: 5000, // 2 блоки × 25 грн
  discounts: [{ code: "night", amount: 1500 }], // 30 % від 50 грн
  fees: [],
  total: 3500,
};

test("контракт коду: ніч, 02:00 за Києвом (+03:00), 60 хв — −30 %", () => {
  const r = quote(ride("2026-07-10T02:00:00+03:00", "2026-07-10T03:00:00+03:00"), STANDARD);
  assert.deepEqual(r, { minutes: 60, ...NIGHT_60_MIN });
});

test("контракт коду: ніч, 21:30Z = 00:30 наступної доби за Києвом (літо), 60 хв — −30 %", () => {
  // За UTC година 21 — не ніч; за Києвом (+03:00) — 00:30 11 липня, ніч.
  const r = quote(ride("2026-07-10T21:30:00Z", "2026-07-10T22:30:00Z"), STANDARD);
  assert.deepEqual(r, { minutes: 60, ...NIGHT_60_MIN });
});

test("контракт коду: ніч, 22:30Z = 00:30 наступної доби за Києвом (зима), 60 хв — −30 %", () => {
  // Зимовий зсув +02:00: 22:30Z → 00:30 16 січня.
  const r = quote(ride("2026-01-15T22:30:00Z", "2026-01-15T23:30:00Z"), STANDARD);
  assert.deepEqual(r, { minutes: 60, ...NIGHT_60_MIN });
});

test("контракт коду: не ніч, 03:30Z = 06:30 за Києвом (літо), 60 хв — без знижки", () => {
  // За UTC година 3 була б «ніччю»; за Києвом це 06:30.
  const r = quote(ride("2026-07-10T03:30:00Z", "2026-07-10T04:30:00Z"), STANDARD);
  assert.deepEqual(r, { minutes: 60, timeCharge: 5000, discounts: [], fees: [], total: 5000 });
});

test("контракт коду: ніч переходу на літній час, 03:30Z = 06:30 EEST — без знижки", () => {
  // 29.03.2026 о 01:00Z годинник 03:00 → 04:00. Із застарілим зсувом +02:00 вийшло б 05:30 (ніч).
  const r = quote(ride("2026-03-29T03:30:00Z", "2026-03-29T03:50:00Z"), STANDARD);
  assert.deepEqual(r, { minutes: 20, timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

test("контракт коду: ніч переходу на літній час, 02:30+02:00 → 04:30+03:00 — це 60 хв, ніч", () => {
  // За настінним годинником 2 год, насправді 00:30Z → 01:30Z = 60 хв.
  const r = quote(ride("2026-03-29T02:30:00+02:00", "2026-03-29T04:30:00+03:00"), STANDARD);
  assert.deepEqual(r, { minutes: 60, ...NIGHT_60_MIN });
});

test("контракт коду: ніч переходу на зимовий час, 03:30+03:00 → 03:30+02:00 — це 60 хв, ніч", () => {
  // 25.10.2026 о 01:00Z годинник 04:00 → 03:00. Однаковий настінний час, насправді 00:30Z → 01:30Z.
  const r = quote(ride("2026-10-25T03:30:00+03:00", "2026-10-25T03:30:00+02:00"), STANDARD);
  assert.deepEqual(r, { minutes: 60, ...NIGHT_60_MIN });
});

// ---------------------------------------------------------------------------------------------
// Збори: повернення поза зоною (150 грн) і неповернення (> 24 год, 2000 грн)
// ---------------------------------------------------------------------------------------------

test("контракт коду: повернення на X01 (поза зоною) — збір 150 грн", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:20:00+03:00", { returnStation: "X01" }), STANDARD);
  assert.deepEqual(r, {
    minutes: 20,
    timeCharge: 2500, // 1 блок × 25 грн
    discounts: [],
    fees: [{ code: "out-of-zone", amount: 15000 }],
    total: 17500, // 25 грн + 150 грн
  });
});

test("контракт коду: рівно 24 год — збору за неповернення немає, час обмежено 300 грн", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-11T10:00:00+03:00"), STANDARD);
  assert.deepEqual(r, {
    minutes: 1440,
    timeCharge: 120000, // 48 блоків × 25 грн
    discounts: [{ code: "day-cap", amount: 90000 }], // 1200 грн − 300 грн
    fees: [],
    total: 30000,
  });
});

test("контракт коду: 24 год 1 хв — збір за неповернення 2000 грн", () => {
  const r = quote(ride("2026-07-10T10:00:00+03:00", "2026-07-11T10:01:00+03:00"), STANDARD);
  assert.deepEqual(r, {
    minutes: 1441,
    timeCharge: 122500, // 49 блоків × 25 грн
    discounts: [{ code: "day-cap", amount: 92500 }], // 1225 грн − 300 грн
    fees: [{ code: "unreturned", amount: 200000 }],
    total: 230000, // 300 грн + 2000 грн
  });
});

test("контракт коду: 25 год і повернення на X01 — обидва збори", () => {
  const r = quote(
    ride("2026-07-10T10:00:00+03:00", "2026-07-11T11:00:00+03:00", { returnStation: "X01" }),
    STANDARD,
  );
  assert.deepEqual(r, {
    minutes: 1500,
    timeCharge: 125000, // 50 блоків × 25 грн
    discounts: [{ code: "day-cap", amount: 95000 }], // 1250 грн − 300 грн
    fees: [
      { code: "out-of-zone", amount: 15000 },
      { code: "unreturned", amount: 200000 },
    ],
    total: 245000, // 300 + 150 + 2000 грн
  });
});

// ---------------------------------------------------------------------------------------------
// Денна межа з журналом createDayCap(): спільна для поїздок одного райдера за одну добу.
// Лише денні поїздки (10:00–19:00 за Києвом), де доба за UTC і за Києвом однакова.
// ---------------------------------------------------------------------------------------------

function ledgerWithFirstRide() {
  const dayCap = createDayCap();
  // 09:00–13:00 = 240 хв = 8 блоків × 25 грн = 200 грн
  quote(ride("2026-07-10T09:00:00+03:00", "2026-07-10T13:00:00+03:00"), { type: "standard", id: "r1" }, { dayCap });
  return dayCap;
}

test("контракт коду: журнал — друга поїздка за добу обмежена залишком 100 грн", () => {
  const dayCap = ledgerWithFirstRide();
  const r = quote(
    ride("2026-07-10T14:00:00+03:00", "2026-07-10T18:00:00+03:00"),
    { type: "standard", id: "r1" },
    { dayCap },
  );
  assert.deepEqual(r, {
    minutes: 240,
    timeCharge: 20000, // 8 блоків × 25 грн
    discounts: [{ code: "day-cap", amount: 10000 }], // 200 грн − (300 − 200) грн
    fees: [],
    total: 10000,
  });
});

test("контракт коду: журнал — після вичерпання 300 грн час не оплачується", () => {
  const dayCap = ledgerWithFirstRide();
  quote(ride("2026-07-10T14:00:00+03:00", "2026-07-10T18:00:00+03:00"), { type: "standard", id: "r1" }, { dayCap });
  const r = quote(
    ride("2026-07-10T18:30:00+03:00", "2026-07-10T19:00:00+03:00"),
    { type: "standard", id: "r1" },
    { dayCap },
  );
  assert.deepEqual(r, {
    minutes: 30,
    timeCharge: 2500, // 1 блок × 25 грн
    discounts: [{ code: "day-cap", amount: 2500 }], // залишок 0 грн
    fees: [],
    total: 0,
  });
});

test("контракт коду: журнал — записано суму після обмеження (200 + 100 = 300 грн)", () => {
  const dayCap = ledgerWithFirstRide();
  quote(ride("2026-07-10T14:00:00+03:00", "2026-07-10T18:00:00+03:00"), { type: "standard", id: "r1" }, { dayCap });
  assert.equal(dayCap.chargedOn("r1", "2026-07-10"), 30000);
});

test("контракт коду: журнал — наступна доба має повну межу", () => {
  const dayCap = ledgerWithFirstRide();
  const r = quote(
    ride("2026-07-11T10:00:00+03:00", "2026-07-11T14:00:00+03:00"),
    { type: "standard", id: "r1" },
    { dayCap },
  );
  assert.deepEqual(r, { minutes: 240, timeCharge: 20000, discounts: [], fees: [], total: 20000 }); // 8 × 25 грн
});

test("контракт коду: журнал — інший райдер тієї ж доби має повну межу", () => {
  const dayCap = ledgerWithFirstRide();
  const r = quote(
    ride("2026-07-10T14:00:00+03:00", "2026-07-10T18:00:00+03:00"),
    { type: "standard", id: "r2" },
    { dayCap },
  );
  assert.deepEqual(r, { minutes: 240, timeCharge: 20000, discounts: [], fees: [], total: 20000 }); // 8 × 25 грн
});

test("контракт коду: журнал — збори не записуються в денну межу", () => {
  const dayCap = createDayCap();
  quote(
    ride("2026-07-10T09:00:00+03:00", "2026-07-10T13:00:00+03:00", { returnStation: "X01" }),
    { type: "standard", id: "r1" },
    { dayCap },
  );
  assert.equal(dayCap.chargedOn("r1", "2026-07-10"), 20000); // лише час: 8 блоків × 25 грн, без 150 грн збору
});

// ---------------------------------------------------------------------------------------------
// Відмови: QuoteError з причиною
// ---------------------------------------------------------------------------------------------

const OK_RIDE = ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:20:00+03:00");

const REJECTIONS = [
  { name: "без поїздки", ride: undefined, rider: STANDARD, reason: /^ride is required$/ },
  {
    name: "pickupAt без зсуву",
    ride: ride("2026-07-10T10:00:00", "2026-07-10T10:20:00+03:00"),
    rider: STANDARD,
    reason: /^pickupAt must be an ISO 8601 date-time with an offset$/,
  },
  {
    name: "returnAt не рядок",
    ride: ride("2026-07-10T10:00:00+03:00", 1783667400000),
    rider: STANDARD,
    reason: /^returnAt must be an ISO 8601 date-time with an offset$/,
  },
  {
    name: "returnAt з неіснуючим місяцем",
    ride: ride("2026-07-10T10:00:00+03:00", "2026-13-01T10:00:00+03:00"),
    rider: STANDARD,
    reason: /^returnAt is not a valid date-time$/,
  },
  {
    name: "повернення на 1 с раніше взяття",
    ride: ride("2026-07-10T10:00:00+03:00", "2026-07-10T09:59:59+03:00"),
    rider: STANDARD,
    reason: /^returnAt is before pickupAt$/,
  },
  {
    name: "невідомий тип велосипеда",
    ride: ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:20:00+03:00", { bike: "tandem" }),
    rider: STANDARD,
    reason: /^unknown bike type: tandem$/,
  },
  {
    name: "невідома станція повернення",
    ride: ride("2026-07-10T10:00:00+03:00", "2026-07-10T10:20:00+03:00", { returnStation: "S99" }),
    rider: STANDARD,
    reason: /^unknown station: S99$/,
  },
  { name: "невідомий тип райдера", ride: OK_RIDE, rider: { type: "vip" }, reason: /^unknown rider type: vip$/ },
  { name: "без райдера", ride: OK_RIDE, rider: undefined, reason: /^unknown rider type: undefined$/ },
];
for (const c of REJECTIONS) {
  test(`контракт коду: відмова — ${c.name}`, () => {
    assert.throws(
      () => quote(c.ride, c.rider),
      (err) => err instanceof QuoteError && err.name === "QuoteError" && c.reason.test(err.message),
    );
  });
}

test("контракт коду: відмова — журнал dayCap без rider.id", () => {
  assert.throws(
    () => quote(OK_RIDE, STANDARD, { dayCap: createDayCap() }),
    (err) => err instanceof QuoteError && /^rider\.id is required with a daily cap ledger$/.test(err.message),
  );
});

// ---------------------------------------------------------------------------------------------
// discount(): знижка у відсотках; залишок до сплати округлюється вниз до копійки
// ---------------------------------------------------------------------------------------------

test("контракт коду: discount(2500, 30) = 750 коп. (без округлення)", () => {
  assert.equal(discount(2500, 30), 750); // 25 грн × 30 %
});

test("контракт коду: discount(1001, 30) = 301 коп. — залишок 700,7 коп. округлено вниз до 700", () => {
  assert.equal(discount(1001, 30), 301); // 1001 − ⌊1001 × 70 / 100⌋ = 1001 − 700
});
