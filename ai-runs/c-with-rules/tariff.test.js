// Unit-тести для app/src/tariff.js (quote, discount, QuoteError).
//
// Джерело очікувань. Файлу docs/spec/tariffs.md у робочій теці немає, тож номери рядків
// специфікації не перевірені й не вказані. Межі T1/T2/T3/T4/T6/T8/T10 і приклад
// «75 хв Ел → 12 000» взято з правил проєкту (CLAUDE.md, правила 5 і 8). Ставки, відсотки
// й штрафи, яких правила не називають, — з коментарів і назв у app/src (позначено «з коду»).
// Очікування записані літералами, виведення — у коментарях.

import { test } from "node:test";
import assert from "node:assert/strict";

import { quote, discount, QuoteError } from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";
import { createZones } from "../../app/src/zones.js";

const STANDARD = { type: "standard" };
const REDUCED = { type: "reduced" };
const SUBSCRIBER = { type: "subscriber" };
const SUBSCRIBER_CONCESSION = { type: "subscriber", concession: true };

function ride(pickupAt, returnAt, bike = "classic", returnStation = "S01") {
  return { pickupAt, returnAt, bike, returnStation };
}

/** Усе, крім minutes: хвилини перевіряються окремими тестами T1. */
function charge({ timeCharge, discounts, fees, total }) {
  return { timeCharge, discounts, fees, total };
}

// ───────────────────────── T1: хвилини округлюються вгору ─────────────────────────

// T1 (CLAUDE.md, правило 8: «T1 округлює вгору»)
// Впаде, якщо: округлення ceil → floor/round.
test("T1: рівно 10:00 → 10 хв", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:10:00+03:00"), STANDARD);
  assert.equal(r.minutes, 10);
});

// T1: неповна хвилина рахується як ціла.
// Впаде, якщо: округлення ceil → round/floor.
test("T1: 10:01 → 11 хв", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:10:01+03:00"), STANDARD);
  assert.equal(r.minutes, 11);
});

// T1. Впаде, якщо: округлення ceil → floor.
test("T1: 10:59 → 11 хв", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:10:59+03:00"), STANDARD);
  assert.equal(r.minutes, 11);
});

// ───────────────────────── T2: безкоштовний старт «не більше 2 хвилин» ─────────────────────────

// T2. Впаде, якщо: поріг безкоштовного старту зникне чи стане 0.
test("T2: стандарт · Кл · 0:00 → 0 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:00:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 0, discounts: [], fees: [], total: 0 });
});

// T2: «не більше 2 хвилин» — 2:00 включно безкоштовно.
// Впаде, якщо: `<=` → `<` на межі 2 хв.
test("T2: стандарт · Кл · 2:00 → 0 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:02:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 0, discounts: [], fees: [], total: 0 });
});

// T2 + T1 + T3: 2:01 → 3 хв > 2 → 1 блок × 25 грн (ставка — з коду) = 2 500.
// Впаде, якщо: поріг 2 хв зросте; ставка Кл зміниться.
test("T2: стандарт · Кл · 2:01 → 2500 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:02:01+03:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

// ───────────────────────── T3: блоки по 30 хв ─────────────────────────

// T3: 30 хв → 1 блок × 25 грн = 2 500.
// Впаде, якщо: блок < 30 хв; ставка Кл ≠ 2500.
test("T3: стандарт · Кл · 30:00 → 2500 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:30:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

// T3 + T1: 30:01 → 31 хв → 2 блоки × 25 грн = 5 000.
// Впаде, якщо: хвилини округлюються не вгору; блок > 30 хв.
test("T3: стандарт · Кл · 30:01 → 5000 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:30:01+03:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 5000, discounts: [], fees: [], total: 5000 });
});

// T3: 60 хв → 2 блоки × 25 грн = 5 000.
// Впаде, якщо: Math.ceil → Math.floor(…)+1 для блоків.
test("T3: стандарт · Кл · 60:00 → 5000 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T13:00:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 5000, discounts: [], fees: [], total: 5000 });
});

