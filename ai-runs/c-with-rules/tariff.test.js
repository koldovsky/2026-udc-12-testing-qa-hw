// Unit-тести для app/src/tariff.js на вбудованому ранері Node (node:test + node:assert/strict).
// Прогін: node --test "ai-runs/b1-from-code/*.test.js"
//
// Очікувані значення виведено з коду та констант app/src/ (специфікація docs/spec/tariffs.md
// у canvas-теці була недоступна, а промпт дозволяв читати лише app/src/ і кореневий package.json).
// ID правил наведено лише там, де їх називають самі коментарі в коді:
// tariff.js — «timeCharge is the T3 price», день-ліміт — T6 (day-cap.js), округлення — T9 (discount()).
//
// Самовимоги (з AGENTS.md): один тест — один сценарій/правило; асерції — на конкретні
// бізнес-значення (копійки, коди знижок/штрафів); граничні умови явні (рівно 2 хв,
// рівно 45 хв, рівно 1440 хв, «30 хв + 1 мс», «>» проти «>=»); `quote` не мокається —
// тестується реальний код, передаються справжні об'єкти day-cap/зони за замовчуванням.

import assert from "node:assert/strict";
import { test } from "node:test";

import { quote, discount, QuoteError } from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";

const makeRide = (pickupAt, returnAt, bike = "classic", returnStation = "S01") => ({
  pickupAt,
  returnAt,
  bike,
  returnStation,
});
const standard = { type: "standard" };
const reduced = { type: "reduced" };
const subscriber = { type: "subscriber" };

// Полігон для нічних поїздок: травень 2026, Київ у DST = UTC+3,
// тож "…T05:30:00+03:00" — це рівно 05:30 за київським настінним годинником.

// ---------- T3: блоковий тариф за час ----------

test("T3: 30 хв рівно — один блок, 2500 коп", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z"), standard);
  assert.deepEqual(got, { minutes: 30, timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

test("T3: межа блоку — 30 хв + 1 мс це вже хвилина 31 → два блоки, 5000 коп", () => {
  const got = quote(makeRide("2026-05-01T09:00:00.000Z", "2026-05-01T09:30:00.001Z"), standard);
  assert.deepEqual(got, { minutes: 31, timeCharge: 5000, discounts: [], fees: [], total: 5000 });
});

test("T3: ebike має свій тариф — 30 хв = 4000 коп", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z", "ebike"), standard);
  assert.deepEqual(got, { minutes: 30, timeCharge: 4000, discounts: [], fees: [], total: 4000 });
});

// ---------- безплатний старт (перші хвилини) ----------

test("безплатний старт: рівно 2 хв коштують 0 коп", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:02:00Z"), standard);
  assert.deepEqual(got, { minutes: 2, timeCharge: 0, discounts: [], fees: [], total: 0 });
});

test("безплатний старт: межа «<=2» — 2 хв + 1 мс → хвилина 3 → 1 блок, 2500 коп", () => {
  const got = quote(makeRide("2026-05-01T09:00:00.000Z", "2026-05-01T09:02:00.001Z"), standard);
  assert.deepEqual(got, { minutes: 3, timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

// ---------- абонемент: перші 45 хв безплатні (класик), ebike — 20% на увесь час ----------

test("абонемент: рівно 45 хв класиком — до сплати 0, знижка «subscription» покриває всі 5000", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:45:00Z"), subscriber);
  assert.deepEqual(got, {
    minutes: 45,
    timeCharge: 5000,
    discounts: [{ code: "subscription", amount: 5000 }],
    fees: [],
    total: 0,
  });
});

test("абонемент: межа 45 хв — 45 хв + 1 мс → хвилина 46 → оплатних 1 блок, до сплати 2500", () => {
  const got = quote(makeRide("2026-05-01T09:00:00.000Z", "2026-05-01T09:45:00.001Z"), subscriber);
  assert.deepEqual(got, {
    minutes: 46,
    timeCharge: 5000,
    discounts: [{ code: "subscription", amount: 2500 }],
    fees: [],
    total: 2500,
  });
});

test("абонемент: ebike перших 45 хв НЕ має — 30 хв це -20% від 4000 → до сплати 3200", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z", "ebike"), subscriber);
  assert.deepEqual(got, {
    minutes: 30,
    timeCharge: 4000,
    discounts: [{ code: "subscription", amount: 800 }],
    fees: [],
    total: 3200,
  });
});

test("абонемент: ebike 45 хв — 2 блоки × 4000 = 8000, -20% → до сплати 6400", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:45:00Z", "ebike"), subscriber);
  assert.deepEqual(got, {
    minutes: 45,
    timeCharge: 8000,
    discounts: [{ code: "subscription", amount: 1600 }],
    fees: [],
    total: 6400,
  });
});

// ---------- пільговий тариф (reduced): 50% на час ----------

test("пільговий: класик 60 хв = 5000 коп → 50% знижка, до сплати 2500", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T10:00:00Z"), reduced);
  assert.deepEqual(got, {
    minutes: 60,
    timeCharge: 5000,
    discounts: [{ code: "reduced", amount: 2500 }],
    fees: [],
    total: 2500,
  });
});

test("subscriber із пільгою (concession): зі 120 хв виграє дешевший план «reduced» 5000, а не «subscription» 2500", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T11:00:00Z"), {
    type: "subscriber",
    concession: true,
  });
  assert.deepEqual(got, {
    minutes: 120,
    timeCharge: 10000,
    discounts: [{ code: "reduced", amount: 5000 }],
    fees: [],
    total: 5000,
  });
});

