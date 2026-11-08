// Межові тести quote(), написані під мутантів, що вижили в `npm run mutate` (Task C).
// Оракул очікувань — docs/spec/tariffs.md; кожен тест перевіряє не лише `total`,
// а й склад `discounts` — саме там мутації лишалися непоміченими.
//
// Мутанти, яких ці тести вбивають (ід з ai-runs/c-before.txt):
//   M030  tariff.js:71  60_000 → 60001  — крок округлення тривалості (T1)
//   M018  tariff.js:50  due > 0 → >=    — нічна знижка на нульовому нарахуванні (T10)
//   M023  tariff.js:57  due > allowance → >=   — рівно ліміт доби (T6)
//   M081  day-cap.js:23 ?? 0 → ?? 1     — залишок ліміту для першої поїздки доби (T6)
//   M024  tariff.js:58  due - allowance → +    — сума знижки «day-cap» у чеку (T6)
//   M065  tariff.js:120 || → &&         — відсутня поїздка (§4)
//   M076  tariff.js:136 || → &&         — момент не за ISO 8601 (§4)

import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({
  pickupAt,
  returnAt,
  bike: "classic",
  returnStation: "S01",
  ...extra,
});
const standard = { type: "standard" };
// Київський час: у вересні 2026 зсув +03:00.
const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;

// T1 (docs/spec/tariffs.md:46): неповна хвилина рахується як повна. Найтонша межа правила —
// перевищення на одну мілісекунду: 1 хв 1 мс — це вже 2 хвилини.
test("T1: 1 хв 1 мс → 2 хвилини (неповна хвилина як повна)", () => {
  const result = quote(ride(at("10:00:00.000"), at("10:01:00.001")), standard);
  assert.equal(result.minutes, 2, "тривалість у хвилинах");
  assert.equal(result.timeCharge, 0, "T2: до 2 хвилин включно погодинного немає");
});

// T2 + T10: якщо до сплати 0, нічна знижка не має з'являтися в чеку рядком на 0.
test("T2 + T10: нічна поїздка 2 хв → 0 до сплати і жодної знижки в чеку", () => {
  const result = quote(ride(at("01:00:00"), at("01:02:00")), standard);
  assert.equal(result.minutes, 2, "тривалість у хвилинах");
  assert.equal(result.timeCharge, 0, "нарахування за T3");
  assert.deepEqual(result.discounts, [], "знижок немає: знижувати нічого");
  assert.equal(result.total, 0, "до сплати");
});

// T6 (docs/spec/tariffs.md:101-102): ліміт — 300 грн на добу. Рівно ліміт ще не є
// перевищенням: 360 хв класичного = 12 блоків × 2500 = 30000. Очікування — число зі
// специфікації, а не константа `DAY_CAP` з модуля, який тестуємо (`app/AGENTS.md`, правило 3).
test("T6: погодинне рівно 30000 → ліміт не перевищено, рядка «day-cap» у чеку немає", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-cap-exact", type: "standard" };
  const pickupAt = at("09:00:00");

  const result = quote(ride(pickupAt, at("15:00:00")), rider, { dayCap });
  assert.equal(result.minutes, 360, "тривалість у хвилинах");
  assert.equal(result.timeCharge, 30000, "12 блоків × 2500 = рівно ліміт доби (300 грн за T6)");
  assert.deepEqual(result.discounts, [], "ліміт не перевищено — знижки немає");
  assert.equal(result.total, 30000, "до сплати");
  assert.equal(dayCap.remaining(rider.id, Date.parse(pickupAt)), 0, "ліміт доби вичерпано");
});

// T6: перевищення — знижка «day-cap» рівно на різницю. 390 хв = 13 блоків × 2500 = 32500.
test("T6: погодинне 32500 → знижка «day-cap» рівно на перевищення (2500)", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-cap-over", type: "standard" };

  const result = quote(ride(at("09:00:00"), at("15:30:00")), rider, { dayCap });
  assert.equal(result.minutes, 390, "тривалість у хвилинах");
  assert.equal(result.timeCharge, 32500, "нарахування за T3 до ліміту");
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2500 }], "знижка — рівно перевищення");
  assert.equal(result.total, 30000, "до сплати — ліміт доби (300 грн за T6)");
});

// §4 (docs/spec/tariffs.md:147-149): некоректні дані відхиляються «з поясненням». Дослівний
// текст пояснення специфікація не задає, тому перевіряємо клас помилки й те, що пояснення
// називає поле, через яке запит відхилено, — а не точне формулювання.
const rejects = (fn, field, label) =>
  assert.throws(
    fn,
    (err) =>
      err instanceof QuoteError &&
      typeof err.message === "string" &&
      new RegExp(field).test(err.message),
    `${label}: очікувався QuoteError з поясненням про «${field}»`,
  );

test("§4: поїздки немає або вона не об'єкт → відмова з поясненням саме про поїздку", () => {
  for (const bad of [null, undefined, "2026-09-16", 42, true]) {
    rejects(() => quote(bad, standard), "ride", `ride = ${JSON.stringify(bad) ?? "undefined"}`);
  }
});

test("§4: момент не за ISO 8601 або без зсуву → відмова з поясненням про момент", () => {
  const bad = ["2026-09-16T10:00", "2026-09-16 10:00:00Z", "2026-09-16", "16.09.2026 10:00", ""];
  for (const value of bad) {
    rejects(() => quote(ride(value, at("10:20:00")), standard), "pickupAt", `pickupAt = ${JSON.stringify(value)}`);
    rejects(() => quote(ride(at("10:00:00"), value), standard), "returnAt", `returnAt = ${JSON.stringify(value)}`);
  }
});

test("§4: QuoteError — саме той клас помилки, який експортує модуль", () => {
  assert.throws(() => quote(null, standard), QuoteError);
});
