import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError, quote } from "../../src/tariff.js";
import { HOUR, MINUTE, byCode, quoteOf, ride, standard } from "./helpers.js";

const OUT_OF_ZONE = { code: "out-of-zone", amount: 15000 }; // T7, docs/spec/tariffs.md:111-112
const UNRETURNED = { code: "unreturned", amount: 200000 }; // T8, docs/spec/tariffs.md:119-120

// T7 — a return to a point outside the service zone costs a 150 грн fee (docs/spec/tariffs.md:111-112;
// example :114-115). Zones — appendix A (:166-176): S01–S08 in the zone, X01–X03 outside.
// A classic 20-minute ride is 1 block = 2500 (:62-66).
const t7 = [
  ["TC-38", "X01", [OUT_OF_ZONE], 17500], // :114-115
  ["TC-39", "X02", [OUT_OF_ZONE], 17500], // :175
  ["TC-39", "X03", [OUT_OF_ZONE], 17500], // :176
  ...["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((station) => ["TC-40", station, [], 2500]), // :166-173
];
for (const [id, station, fees, total] of t7) {
  test(`T7: ${id} classic 20 min returned to ${station} → ${total}`, () => {
    const result = quoteOf(20 * MINUTE, { station });
    assert.deepEqual(result.fees, fees);
    assert.equal(result.total, total);
  });
}

// §4 (docs/spec/tariffs.md:148-149): a station that is not in appendix A is rejected.
test("T7: TC-41 station S09 (not in appendix A) is rejected with an explanation", () => {
  const r = ride(20 * MINUTE, { station: "S09" });
  assert.throws(() => quote(r, standard), (err) => err instanceof QuoteError && err.message.length > 0);
});

// T8 — a ride over 24 hours costs a 2000 грн fee on top of the capped time charge; T7 and T8 apply independently
// (docs/spec/tariffs.md:119-122; example :124-125). Time charge is capped at 30000 (T6, :100-101).
const t8 = [
  ["TC-42", "exactly 24:00:00 → no fee", 24 * HOUR, "S01", [], 30000], // :119 «понад 24 години»
  ["TC-43", "24:00:01 → fee 200000", 24 * HOUR + 1, "S01", [UNRETURNED], 230000], // :119, T1 :46-47
  ["TC-44", "25 h → 30000 + 200000", 25 * HOUR, "S01", [UNRETURNED], 230000], // :124-125
  ["TC-45", "25 h returned to X03 → both fees", 25 * HOUR, "X03", [OUT_OF_ZONE, UNRETURNED], 245000], // :121-122
];
for (const [id, name, seconds, station, fees, total] of t8) {
  test(`T8: ${id} classic ${name}`, () => {
    const result = quoteOf(seconds, { station });
    assert.deepEqual(byCode(result.fees), byCode(fees));
    assert.equal(result.total, total);
  });
}
