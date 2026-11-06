// §4 — invalid input: request rejected with explanation (QuoteError)
// Expected values: docs/test-cases.md, docs/spec/tariffs.md:147-149
import test from "node:test";
import assert from "node:assert/strict";
import { quote, QuoteError } from "../../src/tariff.js";

const DAY_RIDE = { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:30:00+03:00" };

// §4 — TC-81: return before pickup → rejected (spec:tariffs.md:147)
test("§4: TC-81 — return before pickup is rejected with QuoteError", () => {
  assert.throws(
    () => quote(
      { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T09:59:59+03:00", bike: "classic", returnStation: "S01" },
      { type: "standard" },
    ),
    QuoteError,
    "TC-81",
  );
});

// §4 — TC-82, TC-83: unknown bike type or unknown rider category → rejected (spec:tariffs.md:148)
test("§4: TC-82 TC-83 — unknown bike type or rider category → QuoteError", () => {
  for (const { id, ride, rider } of [
    {
      id:   "TC-82",
      ride: { ...DAY_RIDE, bike: "cargo", returnStation: "S01" },
      rider: { type: "standard" },
    },
    {
      id:   "TC-83",
      ride: { ...DAY_RIDE, bike: "classic", returnStation: "S01" },
      rider: { type: "vip" },
    },
  ]) {
    assert.throws(() => quote(ride, rider), QuoteError, id);
  }
});

// §4 — null ride object. §4 lists four cases (docs/spec/tariffs.md:147-149); a missing ride is
// not among them.
// ПРИПУЩЕННЯ: без моментів взяття й повернення T1 (tariffs.md:45) не обчислити, тож запит
// відхиляється як некоректні дані §4 — з контракту API (app/src/tariff.js:4-5), не зі специфікації;
// ПИТАННЯ: Q-11 (docs/test-cases.md) — чи перелік §4 вичерпний.
// Kills M067 (|| → && in !ride || typeof ride !== "object"): with &&, the guard is skipped for
// null (typeof null === "object", so the second operand is false); instant(ride.pickupAt) then
// reads null.pickupAt and throws TypeError, not QuoteError, so assert.throws(…, QuoteError) fails.
test("ASSUMPTION: §4: null ride → QuoteError", () => {
  assert.throws(
    () => quote(null, { type: "standard" }),
    QuoteError,
    "null ride must throw QuoteError",
  );
});

// §4 — date-only string (no time part). §4 (docs/spec/tariffs.md:147-149) does not list it.
// ПРИПУЩЕННЯ: «Взяття — момент» (tariffs.md:26), дата без часу — не момент, тож запит
// відхиляється як некоректні дані §4 — з контракту API (ISO 8601 зі зсувом, AGENTS.md), не зі
// специфікації; ПИТАННЯ: Q-11 (docs/test-cases.md) — чи перелік §4 вичерпний.
// Kills M078 (|| → && in invalid date string check): with &&, the guard is skipped for any
// string (typeof value !== "string" is false, false && … = false); Date.parse("2026-09-16") is a
// valid instant, so quote() returns a price instead of throwing and assert.throws fails.
test("ASSUMPTION: §4: date-only pickupAt (no time offset) → QuoteError", () => {
  assert.throws(
    () => quote(
      { pickupAt: "2026-09-16", returnAt: "2026-09-16T10:30:00Z", bike: "classic", returnStation: "S01" },
      { type: "standard" },
    ),
    QuoteError,
    "date-only string must throw QuoteError",
  );
});

// §4 — TC-84 to TC-86: station not in appendix A → rejected (spec:tariffs.md:149)
test("§4: TC-84 to TC-86 — station absent from appendix A → QuoteError", () => {
  for (const { id, station } of [
    { id: "TC-84", station: "S09" }, // neighbour of S08, not listed
    { id: "TC-85", station: "X04" }, // neighbour of X03, not listed
    { id: "TC-86", station: ""    }, // empty string
  ]) {
    assert.throws(
      () => quote(
        { ...DAY_RIDE, bike: "classic", returnStation: station },
        { type: "standard" },
      ),
      QuoteError,
      id,
    );
  }
});
