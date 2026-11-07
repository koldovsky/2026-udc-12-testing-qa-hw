// Unit-тести для app/src/tariff.js.
//
// УВАГА: специфікацію docs/spec/tariffs.md у цьому прогоні не читали (умова завдання:
// лише app/src/ і package.json). Усі очікувані значення виведено вручну з поточного коду,
// тому кожен тест позначено «(current behaviour)». Вони фіксують поведінку, а не доводять,
// що вона правильна. ID правил (T3, T6, T9) узято з коментарів у коді, не зі специфікації.
//
// Очікування записано числами, а не через константи модуля (RATES, DAY_CAP, …).

import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, discount, QuoteError } from "../../app/src/tariff.js";
import { createZones } from "../../app/src/zones.js";

const STANDARD = { type: "standard" };
const REDUCED = { type: "reduced" };
const SUBSCRIBER = { type: "subscriber" };
const CONCESSION = { type: "subscriber", concession: true };

// Вересень: Київ = UTC+3. 08:00Z = 11:00 за Києвом — денна поїздка.
const P = "2026-09-15T08:00:00Z";

/** Порядок рядків знижок/зборів не перевіряємо — сортуємо за кодом. */
const byCode = (list) => [...list].sort((a, b) => a.code.localeCompare(b.code));
const norm = (r) => ({ ...r, discounts: byCode(r.discounts), fees: byCode(r.fees) });

function check(result, expected) {
  assert.deepEqual(norm(result), norm({ discounts: [], fees: [], ...expected }));
}

const ride = (returnAt, { pickupAt = P, bike = "classic", returnStation = "S01" } = {}) => ({
  pickupAt,
  returnAt,
  bike,
  returnStation,
});

// ---------------------------------------------------------------------------------------------
// Тривалість і блоки (T3 за коментарем у коді). Код: хвилини = Math.round(секунди / 60),
// < 2 хв — безкоштовно, далі ceil(хв / 30) блоків × тариф.
// ---------------------------------------------------------------------------------------------
const timeCases = [
  // id, bike, returnAt, minutes, timeCharge
  ["0 хв 00 с", "classic", "2026-09-15T08:00:00Z", 0, 0],
  ["1 хв 29 с", "classic", "2026-09-15T08:01:29Z", 1, 0], // round(1,48) = 1 < 2 → 0
  ["1 хв 30 с", "classic", "2026-09-15T08:01:30Z", 2, 2500], // round(1,5) = 2 → 1 блок
  ["2 хв 00 с", "classic", "2026-09-15T08:02:00Z", 2, 2500],
  ["30 хв 00 с", "classic", "2026-09-15T08:30:00Z", 30, 2500], // ceil(30/30) = 1
  ["30 хв 29 с", "classic", "2026-09-15T08:30:29Z", 30, 2500],
  ["30 хв 30 с", "classic", "2026-09-15T08:30:30Z", 31, 5000], // round → 31 → 2 блоки
  ["60 хв 00 с", "classic", "2026-09-15T09:00:00Z", 60, 5000],
  ["60 хв 30 с", "classic", "2026-09-15T09:00:30Z", 61, 7500], // 3 блоки
  ["ebike 1 хв 29 с", "ebike", "2026-09-15T08:01:29Z", 1, 0],
  ["ebike 1 хв 30 с", "ebike", "2026-09-15T08:01:30Z", 2, 4000],
  ["ebike 30 хв 00 с", "ebike", "2026-09-15T08:30:00Z", 30, 4000],
  ["ebike 30 хв 30 с", "ebike", "2026-09-15T08:30:30Z", 31, 8000],
];

for (const [id, bike, returnAt, minutes, timeCharge] of timeCases) {
  test(`T3: стандартний, ${bike}, ${id} → ${timeCharge} (current behaviour)`, () => {
    // код tariff.js:71,75,79-80
    check(quote(ride(returnAt, { bike }), STANDARD), { minutes, timeCharge, total: timeCharge });
  });
}

