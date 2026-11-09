import test from "node:test";
import assert from "node:assert/strict";
import { quote, QuoteError, RATES, BLOCK_MINUTES, discount } from "../../app/src/tariff.js";
import { createDayCap, DAY_CAP, dayKey } from "../../app/src/day-cap.js";
import { formatUah } from "../../app/src/receipt.js";

const ride = (pickupAt, returnAt, extra = {}) => ({
  pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra,
});
const standard = { type: "standard" };

test("duration: 30 min 20 sec rounds to 30 min", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  assert.equal(r.minutes, 30);
});

test("false start: 1 min ride is free", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:01:00Z"), standard);
  assert.equal(r.total, 0);
});

test("false start: 2 min ride is charged", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:02:00Z"), standard);
  assert.equal(r.total, 2500);
});

test("classic 50 min → 2 blocks = 5000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:50:00Z"), standard);
  assert.equal(r.timeCharge, 5000);
});

test("ebike 75 min → 3 blocks = 12000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), standard);
  assert.equal(r.timeCharge, 12000);
});

test("subscriber classic 40 min → free", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z"), { type: "subscriber" });
  assert.equal(r.total, 0);
});

test("subscriber ebike 40 min → free (45 min free)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike: "ebike" }), { type: "subscriber" });
  assert.equal(r.total, 0);
});

test("subscriber classic 100 min → 55 paid → 2 blocks = 5000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z"), { type: "subscriber" });
  assert.equal(r.total, 5000);
});

test("reduced classic 40 min → 50% off = 2500", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z"), { type: "reduced" });
  assert.equal(r.total, 2500);
});

test("reduced with out-of-zone → fee also discounted", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), { type: "reduced" });
  assert.equal(r.fees[0].amount, 7500);
  assert.equal(r.total, 10000);
});

test("night ride 01:10-01:40 Kyiv → 30% off", () => {
  const r = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:40:00Z"), standard);
  assert.equal(r.total, 1750);
});

test("out-of-zone fee = 15000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:20:00Z", { returnStation: "X02" }), standard);
  assert.equal(r.fees[0].amount, 15000);
});

test("unreturned fee after 24 hours", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-17T08:00:00Z"), standard);
  assert.ok(r.fees.some(f => f.code === "unreturned"));
});

test("both fees: out-of-zone + unreturned", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.equal(r.fees.length, 2);
});

test("daily cap limits charges", () => {
  const dayCap = createDayCap();
  const rider = { id: "r1", type: "standard" };
  for (const [f, t] of [["07:00","08:20"],["11:00","12:20"],["16:00","17:20"]]) {
    quote(ride(`2026-09-16T${f}:00Z`, `2026-09-16T${t}:00Z`, { bike: "ebike" }), rider, { dayCap });
  }
  assert.ok(dayCap.chargedOn("r1", "2026-09-16") <= DAY_CAP);
});

test("dayKey uses UTC date", () => {
  assert.equal(dayKey("2026-09-16T23:30:00Z"), "2026-09-16");
});

test("return before pickup throws", () => {
  assert.throws(() => quote(ride("2026-09-16T08:00:00Z", "2026-09-16T07:00:00Z"), standard), QuoteError);
});

test("unknown bike throws", () => {
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z", { bike: "scooter" }), standard), QuoteError);
});

test("unknown station throws", () => {
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z", { returnStation: "Z99" }), standard), QuoteError);
});

test("discount rounds down", () => {
  assert.equal(1235 - discount(1235, 30), 864);
});

test("formatUah formats correctly", () => {
  assert.equal(formatUah(230000), "2 300,00 грн");
});