// ---------- нічна знижка: підйом о 00:00–05:59 за Києвом → 30% ----------

test("нічна: підйом о 05:30 за Києвом — 30% з 2500 = 750, до сплати 1750", () => {
  const got = quote(makeRide("2026-05-01T05:30:00+03:00", "2026-05-01T06:00:00+03:00"), standard);
  assert.deepEqual(got, {
    minutes: 30,
    timeCharge: 2500,
    discounts: [{ code: "night", amount: 750 }],
    fees: [],
    total: 1750,
  });
});

test("нічна: межа — рівно 06:00 за Києвом знижки вже немає (2500 без знижок)", () => {
  const got = quote(makeRide("2026-05-01T06:00:00+03:00", "2026-05-01T06:30:00+03:00"), standard);
  assert.deepEqual(got, { minutes: 30, timeCharge: 2500, discounts: [], fees: [], total: 2500 });
});

test("нічна: 05:59 за Києвом — ще ніч (750 з 2500)", () => {
  const got = quote(makeRide("2026-05-01T05:59:00+03:00", "2026-05-01T06:29:00+03:00"), standard);
  assert.deepEqual(got, {
    minutes: 30,
    timeCharge: 2500,
    discounts: [{ code: "night", amount: 750 }],
    fees: [],
    total: 1750,
  });
});

test("нічна: коли план уже залишив 0 до сплати (абонемент 45 хв) — запису «night» у знижках немає", () => {
  const got = quote(makeRide("2026-05-01T05:30:00+03:00", "2026-05-01T06:15:00+03:00"), subscriber);
  assert.deepEqual(got, {
    minutes: 45,
    timeCharge: 5000,
    discounts: [{ code: "subscription", amount: 5000 }],
    fees: [],
    total: 0,
  });
});

// ---------- денний ліміт часового платежу (T6, day-cap.js) ----------

test("T6: без ledger теж діє DAY_CAP — 370 хв (13 блоків = 32500) обрізається до 30000", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T15:10:00Z"), standard);
  assert.deepEqual(got, {
    minutes: 370,
    timeCharge: 32500,
    discounts: [{ code: "day-cap", amount: 2500 }],
    fees: [],
    total: 30000,
  });
});

test("T6: межа ліміту, сценарій послідовних поїздок за однією відомою книжкою: 25000 → ще 5000 дозволено точно (не >=), потім 0", () => {
  const cap = createDayCap();
  const u1 = { type: "standard", id: "u1" };
  // поїздка 1: 300 хв = 10 блоків = 25000 — точно під лімітом, без знижок
  const first = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T14:00:00Z"), u1, { dayCap: cap });
  assert.deepEqual(first, { minutes: 300, timeCharge: 25000, discounts: [], fees: [], total: 25000 });
  // поїздка 2: 60 хв = 5000; залишок рівно 5000 → «5000 > 5000» хибне → знижки «day-cap» немає
  const second = quote(makeRide("2026-05-01T09:05:00Z", "2026-05-01T10:05:00Z"), u1, { dayCap: cap });
  assert.deepEqual(second, { minutes: 60, timeCharge: 5000, discounts: [], fees: [], total: 5000 });
  assert.equal(cap.chargedOn("u1", "2026-05-01"), 30000);
  // поїздка 3: 30 хв = 2500 при залишку 0 → знижка «day-cap» на всю суму, до сплати 0
  const third = quote(makeRide("2026-05-01T09:10:00Z", "2026-05-01T09:40:00Z"), u1, { dayCap: cap });
  assert.deepEqual(third, {
    minutes: 30,
    timeCharge: 2500,
    discounts: [{ code: "day-cap", amount: 2500 }],
    fees: [],
    total: 0,
  });
  assert.equal(cap.chargedOn("u1", "2026-05-01"), 30000); // запис 0 до книжки не додав
});

test("T6: ліміт стосується лише часового платежу — штраф out-of-zone не обрізається лімітом", () => {
  const cap = createDayCap();
  const u1 = { type: "standard", id: "u1" };
  quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T14:00:00Z"), u1, { dayCap: cap }); // записано 25000
  // 130 хв = 12500; залишок 5000 → day-cap 7500; штраф 15000 зверху → разом 20000
  const got = quote(makeRide("2026-05-01T09:05:00Z", "2026-05-01T11:15:00Z", "classic", "X01"), u1, {
    dayCap: cap,
  });
  assert.deepEqual(got, {
    minutes: 130,
    timeCharge: 12500,
    discounts: [{ code: "day-cap", amount: 7500 }],
    fees: [{ code: "out-of-zone", amount: 15000 }],
    total: 20000,
  });
});