// ---------------------------------------------------------------------------------------------
// Абонемент. Код: перші 45 хв безкоштовно, далі ceil((хв − 45)/30) блоків; ebike −20 %.
// Знижка = timeCharge − ціна за абонементом.
// ---------------------------------------------------------------------------------------------
const subscriptionCases = [
  // id, bike, returnAt, minutes, timeCharge, subscription, total
  ["1 хв 00 с", "classic", "2026-09-15T08:01:00Z", 1, 0, 0, 0], // нульова знижка — без рядка
  ["45 хв 00 с", "classic", "2026-09-15T08:45:00Z", 45, 5000, 5000, 0],
  ["45 хв 29 с", "classic", "2026-09-15T08:45:29Z", 45, 5000, 5000, 0],
  ["45 хв 30 с", "classic", "2026-09-15T08:45:30Z", 46, 5000, 2500, 2500], // 1 блок понад 45
  ["75 хв 00 с", "classic", "2026-09-15T09:15:00Z", 75, 7500, 5000, 2500], // 30 хв понад → 1 блок
  ["75 хв 30 с", "classic", "2026-09-15T09:15:30Z", 76, 7500, 2500, 5000], // 31 хв понад → 2 блоки
  ["ebike 45 хв 00 с", "ebike", "2026-09-15T08:45:00Z", 45, 8000, 8000, 0],
  ["ebike 45 хв 30 с", "ebike", "2026-09-15T08:45:30Z", 46, 8000, 4800, 3200], // 4000 − 800
  ["ebike 75 хв 30 с", "ebike", "2026-09-15T09:15:30Z", 76, 12000, 5600, 6400], // 8000 − 1600
];

for (const [id, bike, returnAt, minutes, timeCharge, amount, total] of subscriptionCases) {
  test(`Абонемент: ${bike}, ${id} → ${total} (current behaviour)`, () => {
    // код tariff.js:83-86, 92
    const discounts = amount > 0 ? [{ code: "subscription", amount }] : [];
    check(quote(ride(returnAt, { bike }), SUBSCRIBER), { minutes, timeCharge, discounts, total });
  });
}

// ---------------------------------------------------------------------------------------------
// Пільговий тариф: −50 % від timeCharge.
// ---------------------------------------------------------------------------------------------
const reducedCases = [
  // id, bike, returnAt, minutes, timeCharge, reduced, total
  ["1 хв 00 с", "classic", "2026-09-15T08:01:00Z", 1, 0, 0, 0],
  ["30 хв 00 с", "classic", "2026-09-15T08:30:00Z", 30, 2500, 1250, 1250],
  ["30 хв 30 с", "classic", "2026-09-15T08:30:30Z", 31, 5000, 2500, 2500],
  ["ebike 30 хв 00 с", "ebike", "2026-09-15T08:30:00Z", 30, 4000, 2000, 2000],
];

for (const [id, bike, returnAt, minutes, timeCharge, amount, total] of reducedCases) {
  test(`Пільга: ${bike}, ${id} → ${total} (current behaviour)`, () => {
    // код tariff.js:94-95
    const discounts = amount > 0 ? [{ code: "reduced", amount }] : [];
    check(quote(ride(returnAt, { bike }), REDUCED), { minutes, timeCharge, discounts, total });
  });
}

// ---------------------------------------------------------------------------------------------
// Абонент із правом на пільгу: береться вигідніший план; при рівності — абонемент
// (reduce з «>», tariff.js:97). Див. питання у звіті.
// ---------------------------------------------------------------------------------------------
const concessionCases = [
  // id, rider, returnAt, minutes, timeCharge, discounts, total
  ["30 хв: абонемент 2500 > пільга 1250", CONCESSION, "2026-09-15T08:30:00Z", 30, 2500,
    [{ code: "subscription", amount: 2500 }], 0],
  ["46 хв: рівність 2500 = 2500 → абонемент", CONCESSION, "2026-09-15T08:45:30Z", 46, 5000,
    [{ code: "subscription", amount: 2500 }], 2500],
  ["90 хв: пільга 3750 > абонемент 2500", CONCESSION, "2026-09-15T09:30:00Z", 90, 7500,
    [{ code: "reduced", amount: 3750 }], 3750],
  ["90 хв, concession: false → лише абонемент", { type: "subscriber", concession: false },
    "2026-09-15T09:30:00Z", 90, 7500, [{ code: "subscription", amount: 2500 }], 5000],
  ["стандартний з concession: true → без знижки", { type: "standard", concession: true },
    "2026-09-15T08:30:00Z", 30, 2500, [], 2500],
];

