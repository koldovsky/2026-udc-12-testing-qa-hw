// Behaviour snapshot, not verified against the spec (docs/spec/tariffs.md was not available; values hand-derived from src/tariff.js comments and the repo rules).
import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, discount, QuoteError } from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";

const DAY = "2026-09-16T12:00:00+03:00"; // Kyiv noon, no night discount
const addMin = (iso, m) => new Date(Date.parse(iso) + m * 60_000).toISOString();
const ride = (minutes, bike = "classic", { pickupAt = DAY, returnStation = "S01" } = {}) => ({
  pickupAt,
  returnAt: addMin(pickupAt, minutes),
  bike,
  returnStation,
});
const std = { type: "standard" };

// minutes, bike, expected timeCharge (kopecks)
const timeCharges = [
  [0, "classic", 0],
  [1, "classic", 0],
  [2, "classic", 2500],
  [3, "classic", 2500],
  [30, "classic", 2500],
  [31, "classic", 5000],
  [60, "classic", 5000],
  [61, "classic", 7500],
  [30, "ebike", 4000],
  [31, "ebike", 8000],
];
for (const [minutes, bike, expected] of timeCharges) {
  test(`time charge: ${minutes} min ${bike} = ${expected}`, () => {
    const q = quote(ride(minutes, bike), std);
    assert.equal(q.minutes, minutes);
    assert.equal(q.timeCharge, expected);
    assert.equal(q.total, expected);
    assert.deepEqual(q.discounts, []);
    assert.deepEqual(q.fees, []);
  });
}

// rider, minutes, bike, expected discounts, expected total
const plans = [
  [{ type: "subscriber" }, 45, "classic", [{ code: "subscription", amount: 5000 }], 0],
  [{ type: "subscriber" }, 46, "classic", [{ code: "subscription", amount: 2500 }], 2500],
  [{ type: "subscriber" }, 46, "ebike", [{ code: "subscription", amount: 4800 }], 3200], // 8000 - (4000 - 800)
  [{ type: "reduced" }, 31, "classic", [{ code: "reduced", amount: 2500 }], 2500],
  [{ type: "reduced" }, 1, "classic", [], 0],
  [{ type: "subscriber", concession: true }, 31, "classic", [{ code: "subscription", amount: 5000 }], 0],
  [{ type: "subscriber", concession: true }, 46, "classic", [{ code: "subscription", amount: 2500 }], 2500], // tie keeps subscription
  [{ type: "subscriber", concession: true }, 200, "classic", [{ code: "reduced", amount: 8750 }], 8750], // 17500: reduced beats 15000 sub charge
  [{ type: "subscriber", concession: false }, 200, "classic", [{ code: "subscription", amount: 2500 }], 15000],
];
for (const [rider, minutes, bike, discounts, total] of plans) {
  test(`plan: ${JSON.stringify(rider)} ${minutes} min ${bike}`, () => {
    const q = quote(ride(minutes, bike), rider);
    assert.deepEqual(q.discounts, discounts);
    assert.equal(q.total, total);
  });
}

// pickup instant, expected discounts, expected total (classic, 30 min = 2500)
const nights = [
  ["2026-09-16T00:00:00+03:00", [{ code: "night", amount: 750 }], 1750],
  ["2026-09-16T01:10:00+03:00", [{ code: "night", amount: 750 }], 1750],
  ["2026-09-16T05:59:00+03:00", [{ code: "night", amount: 750 }], 1750],
  ["2026-09-16T06:00:00+03:00", [], 2500],
  ["2026-09-15T21:00:00Z", [{ code: "night", amount: 750 }], 1750], // 00:00 Kyiv
  ["2026-09-15T20:59:00Z", [], 2500], // 23:59 Kyiv
];
for (const [pickupAt, discounts, total] of nights) {
  test(`night: pickup ${pickupAt}`, () => {
    const q = quote(ride(30, "classic", { pickupAt }), std);
    assert.deepEqual(q.discounts, discounts);
    assert.equal(q.total, total);
  });
}

test("night discount comes after the reduced fare", () => {
  const q = quote(ride(31, "classic", { pickupAt: "2026-09-16T02:00:00+03:00" }), { type: "reduced" });
  // 5000 - 2500 reduced = 2500; night 30% of 2500 = 750
  assert.deepEqual(q.discounts, [
    { code: "reduced", amount: 2500 },
    { code: "night", amount: 750 },
  ]);
  assert.equal(q.total, 1750);
});

