// Автоматизація тест-кейсів TC-50…TC-53 з docs/test-cases.md (розділ §4 «Некоректні дані»).
// Оракул очікувань — docs/test-cases.md і docs/spec/tariffs.md:147-149.

import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError, quote } from "../../src/tariff.js";

const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;

const cases = [
  {
    tc: "TC-50",
    name: "повернення раніше за взяття (10:00:00 → 09:00:00) → запит відхилено з поясненням",
    ride: { pickupAt: at("10:00:00"), returnAt: at("09:00:00"), bike: "classic", returnStation: "S01" },
    rider: { type: "standard" },
  },
  {
    tc: "TC-51",
    name: "невідомий тип велосипеда (cargo) → запит відхилено з поясненням",
    ride: { pickupAt: at("10:00:00"), returnAt: at("10:20:00"), bike: "cargo", returnStation: "S01" },
    rider: { type: "standard" },
  },
  {
    tc: "TC-52",
    name: "невідома категорія користувача (vip) → запит відхилено з поясненням",
    ride: { pickupAt: at("10:00:00"), returnAt: at("10:20:00"), bike: "classic", returnStation: "S01" },
    rider: { type: "vip" },
  },
  {
    tc: "TC-53",
    name: "станції повернення S09 немає в додатку А → запит відхилено з поясненням",
    ride: { pickupAt: at("10:00:00"), returnAt: at("10:20:00"), bike: "classic", returnStation: "S09" },
    rider: { type: "standard" },
  },
];

for (const c of cases) {
  test(`§4 (${c.tc}): ${c.name}`, () => {
    assert.throws(
      () => quote(c.ride, c.rider),
      (error) => {
        assert.ok(error instanceof QuoteError, `розрахунок не виконується: ${error}`);
        assert.ok(
          typeof error.message === "string" && error.message.length > 0,
          "запит відхиляється з поясненням",
        );
        return true;
      },
    );
  });
}
