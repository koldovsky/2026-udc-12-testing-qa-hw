// Unit tests for app/src/tariff.js.
// The spec (docs/spec/tariffs.md) was not available for this task, so per AGENTS.md rule 2
// no expected amounts are invented: the only executable checks are the §4 invalid-input
// cases that AGENTS.md rule 10 itself lists as "each expects QuoteError".
// Every case whose expected value needs the spec is a test.todo("Q: …").
import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, QuoteError } from "../../app/src/tariff.js";

// Stub station lookup so a valid return station does not depend on zones.js contents.
const anyZone = { zoneOf: () => "in" };
const validRide = Object.freeze({
  pickupAt: "2026-09-16T10:00:00+03:00",
  returnAt: "2026-09-16T10:20:00+03:00",
  bike: "classic",
  returnStation: "S-ANY",
});
const standard = Object.freeze({ type: "standard" });

// §4 — AGENTS.md rule 10: each invalid-input case expects exactly QuoteError.
test("§4: return before pickup → QuoteError", () => {
  const ride = { ...validRide, returnAt: "2026-09-16T09:59:00+03:00" };
  assert.throws(() => quote(ride, standard, { zones: anyZone }), QuoteError);
});

test("§4: unknown bike type → QuoteError", () => {
  const ride = { ...validRide, bike: "tandem" };
  assert.throws(() => quote(ride, standard, { zones: anyZone }), QuoteError);
});

test("§4: unknown rider category → QuoteError", () => {
  assert.throws(() => quote(validRide, { type: "vip" }, { zones: anyZone }), QuoteError);
});

test("§4: unknown return station → QuoteError", () => {
  const ride = { ...validRide, returnStation: "NO-SUCH-STATION-0000" };
  assert.throws(() => quote(ride, standard), QuoteError);
});

test("§4: null instead of a ride → QuoteError", () => {
  assert.throws(() => quote(null, standard, { zones: anyZone }), QuoteError);
});

test("§4: pickupAt without Z or offset → QuoteError", () => {
  const ride = { ...validRide, pickupAt: "2026-09-16T10:00:00" };
  assert.throws(() => quote(ride, standard, { zones: anyZone }), QuoteError);
});

test("§4: returnAt without Z or offset → QuoteError", () => {
  const ride = { ...validRide, returnAt: "2026-09-16T10:20:00" };
  assert.throws(() => quote(ride, standard, { zones: anyZone }), QuoteError);
});

// Cases that need the spec for an expected value.
test.todo("Q: T1/T3 — what is the price of one 30-minute block for a classic bike and for an e-bike?");
test.todo("Q: T1/T3 — how are seconds rounded to minutes: is 30:29 one block and 30:30 two blocks?");
test.todo("Q: T1/T3 — is a 30:00 ride exactly one block and 30:01 two blocks?");
test.todo("Q: T2 — is a ride of 2:00 still free, and is 2:01 charged in full from the first minute?");
test.todo("Q: T4 — for a subscriber, are the first 45 minutes free and minute 46 charged; how is the remainder blocked?");
test.todo("Q: T4 — what e-bike discount does a subscriber get, and is it applied before or after free minutes?");
test.todo("Q: T5 — reduced fare: what percent, and does it apply to fees (out-of-zone, unreturned) as well?");
test.todo("Q: T5/T4 — a subscriber with concession: one plan (the cheaper) or both discounts combined?");
test.todo("Q: T6 — what is the daily cap (300 UAH?) and do fees count towards it?");
test.todo("Q: T6 — 299 / 300 / 301 UAH charged in a day: exact amounts after the cap?");
test.todo("Q: T7 — out-of-zone return fee amount, and which stations are out of zone?");
test.todo("Q: T8 — unreturned fee: amount, and is 24:00:00 not yet unreturned while 24:00:01 is?");
test.todo("Q: T8 — is the time charge still billed for a ride over 24 h in addition to the fee?");
test.todo("Q: T9 — percent discounts: round the amount to pay down, up or to nearest kopeck?");
test.todo("Q: T10 — night discount: what percent, is 05:59 Kyiv night and 06:00 not; is it by pickup or return time?");
test.todo("Q: T10 — order of discounts: night after subscription/reduced, before the day cap?");
