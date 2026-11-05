import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError, quote } from "../../src/tariff.js";
import { HOUR, MINUTE, quoteOf, ride, standard } from "./helpers.js";

// T7 — out-of-zone fee
const t7 = [
  ["TC-38", "X01", 17500],
  ["TC-39", "X02", 17500],
  ["TC-39", "X03", 17500],
  ...["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((station) => ["TC-40", station, 2500]),
];
for (const [id, station, total] of t7) {
  test(`T7: ${id} classic 20 min returned to ${station} → ${total}`, () => {
    assert.equal(quoteOf(20 * MINUTE, { station }).total, total);
  });
}

test("T7: TC-41 station S09 (not in appendix A) is rejected with an explanation", () => {
  const r = ride(20 * MINUTE, { station: "S09" });
  assert.throws(() => quote(r, standard), (err) => err instanceof QuoteError && err.message.length > 0);
});

// T8 — unreturned bike fee, only for rides over 24 hours
const t8 = [
  ["TC-42", "exactly 24:00:00 → no fee", 24 * HOUR, "S01", 30000],
  ["TC-43", "24:00:01 → fee 200000", 24 * HOUR + 1, "S01", 230000],
  ["TC-44", "25 h → 30000 + 200000", 25 * HOUR, "S01", 230000],
  ["TC-45", "25 h returned to X03 → both fees", 25 * HOUR, "X03", 245000],
];
for (const [id, name, seconds, station, total] of t8) {
  test(`T8: ${id} classic ${name}`, () => {
    assert.equal(quoteOf(seconds, { station }).total, total);
  });
}
