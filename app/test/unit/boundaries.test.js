import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP } from "../../src/day-cap.js";
import { quote, QuoteError } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({ pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra });
const standard = { id: "rider-1", type: "standard" };

test("a fresh ledger leaves the whole limit and has charged nothing", () => {
  const ledger = createDayCap();
  assert.equal(ledger.remaining("nobody", "2026-09-16T08:00:00Z"), DAY_CAP);
  assert.equal(ledger.chargedOn("nobody", "2026-09-16"), 0);
});

test("a night false start costs nothing and gets no night discount entry", () => {
  const q = quote(ride("2026-09-16T03:00:00+03:00", "2026-09-16T03:02:00+03:00"), standard);
  assert.equal(q.timeCharge, 0);
  assert.deepEqual(q.discounts, []);
  assert.equal(q.total, 0);
});

test("a night ride fully covered by a subscription gets no night discount entry", () => {
  const q = quote(ride("2026-09-16T03:00:00+03:00", "2026-09-16T03:40:00+03:00"), { id: "r", type: "subscriber" });
  assert.deepEqual(q.discounts.map((d) => d.code), ["subscription"]);
  assert.equal(q.total, 0);
});

test("a missing ride is a QuoteError, not a TypeError", () => {
  assert.throws(() => quote(null, standard), QuoteError);
  assert.throws(() => quote(undefined, standard), QuoteError);
});

test("a pickup/return that is not a string is rejected even if it prints like a date", () => {
  const asArray = ["2026-09-16T10:00:00Z"];
  assert.throws(() => quote(ride(asArray, "2026-09-16T10:30:00Z"), standard), QuoteError);
  assert.throws(() => quote(ride("2026-09-16T10:00:00Z", asArray), standard), QuoteError);
});

test("a string without an offset is rejected even if Date.parse accepts it", () => {
  assert.throws(() => quote(ride("2026-09-16T10:00", "2026-09-16T10:30:00Z"), standard), /ISO 8601/);
  assert.throws(() => quote(ride("2026-09-16", "2026-09-16T10:30:00Z"), standard), /ISO 8601/);
});