// T3 (CLAUDE.md, правило 5): 75 хв → 3 блоки × 40 грн = 12 000.
// Впаде, якщо: ставка Ел ≠ 4000; блок ≠ 30 хв.
test("T3: стандарт · Ел · 75:00 → 12000 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T13:15:00+03:00", "ebike"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 12000, discounts: [], fees: [], total: 12000 });
});

// ───────────────────────── T4: абонемент, 45 безкоштовних хвилин (Кл) ─────────────────────────

// T4: 45 хв → 2 блоки = 5 000; абонемент: 45 − 45 = 0 хв понад → 0; знижка 5 000.
// Впаде, якщо: безкоштовних хвилин < 45.
test("T4: абонент · Кл · 45:00 → 0 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:45:00+03:00"), SUBSCRIBER);
  assert.deepEqual(charge(r), {
    timeCharge: 5000,
    discounts: [{ code: "subscription", amount: 5000 }],
    fees: [],
    total: 0,
  });
});

// T4 + T1: 45:01 → 46 хв → 2 блоки = 5 000; понад 45 — 1 хв → 1 блок = 2 500; знижка 2 500.
// Впаде, якщо: хвилини округлюються не вгору; безкоштовних хвилин > 45.
test("T4: абонент · Кл · 45:01 → 2500 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:45:01+03:00"), SUBSCRIBER);
  assert.deepEqual(charge(r), {
    timeCharge: 5000,
    discounts: [{ code: "subscription", amount: 2500 }],
    fees: [],
    total: 2500,
  });
});

// T4: 46 хв → 2 блоки = 5 000; понад 45 — 1 хв → 1 блок = 2 500.
// Впаде, якщо: безкоштовних хвилин ≥ 46.
test("T4: абонент · Кл · 46:00 → 2500 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:46:00+03:00"), SUBSCRIBER);
  assert.deepEqual(charge(r), {
    timeCharge: 5000,
    discounts: [{ code: "subscription", amount: 2500 }],
    fees: [],
    total: 2500,
  });
});

// T4: 76 хв → 3 блоки = 7 500; понад 45 — 31 хв → 2 блоки = 5 000; знижка 2 500.
// Впаде, якщо: блоки понад 45 хв рахуються вниз (floor).
test("T4: абонент · Кл · 76:00 → 5000 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T13:16:00+03:00"), SUBSCRIBER);
  assert.deepEqual(charge(r), {
    timeCharge: 7500,
    discounts: [{ code: "subscription", amount: 2500 }],
    fees: [],
    total: 5000,
  });
});

// ───────────────────────── Пільговий тариф (50 %, з коду) ─────────────────────────

// Пільга: 30 хв → 2 500 − 50 % = 1 250.
// Впаде, якщо: відсоток пільги ≠ 50.
test("Пільга: пільговик · Кл · 30:00 → 1250 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:30:00+03:00"), REDUCED);
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [{ code: "reduced", amount: 1250 }],
    fees: [],
    total: 1250,
  });
});

// Пільга: 75 хв Ел → 12 000 − 50 % = 6 000.
// Впаде, якщо: пільга не поширюється на Ел.
test("Пільга: пільговик · Ел · 75:00 → 6000 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T13:15:00+03:00", "ebike"), REDUCED);
  assert.deepEqual(charge(r), {
    timeCharge: 12000,
    discounts: [{ code: "reduced", amount: 6000 }],
    fees: [],
    total: 6000,
  });
});

// Абонент із пільгою — дешевший із двох планів (коментар у коді «whichever leaves the rider
// less to pay»). 30 хв: абонемент → 0, пільга → 1 250. Дешевше — абонемент, знижка 2 500.
// Впаде, якщо: вибирається пільга замість дешевшого плану.
test("T4/Пільга: абонент-пільговик · Кл · 30:00 → 0 коп. (абонемент вигідніший)", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:30:00+03:00"), SUBSCRIBER_CONCESSION);
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [{ code: "subscription", amount: 2500 }],
    fees: [],
    total: 0,
  });
});

