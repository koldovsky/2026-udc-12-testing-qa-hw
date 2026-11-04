// docs/test-cases.md TC-60…TC-63: invalid data is rejected with an explanation (§4).
import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError, quote } from "../../src/tariff.js";
import { at } from "../helpers/spec-ride.js";

const valid = { pickupAt: at("10:00"), returnAt: at("10:20"), bike: "classic", returnStation: "S01" };
const standard = { type: "standard", id: "rider-1" };

const CASES = [
  { id: "TC-60", what: "повернення 10:00 при взятті 10:30", ride: { pickupAt: at("10:30"), returnAt: at("10:00") } },
  { id: "TC-61", what: "тип велосипеда tandem", ride: { bike: "tandem" } },
  { id: "TC-62", what: "категорія користувача vip", rider: { type: "vip" } },
  { id: "TC-63", what: "станція повернення S99", ride: { returnStation: "S99" } },
];

for (const c of CASES) {
  test(`§4: ${c.id} ${c.what} → запит відхилено з поясненням`, () => {
    assert.throws(
      () => quote({ ...valid, ...c.ride }, { ...standard, ...c.rider }),
      (error) => error instanceof QuoteError && error.message.trim().length > 0,
    );
  });
}