for (const [id, rider, returnAt, minutes, timeCharge, discounts, total] of concessionCases) {
  test(`Вибір плану: ${id} (current behaviour)`, () => {
    check(quote(ride(returnAt), rider), { minutes, timeCharge, discounts, total });
  });
}

// ---------------------------------------------------------------------------------------------
// Нічна знижка −30 %, якщо година ВИДАЧІ за Києвом < 6. Межі біля 06:00 і 00:00 за Києвом,
// влітку (UTC+3) і взимку (UTC+2). Поїздка 30 хв, стандартний, classic → timeCharge 2500.
// ---------------------------------------------------------------------------------------------
const nightCases = [
  // id, pickupAt, returnAt, night?
  ["вер 05:59:59 Київ (02:59:59Z)", "2026-09-15T02:59:59Z", "2026-09-15T03:29:59Z", true],
  ["вер 06:00:00 Київ (03:00:00Z)", "2026-09-15T03:00:00Z", "2026-09-15T03:30:00Z", false],
  ["вер 23:59:59 Київ (20:59:59Z)", "2026-09-14T20:59:59Z", "2026-09-14T21:29:59Z", false],
  ["вер 00:00:00 Київ (21:00:00Z)", "2026-09-14T21:00:00Z", "2026-09-14T21:30:00Z", true],
  ["січ 05:59:59 Київ (03:59:59Z)", "2026-01-15T03:59:59Z", "2026-01-15T04:29:59Z", true],
  ["січ 06:00:00 Київ (04:00:00Z)", "2026-01-15T04:00:00Z", "2026-01-15T04:30:00Z", false],
  ["зсув +03:00, 05:59:59", "2026-09-15T05:59:59+03:00", "2026-09-15T06:29:59+03:00", true],
  ["видача 05:50, повернення 06:20 Київ", "2026-09-15T02:50:00Z", "2026-09-15T03:20:00Z", true],
  ["видача 23:50, повернення 00:20 Київ", "2026-09-14T20:50:00Z", "2026-09-14T21:20:00Z", false],
];

for (const [id, pickupAt, returnAt, night] of nightCases) {
  test(`Ніч: ${id} → ${night ? "1750" : "2500"} (current behaviour)`, () => {
    // код tariff.js:50-51: discount(2500, 30) = 2500 − floor(1750) = 750
    check(quote(ride(returnAt, { pickupAt }), STANDARD), {
      minutes: 30,
      timeCharge: 2500,
      discounts: night ? [{ code: "night", amount: 750 }] : [],
      total: night ? 1750 : 2500,
    });
  });
}

// Комбінації: порядок застосування план → ніч → добовий ліміт.
const comboCases = [
  ["пільга + ніч: 2500 − 1250 − 375", REDUCED, "2026-09-15T02:00:00Z", "2026-09-15T02:30:00Z", {
    minutes: 30, timeCharge: 2500,
    discounts: [{ code: "reduced", amount: 1250 }, { code: "night", amount: 375 }], total: 875 }],
  ["абонемент безкоштовно вночі → без рядка night", SUBSCRIBER, "2026-09-15T02:00:00Z",
    "2026-09-15T02:30:00Z", {
      minutes: 30, timeCharge: 2500, discounts: [{ code: "subscription", amount: 2500 }], total: 0 }],
  // 390 хв = 13 блоків = 32500; ніч 9750 → 22750 < 30000. Якби ліміт ішов до ночі: 30000 → 21000.
  ["ніч до ліміту: 32500 − 9750 = 22750, ліміт не спрацьовує", STANDARD, "2026-09-15T02:00:00Z",
    "2026-09-15T08:30:00Z", {
      minutes: 390, timeCharge: 32500, discounts: [{ code: "night", amount: 9750 }], total: 22750 }],
  // 540 хв = 18 блоків = 45000; ніч 13500 → 31500; ліміт 1500 → 30000.
  ["ніч, потім ліміт: 45000 − 13500 − 1500", STANDARD, "2026-09-15T02:00:00Z",
    "2026-09-15T11:00:00Z", {
      minutes: 540, timeCharge: 45000,
      discounts: [{ code: "night", amount: 13500 }, { code: "day-cap", amount: 1500 }], total: 30000 }],
];