// 120 хв → 4 блоки = 10 000. Абонемент: 75 хв понад → 3 блоки = 7 500 (знижка 2 500).
// Пільга: 10 000 − 50 % = 5 000 (знижка 5 000). Дешевше — пільга.
// Впаде, якщо: завжди береться абонемент; або знижки складаються (тоді total ≠ 5000).
test("T4/Пільга: абонент-пільговик · Кл · 120:00 → 5000 коп. (пільга вигідніша)", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T14:00:00+03:00"), SUBSCRIBER_CONCESSION);
  assert.deepEqual(charge(r), {
    timeCharge: 10000,
    discounts: [{ code: "reduced", amount: 5000 }],
    fees: [],
    total: 5000,
  });
});

// Той самий час без права на пільгу: лише абонемент → 7 500.
// Впаде, якщо: пільга дається абоненту без concession.
test("T4: абонент без пільги · Кл · 120:00 → 7500 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T14:00:00+03:00"), SUBSCRIBER);
  assert.deepEqual(charge(r), {
    timeCharge: 10000,
    discounts: [{ code: "subscription", amount: 2500 }],
    fees: [],
    total: 7500,
  });
});

// ───────────────────────── T9: округлення «до сплати» вниз ─────────────────────────

// T9 (коментар у коді: «what is left to pay is rounded down to the kopeck»):
// 1 001 − 50 % = 500,5 → до сплати 500 → знижка 501.
// Впаде, якщо: floor → round/ceil для залишку.
test("T9: discount(1001, 50) → 501 (до сплати 500)", () => {
  assert.equal(discount(1001, 50), 501);
});

// 999 − 30 % = 699,3 → до сплати 699 → знижка 300.
// Впаде, якщо: floor → ceil.
test("T9: discount(999, 30) → 300 (до сплати 699)", () => {
  assert.equal(discount(999, 30), 300);
});

// ───────────────────────── T10: нічна знижка, 00:00–06:00 за Києвом ─────────────────────────

// T10: взяття о 05:59 за Києвом — ніч. 10 хв → 2 500 − 30 % (з коду) = 1 750.
// Впаде, якщо: межа ночі < 06:00; відсоток ≠ 30.
test("T10: стандарт · Кл · взяття 05:59 Київ (+03:00) → 1750 коп.", () => {
  const r = quote(ride("2026-09-16T05:59:00+03:00", "2026-09-16T06:09:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [{ code: "night", amount: 750 }],
    fees: [],
    total: 1750,
  });
});