// ---------- затримка повернення (unreturned, понад 24 год) ----------

test("затримка: рівно 1440 хв — штрафу ще немає (суворо >); ledger із більшим лімітом, щоб T6 не змішувався", () => {
  const cap = createDayCap({ limit: 1_000_000 });
  const u1 = { type: "standard", id: "u1" };
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-02T09:00:00Z"), u1, { dayCap: cap });
  assert.deepEqual(got, { minutes: 1440, timeCharge: 120000, discounts: [], fees: [], total: 120000 });
});

test("затримка: 1441 хв — штраф 200000 у fees, разом 322500", () => {
  const cap = createDayCap({ limit: 1_000_000 });
  const u1 = { type: "standard", id: "u1" };
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-02T09:01:00Z"), u1, { dayCap: cap });
  assert.deepEqual(got, {
    minutes: 1441,
    timeCharge: 122500,
    discounts: [],
    fees: [{ code: "unreturned", amount: 200000 }],
    total: 322500,
  });
});

// ---------- штраф за повернення поза зоною ----------

test("out-of-zone: повернення у X01 — штраф 15000 зверху часового платежу (2500 + 15000 = 17500)", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z", "classic", "X01"), standard);
  assert.deepEqual(got, {
    minutes: 30,
    timeCharge: 2500,
    discounts: [],
    fees: [{ code: "out-of-zone", amount: 15000 }],
    total: 17500,
  });
});

test("out-of-zone: для пільговика штраф теж половиниться — 7500", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z", "classic", "X01"), reduced);
  assert.deepEqual(got, {
    minutes: 30,
    timeCharge: 2500,
    discounts: [{ code: "reduced", amount: 1250 }],
    fees: [{ code: "out-of-zone", amount: 7500 }],
    total: 8750,
  });
});

// ---------- T9: округлення залишку донизу до копійки (правило названо в коментарі discount()) ----------

test("T9: discount(5001, 50) = 2501 → залишок 2500, а не 2500.5", () => {
  assert.equal(discount(5001, 50), 2501);
});

test("T9: discount(2501, 30) = 751 → залишок 1750, а не 1750.7", () => {
  assert.equal(discount(2501, 30), 751);
});

test("T9: рівно подільна сума — discount(10000, 30) = 3000", () => {
  assert.equal(discount(10000, 30), 3000);
});

// ---------- помилки валідації ----------

test("помилка: returnAt перед pickupAt — QuoteError", () => {
  assert.throws(() => quote(makeRide("2026-05-01T09:30:00Z", "2026-05-01T09:00:00Z"), standard), QuoteError);
});

test("помилка: рівні моменти (0 хв) НЕ помилка — поїздка по 0 коп", () => {
  const got = quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:00:00Z"), standard);
  assert.deepEqual(got, { minutes: 0, timeCharge: 0, discounts: [], fees: [], total: 0 });
});

test("помилка: невідомий тип велосипеда «trike»", () => {
  assert.throws(
    () => quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z", "trike"), standard),
    /unknown bike type: trike/,
  );
});

test("помилка: невідома станція повернення «S99»", () => {
  assert.throws(
    () => quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z", "classic", "S99"), standard),
    /unknown station: S99/,
  );
});

test("помилка: pickupAt не в ISO 8601 (без T/без офсету)", () => {
  assert.throws(
    () =>
      quote(
        { pickupAt: "2026-05-01 09:00", returnAt: "2026-05-01T10:00:00Z", bike: "classic", returnStation: "S01" },
        standard,
      ),
    /must be an ISO 8601 date-time with an offset/,
  );
});

test("помилка: схоже на ISO, але несправжня дата (2026-13-40T99:99Z)", () => {
  assert.throws(
    () =>
      quote(
        { pickupAt: "2026-13-40T99:99Z", returnAt: "2026-05-01T10:00:00Z", bike: "classic", returnStation: "S01" },
        standard,
      ),
    /is not a valid date-time/,
  );
});

test("помилка: невідомий тип клієнта «tourist»", () => {
  assert.throws(
    () => quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z"), { type: "tourist" }),
    /unknown rider type: tourist/,
  );
});

test("помилка: клієнта не передано взагалі", () => {
  assert.throws(() => quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z")), /unknown rider type/);
});

test("помилка: без rider.id за наявності щоденної книжки (dayCap)", () => {
  assert.throws(
    () =>
      quote(makeRide("2026-05-01T09:00:00Z", "2026-05-01T09:30:00Z"), { type: "standard" }, {
        dayCap: createDayCap(),
      }),
    /rider\.id is required with a daily cap ledger/,
  );
});

test("помилка: об'єкт поїздки не переданий", () => {
  assert.throws(() => quote(null, standard), /ride is required/);
});