for (const [id, rider, pickupAt, returnAt, expected] of comboCases) {
  test(`Комбінація: ${id} (current behaviour)`, () => {
    check(quote(ride(returnAt, { pickupAt }), rider), expected);
  });
}

// ---------------------------------------------------------------------------------------------
// Добовий ліміт без журналу (T6 за коментарем у коді): кожна поїздка окремо обмежена 30000.
// ---------------------------------------------------------------------------------------------
const capCases = [
  // id, returnAt, minutes, timeCharge, dayCap, total
  ["6 год 00 хв 00 с = рівно ліміт", "2026-09-15T14:00:00Z", 360, 30000, 0, 30000],
  ["6 год 00 хв 29 с", "2026-09-15T14:00:29Z", 360, 30000, 0, 30000],
  ["6 год 00 хв 30 с = ліміт + блок", "2026-09-15T14:00:30Z", 361, 32500, 2500, 30000],
];

for (const [id, returnAt, minutes, timeCharge, cap, total] of capCases) {
  test(`T6: без журналу, ${id} → ${total} (current behaviour)`, () => {
    // код tariff.js:56-60
    const discounts = cap > 0 ? [{ code: "day-cap", amount: cap }] : [];
    check(quote(ride(returnAt), STANDARD), { minutes, timeCharge, discounts, total });
  });
}

// ---------------------------------------------------------------------------------------------
// Збори: повернення поза зоною 15000; неповернення (> 1440 хв) 200000. Пільговику збори −50 %.
// Збори не входять у добовий ліміт.
// ---------------------------------------------------------------------------------------------
const feeCases = [
  ["стандартний, X01, 30 хв", STANDARD, "2026-09-15T08:30:00Z", "X01", {
    minutes: 30, timeCharge: 2500, fees: [{ code: "out-of-zone", amount: 15000 }], total: 17500 }],
  ["стандартний, S08 (в зоні), 30 хв", STANDARD, "2026-09-15T08:30:00Z", "S08", {
    minutes: 30, timeCharge: 2500, total: 2500 }],
  ["пільга, X01, 30 хв: 1250 + 7500", REDUCED, "2026-09-15T08:30:00Z", "X01", {
    minutes: 30, timeCharge: 2500, discounts: [{ code: "reduced", amount: 1250 }],
    fees: [{ code: "out-of-zone", amount: 7500 }], total: 8750 }],
  ["абонент-пільговик, X01, 30 хв: виграв абонемент → збір повний", CONCESSION,
    "2026-09-15T08:30:00Z", "X01", {
      minutes: 30, timeCharge: 2500, discounts: [{ code: "subscription", amount: 2500 }],
      fees: [{ code: "out-of-zone", amount: 15000 }], total: 15000 }],
  ["абонент-пільговик, X01, 90 хв: виграла пільга → збір −50 %", CONCESSION,
    "2026-09-15T09:30:00Z", "X01", {
      minutes: 90, timeCharge: 7500, discounts: [{ code: "reduced", amount: 3750 }],
      fees: [{ code: "out-of-zone", amount: 7500 }], total: 11250 }],
  // 1440 хв = 48 блоків = 120000 → ліміт 30000; збору ще немає (умова «> 1440»).
  ["24 год 00 хв 00 с", STANDARD, "2026-09-16T08:00:00Z", "S01", {
    minutes: 1440, timeCharge: 120000, discounts: [{ code: "day-cap", amount: 90000 }], total: 30000 }],
  ["24 год 00 хв 29 с", STANDARD, "2026-09-16T08:00:29Z", "S01", {
    minutes: 1440, timeCharge: 120000, discounts: [{ code: "day-cap", amount: 90000 }], total: 30000 }],
  // 1441 хв = 49 блоків = 122500 → ліміт 92500 → 30000 + 200000.
  ["24 год 00 хв 30 с", STANDARD, "2026-09-16T08:00:30Z", "S01", {
    minutes: 1441, timeCharge: 122500, discounts: [{ code: "day-cap", amount: 92500 }],
    fees: [{ code: "unreturned", amount: 200000 }], total: 230000 }],
  // 122500 − 61250 = 61250 → ліміт 31250 → 30000; збори 7500 + 100000.
  ["пільга, X02, 24 год 00 хв 30 с: обидва збори −50 %", REDUCED, "2026-09-16T08:00:30Z", "X02", {
    minutes: 1441, timeCharge: 122500,
    discounts: [{ code: "reduced", amount: 61250 }, { code: "day-cap", amount: 31250 }],
    fees: [{ code: "out-of-zone", amount: 7500 }, { code: "unreturned", amount: 100000 }],
    total: 137500 }],
];