// T10: 06:00 — уже не ніч.
// Впаде, якщо: `<` → `<=` на межі 06:00.
test("T10: стандарт · Кл · взяття 06:00 Київ (+03:00) → 2500 коп.", () => {
  const r = quote(ride("2026-09-16T06:00:00+03:00", "2026-09-16T06:10:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

// T10: 23:59 — ще не ніч.
// Впаде, якщо: ніч починається раніше 00:00.
test("T10: стандарт · Кл · взяття 23:59 Київ (+03:00) → 2500 коп.", () => {
  const r = quote(ride("2026-09-16T23:59:00+03:00", "2026-09-17T00:09:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

// T10: 00:00 — ніч. 2 500 − 30 % = 1 750.
// Впаде, якщо: ніч починається пізніше 00:00.
test("T10: стандарт · Кл · взяття 00:00 Київ (+03:00) → 1750 коп.", () => {
  const r = quote(ride("2026-09-17T00:00:00+03:00", "2026-09-17T00:10:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [{ code: "night", amount: 750 }],
    fees: [],
    total: 1750,
  });
});

// T10, зимовий час: 05:59+02:00 — ніч.
// Впаде, якщо: зсув Києва захардкоджено як +03:00.
test("T10: стандарт · Кл · взяття 05:59 Київ (+02:00) → 1750 коп.", () => {
  const r = quote(ride("2026-11-11T05:59:00+02:00", "2026-11-11T06:09:00+02:00"), STANDARD);
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [{ code: "night", amount: 750 }],
    fees: [],
    total: 1750,
  });
});

// T10, зимовий час: 06:00+02:00 — не ніч.
// Впаде, якщо: година береться в UTC (04:00 → ніч).
test("T10: стандарт · Кл · взяття 06:00 Київ (+02:00) → 2500 коп.", () => {
  const r = quote(ride("2026-11-11T06:00:00+02:00", "2026-11-11T06:10:00+02:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

// T10, Київ ≠ UTC: 2026-09-15T22:30Z = 01:30 за Києвом → ніч (за UTC 22:30 — не ніч).
// Впаде, якщо: година береться в UTC.
test("T10: взяття 22:30Z = 01:30 Київ → нічна знижка", () => {
  const r = quote(ride("2026-09-15T22:30:00Z", "2026-09-15T22:40:00Z"), STANDARD);
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [{ code: "night", amount: 750 }],
    fees: [],
    total: 1750,
  });
});

// T10, Київ ≠ UTC: 2026-09-16T03:30Z = 06:30 за Києвом → не ніч (за UTC 03:30 — ніч).
// Впаде, якщо: година береться в UTC.
test("T10: взяття 03:30Z = 06:30 Київ → без нічної знижки", () => {
  const r = quote(ride("2026-09-16T03:30:00Z", "2026-09-16T03:40:00Z"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

// T10 після пільги: 2 500 → −1 250 (пільга) = 1 250 → −30 % = 875 (знижка 375).
// Впаде, якщо: нічна знижка рахується від timeCharge, а не від залишку (750 замість 375).
test("T10/Пільга: пільговик · Кл · 01:00 Київ → 875 коп.", () => {
  const r = quote(ride("2026-09-16T01:00:00+03:00", "2026-09-16T01:10:00+03:00"), REDUCED);
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [
      { code: "reduced", amount: 1250 },
      { code: "night", amount: 375 },
    ],
    fees: [],
    total: 875,
  });
});

// ───────────────────────── Штрафи: поза зоною, неповернення (T8) ─────────────────────────

// Повернення поза зоною (X01 — out, додаток А): 2 500 + 150 грн (з коду) = 17 500.
// Впаде, якщо: штраф ≠ 15 000; зона X01 вважається «in».
test("Зона: стандарт · Кл · 10 хв · повернення X01 (поза зоною) → 17500 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:10:00+03:00", "classic", "X01"), STANDARD);
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [],
    fees: [{ code: "out-of-zone", amount: 15000 }],
    total: 17500,
  });
});

// Зовнішня залежність zones підмінена через параметр (правило 6).
// Впаде, якщо: quote ігнорує переданий zones.
test("Зона: власна таблиця станцій — станція «out» дає штраф", () => {
  const zones = createZones({ T1: { name: "Тест", zone: "out" } });
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:10:00+03:00", "classic", "T1"), STANDARD, {
    zones,
  });
  assert.deepEqual(r.fees, [{ code: "out-of-zone", amount: 15000 }]);
});

// Пільговик поза зоною: штраф теж −50 % (з коду): 1 250 + 7 500 = 8 750.
// Впаде, якщо: пільга перестане поширюватися на штрафи.
test("Зона/Пільга: пільговик · Кл · 10 хв · X01 → 8750 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:10:00+03:00", "classic", "X01"), REDUCED);
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [{ code: "reduced", amount: 1250 }],
    fees: [{ code: "out-of-zone", amount: 7500 }],
    total: 8750,
  });
});

// T8: рівно 24 год — ще не «неповернення».
// Впаде, якщо: `>` → `>=` на межі 24 год.
test("T8: рівно 24 год → без штрафу за неповернення", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-17T12:00:00+03:00"), STANDARD);
  assert.deepEqual(r.fees, []);
});

// T8 + T1: 24 год 1 с → 1 441 хв > 1 440 → штраф 2 000 грн (з коду) = 200 000.
// Впаде, якщо: хвилини округлюються не вгору; межа > 24 год.
test("T8: 24 год 1 с → штраф unreturned 200000 коп.", () => {
  const r = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-17T12:00:01+03:00"), STANDARD);
  assert.deepEqual(r.fees, [{ code: "unreturned", amount: 200000 }]);
});

// ───────────────────────── T6: денний ліміт 300 грн ─────────────────────────