test("no night discount on a free ride", () => {
  const q = quote(ride(1, "classic", { pickupAt: "2026-09-16T02:00:00+03:00" }), std);
  assert.deepEqual(q.discounts, []);
  assert.equal(q.total, 0);
});

test("out-of-zone fee", () => {
  const q = quote(ride(30, "classic", { returnStation: "X01" }), std);
  assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
  assert.equal(q.total, 17500);
});

test("reduced fare halves the out-of-zone fee", () => {
  const q = quote(ride(31, "classic", { returnStation: "X01" }), { type: "reduced" });
  assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 7500 }]);
  assert.equal(q.total, 10000);
});

test("subscriber without concession pays the full out-of-zone fee", () => {
  const q = quote(ride(30, "classic", { returnStation: "X01" }), { type: "subscriber" });
  assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
  assert.equal(q.total, 15000);
});

// minutes, expected fees, expected total (classic, in zone)
const unreturned = [
  [1440, [], 30000], // 48 blocks = 120000, capped at 30000
  [1441, [{ code: "unreturned", amount: 200000 }], 230000],
];
for (const [minutes, fees, total] of unreturned) {
  test(`unreturned fee: ${minutes} min`, () => {
    const q = quote(ride(minutes), std);
    assert.deepEqual(q.fees, fees);
    assert.equal(q.total, total);
  });
}

test("daily cap without a ledger caps at 30000", () => {
  const q = quote(ride(1440), std);
  assert.equal(q.timeCharge, 120000);
  assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 90000 }]);
});

test("daily cap with a ledger accumulates across rides of one day", () => {
  const dayCap = createDayCap();
  const rider = { type: "standard", id: "r1" };
  const first = quote(ride(200, "ebike"), rider, { dayCap }); // 7 blocks * 4000
  assert.equal(first.total, 28000);
  const second = quote(ride(31, "ebike", { pickupAt: "2026-09-16T15:00:00+03:00" }), rider, { dayCap });
  assert.deepEqual(second.discounts, [{ code: "day-cap", amount: 6000 }]);
  assert.equal(second.total, 2000);
  assert.equal(dayCap.chargedOn("r1", "2026-09-16"), 30000);
});

test("T6: daily cap resets at Kyiv midnight (21:00Z), not UTC midnight", () => {
  const dayCap = createDayCap();
  const rider = { type: "standard", id: "r1" };
  quote(ride(1440, "classic", { pickupAt: "2026-09-16T23:30:00+03:00" }), rider, { dayCap }); // 20:30Z, fills the cap
  const next = quote(ride(31, "classic", { pickupAt: "2026-09-17T00:30:00+03:00" }), rider, { dayCap }); // 21:30Z, new Kyiv day
  // 5000 - night 30% (1500) = 3500, no cap
  assert.deepEqual(next.discounts, [{ code: "night", amount: 1500 }]);
  assert.equal(next.total, 3500);
});

test("T9: discount rounds what is left to pay down to the kopeck", () => {
  assert.equal(discount(2500, 30), 750);
  assert.equal(discount(1, 50), 1); // left to pay floor(0.5) = 0
  assert.equal(discount(3, 50), 2); // left to pay floor(1.5) = 1
  assert.equal(discount(0, 50), 0);
});

const bad = [
  ["no ride", () => quote(undefined, std)],
  ["bad pickupAt", () => quote({ ...ride(5), pickupAt: "2026-09-16 12:00" }, std)],
  ["no offset", () => quote({ ...ride(5), pickupAt: "2026-09-16T12:00:00" }, std)],
  ["return before pickup", () => quote({ ...ride(5), returnAt: addMin(DAY, -1) }, std)],
  ["unknown bike", () => quote(ride(5, "scooter"), std)],
  ["unknown station", () => quote(ride(5, "classic", { returnStation: "Z99" }), std)],
  ["unknown rider type", () => quote(ride(5), { type: "vip" })],
  ["missing rider", () => quote(ride(5), undefined)],
  ["dayCap without rider id", () => quote(ride(5), std, { dayCap: createDayCap() })],
];
for (const [name, fn] of bad) {
  test(`rejects: ${name}`, () => {
    assert.throws(fn, QuoteError);
  });
}