for (const [id, rider, returnAt, returnStation, expected] of feeCases) {
  test(`Збори: ${id} (current behaviour)`, () => {
    // код tariff.js:63-66, 105-110
    check(quote(ride(returnAt, { returnStation }), rider), expected);
  });
}

test("Зони: власна таблиця станцій через createZones (current behaviour)", () => {
  // zones — залежність quote(), тож підставити власну таблицю дозволено.
  const zones = createZones({ T1: { name: "Тестова", zone: "out" } });
  const r = quote(ride("2026-09-15T08:30:00Z", { returnStation: "T1" }), STANDARD, { zones });
  check(r, { minutes: 30, timeCharge: 2500, fees: [{ code: "out-of-zone", amount: 15000 }], total: 17500 });
});

// ---------------------------------------------------------------------------------------------
// Округлення знижки (T9 за коментарем у коді): до сплати — вниз до копійки.
// ---------------------------------------------------------------------------------------------
const discountCases = [
  // amount, percent, discount
  [2500, 30, 750],
  [1250, 30, 375],
  [875, 30, 263], // 875 × 0,7 = 612,5 → 612 до сплати → знижка 263
  [101, 30, 31], // 70,7 → 70 → 31
  [3, 50, 2], // 1,5 → 1 → 2
  [1, 50, 1], // 0,5 → 0 → 1
  [4000, 20, 800],
  [0, 30, 0],
];

for (const [amount, percent, expected] of discountCases) {
  test(`T9: discount(${amount}, ${percent}) → ${expected} (current behaviour)`, () => {
    assert.equal(discount(amount, percent), expected);
  });
}

// ---------------------------------------------------------------------------------------------
// Відхилення запиту: перевіряємо лише, що це QuoteError з непорожнім поясненням.
// ---------------------------------------------------------------------------------------------
const okRide = ride("2026-09-15T08:30:00Z");
const rejectCases = [
  ["ride відсутній", null, STANDARD],
  ["returnAt на 1 с раніше pickupAt", ride("2026-09-15T07:59:59Z"), STANDARD],
  ["невідомий тип велосипеда", ride("2026-09-15T08:30:00Z", { bike: "tandem" }), STANDARD],
  ["невідома станція", ride("2026-09-15T08:30:00Z", { returnStation: "S99" }), STANDARD],
  ["rider відсутній", okRide, null],
  ["невідомий тип райдера", okRide, { type: "vip" }],
  // Контракт API (коментар у tariff.js:5), не правило специфікації: ISO 8601 з Z або зсувом.
  ["контракт: pickupAt без зсуву", { ...okRide, pickupAt: "2026-09-15T08:00:00" }, STANDARD],
  ["контракт: pickupAt лише дата", { ...okRide, pickupAt: "2026-09-15" }, STANDARD],
  ["контракт: pickupAt числом", { ...okRide, pickupAt: 1789459200000 }, STANDARD],
  ["контракт: returnAt без зсуву", { ...okRide, returnAt: "2026-09-15T08:30:00" }, STANDARD],
];

for (const [id, r, rider] of rejectCases) {
  test(`Відхилення: ${id} (current behaviour)`, () => {
    assert.throws(
      () => quote(r, rider),
      (err) => err instanceof QuoteError && typeof err.message === "string" && err.message.length > 0,
    );
  });
}

// Контракт API, не правило специфікації: приймаються зсув і запис без секунд.
const contractCases = [
  ["видача із зсувом +03:00", "2026-09-15T11:00:00+03:00", "2026-09-15T08:30:00Z"],
  ["без секунд", "2026-09-15T08:00Z", "2026-09-15T08:30Z"],
];

for (const [id, pickupAt, returnAt] of contractCases) {
  test(`Контракт: ${id} → 30 хв, 2500 (current behaviour)`, () => {
    check(quote(ride(returnAt, { pickupAt }), STANDARD), { minutes: 30, timeCharge: 2500, total: 2500 });
  });
}