// T6 без журналу: 6 год → 12 блоків × 25 грн = 30 000 = ліміт → без знижки day-cap.
// Впаде, якщо: ліміт < 30 000; `>` → `>=`.
test("T6: стандарт · Кл · 6 год → 30000 коп., без day-cap", () => {
  const r = quote(ride("2026-09-16T08:00:00+03:00", "2026-09-16T14:00:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), { timeCharge: 30000, discounts: [], fees: [], total: 30000 });
});

// T6: 6 год 30 хв → 13 блоків = 32 500 → обрізається до 30 000, знижка day-cap 2 500.
// Впаде, якщо: ліміт ≠ 30 000; ліміт не застосовується.
test("T6: стандарт · Кл · 6 год 30 хв → 30000 коп. (day-cap 2500)", () => {
  const r = quote(ride("2026-09-16T08:00:00+03:00", "2026-09-16T14:30:00+03:00"), STANDARD);
  assert.deepEqual(charge(r), {
    timeCharge: 32500,
    discounts: [{ code: "day-cap", amount: 2500 }],
    fees: [],
    total: 30000,
  });
});

// T6 стосується лише плати за час: 7 год → 14 блоків = 35 000 → 30 000; + штраф 15 000 = 45 000.
// Впаде, якщо: штрафи теж обрізаються лімітом.
test("T6: ліміт не обрізає штраф поза зоною → 45000 коп.", () => {
  const r = quote(ride("2026-09-16T08:00:00+03:00", "2026-09-16T15:00:00+03:00", "classic", "X02"), STANDARD);
  assert.deepEqual(charge(r), {
    timeCharge: 35000,
    discounts: [{ code: "day-cap", amount: 5000 }],
    fees: [{ code: "out-of-zone", amount: 15000 }],
    total: 45000,
  });
});

// T6 з журналом: 1-ша поїздка 60 хв = 5 000 → залишок 25 000; 2-га 300 хв = 10 блоків = 25 000
// — рівно залишок, без знижки.
// Впаде, якщо: `>` → `>=` у порівнянні із залишком (парний тест нижче ловить ігнорування журналу).
test("T6: залишок 25000, поїздка рівно 25000 → без day-cap", () => {
  const dayCap = createDayCap();
  const rider = { type: "standard", id: "r1" };
  quote(ride("2026-09-16T08:00:00+03:00", "2026-09-16T09:00:00+03:00"), rider, { dayCap });
  const r = quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T15:00:00+03:00"), rider, { dayCap });
  assert.deepEqual(charge(r), { timeCharge: 25000, discounts: [], fees: [], total: 25000 });
});

// T6 з журналом: залишок 25 000; 2-га поїздка 330 хв = 11 блоків = 27 500 → day-cap 2 500.
// Впаде, якщо: журнал не враховує попередню поїздку.
test("T6: залишок 25000, поїздка 27500 → 25000 коп. (day-cap 2500)", () => {
  const dayCap = createDayCap();
  const rider = { type: "standard", id: "r1" };
  quote(ride("2026-09-16T08:00:00+03:00", "2026-09-16T09:00:00+03:00"), rider, { dayCap });
  const r = quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T15:30:00+03:00"), rider, { dayCap });
  assert.deepEqual(charge(r), {
    timeCharge: 27500,
    discounts: [{ code: "day-cap", amount: 2500 }],
    fees: [],
    total: 25000,
  });
});

// T6: інший користувач має власний ліміт.
// Впаде, якщо: ключ журналу не містить rider.id.
test("T6: ліміт одного користувача не зменшує ліміт іншого", () => {
  const dayCap = createDayCap();
  quote(ride("2026-09-16T08:00:00+03:00", "2026-09-16T18:00:00+03:00"), { type: "standard", id: "a" }, { dayCap });
  const r = quote(ride("2026-09-16T19:00:00+03:00", "2026-09-16T19:30:00+03:00"), { type: "standard", id: "b" }, {
    dayCap,
  });
  assert.deepEqual(charge(r), { timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

// T6 «за київським часом», Київ ≠ UTC.
// 1-ша: взяття 16.09 20:00 Київ, 10 год = 20 блоків = 50 000 → обрізано до 30 000 (ліміт 16.09 вичерпано).
// 2-га: взяття 17.09 00:30 Київ (= 16.09 21:30 UTC) — новий київський день, ліміт 30 000.
// 10 хв = 2 500, ніч (T10) −750 = 1 750; day-cap не застосовується.
// Впаде, якщо: день журналу береться в UTC (тоді ще 16.09 → day-cap 1 750, total 0).
test("T6: поїздка о 00:30 Київ (21:30 UTC попередньої дати) — новий день ліміту", () => {
  const dayCap = createDayCap();
  const rider = { type: "standard", id: "r1" };
  quote(ride("2026-09-16T20:00:00+03:00", "2026-09-17T06:00:00+03:00"), rider, { dayCap });
  const r = quote(ride("2026-09-17T00:30:00+03:00", "2026-09-17T00:40:00+03:00"), rider, { dayCap });
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [{ code: "night", amount: 750 }],
    fees: [],
    total: 1750,
  });
});

// T6, Київ ≠ UTC, у зворотний бік.
// 1-ша: взяття 17.09 01:00 Київ (= 16.09 22:00 UTC), 10 год = 50 000, ніч −15 000 = 35 000 → 30 000.
// 2-га: взяття 17.09 12:00 Київ — той самий київський день, ліміт вичерпано → 2 500 знімає day-cap.
// Впаде, якщо: день журналу береться в UTC (тоді 1-ша записана на 16.09 → total 2 500).
test("T6: поїздки 01:00 і 12:00 того ж київського дня ділять ліміт", () => {
  const dayCap = createDayCap();
  const rider = { type: "standard", id: "r1" };
  quote(ride("2026-09-17T01:00:00+03:00", "2026-09-17T11:00:00+03:00"), rider, { dayCap });
  const r = quote(ride("2026-09-17T12:00:00+03:00", "2026-09-17T12:30:00+03:00"), rider, { dayCap });
  assert.deepEqual(charge(r), {
    timeCharge: 2500,
    discounts: [{ code: "day-cap", amount: 2500 }],
    fees: [],
    total: 0,
  });
});

// ───────────────────────── Розд. 4: відмова з поясненням ─────────────────────────

const valid = () => ride("2026-09-16T12:00:00+03:00", "2026-09-16T12:10:00+03:00");
/** Відмова: саме QuoteError і непорожнє пояснення (текст специфікація не задає). */
const refusal = (e) => e instanceof QuoteError && /\S/.test(e.message);

// Впаде, якщо: перевірку порядку часу прибрати.
test("Відмова: повернення раніше взяття → QuoteError з поясненням", () => {
  assert.throws(() => quote(ride("2026-09-16T12:10:00+03:00", "2026-09-16T12:00:00+03:00"), STANDARD), refusal);
});

// Впаде, якщо: приймати час без зсуву (тоді результат залежить від зони машини).
test("Відмова: час без зсуву → QuoteError з поясненням", () => {
  assert.throws(() => quote(ride("2026-09-16T12:00:00", "2026-09-16T12:10:00+03:00"), STANDARD), refusal);
});

// Впаде, якщо: невідомий тип велосипеда тихо рахується (NaN чи 0).
test("Відмова: невідомий тип велосипеда → QuoteError з поясненням", () => {
  assert.throws(() => quote({ ...valid(), bike: "tandem" }, STANDARD), refusal);
});

// Впаде, якщо: невідомий тип користувача рахується як стандарт.
test("Відмова: невідомий тип користувача → QuoteError з поясненням", () => {
  assert.throws(() => quote(valid(), { type: "vip" }), refusal);
});

// Впаде, якщо: невідома станція трактується як «in» чи «out».
test("Відмова: невідома станція повернення → QuoteError з поясненням", () => {
  assert.throws(() => quote({ ...valid(), returnStation: "Z99" }, STANDARD), refusal);
});

// Впаде, якщо: відсутність ride дає TypeError замість QuoteError.
test("Відмова: немає поїздки → QuoteError з поясненням", () => {
  assert.throws(() => quote(null, STANDARD), refusal);
});

// Впаде, якщо: з журналом приймати користувача без id (ліміт пишеться на «undefined»).
test("Відмова: журнал ліміту без rider.id → QuoteError з поясненням", () => {
  assert.throws(() => quote(valid(), STANDARD, { dayCap: createDayCap() }), refusal);
});
