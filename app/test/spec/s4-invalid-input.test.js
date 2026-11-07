// docs/test-cases.md TC-59…TC-62 — §4 (invalid input): the request is rejected with an explanation.
// Expectations: docs/test-cases.md, docs/spec/tariffs.md:145-149 (+ додаток А :164-176).

import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError, quote } from "../../src/tariff.js";
import { ride, rider } from "../helpers/spec.js";

const CASES = [
  {
    id: "TC-59",
    desc: "повернення 09:59:59 при взятті 10:00:00",
    ride: ride({ from: "10:00:00", to: "09:59:59" }),
    rider: rider(),
  },
  { id: "TC-60", desc: "тип велосипеда «тандем»", ride: ride({ minutes: 20, bike: "tandem" }), rider: rider() },
  { id: "TC-61", desc: "категорія користувача «VIP»", ride: ride({ minutes: 20 }), rider: { id: "U1", type: "VIP" } },
  { id: "TC-62", desc: "станція повернення S09", ride: ride({ minutes: 20, station: "S09" }), rider: rider() },
];

for (const c of CASES) {
  test(`§4: ${c.id} — ${c.desc} → запит відхилено з поясненням`, () => {
    assert.throws(
      () => quote(c.ride, c.rider),
      (err) => err instanceof QuoteError && typeof err.message === "string" && err.message.trim().length > 0,
    );
  });
}
