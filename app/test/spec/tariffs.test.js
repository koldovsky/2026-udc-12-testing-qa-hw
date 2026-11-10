import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";
import { formatReceipt } from "../../src/receipt.js";

const ride = (pickupAt, returnAt, extra = {}) => ({
  pickupAt,
  returnAt,
  bike: "classic",
  returnStation: "S01",
  ...extra,
});
const standard = { type: "standard" };
const total = (result) => result.total;

const basicCases = [
  ["TC-01", "T1", "2026-09-16T10:00:00Z", "2026-09-16T10:12:40Z", "classic", standard, "S01", 13, 2500],
  ["TC-02", "T1", "2026-09-16T10:00:00Z", "2026-09-16T10:01:01Z", "classic", standard, "S01", 2, 0],
  ["TC-03", "T2", "2026-09-16T10:00:00Z", "2026-09-16T10:02:00Z", "classic", standard, "S01", 2, 0],
  ["TC-04", "T2/T3", "2026-09-16T10:00:00Z", "2026-09-16T10:04:00Z", "classic", standard, "S01", 4, 2500],
  ["TC-05", "T3", "2026-09-16T10:00:00Z", "2026-09-16T10:50:00Z", "classic", standard, "S01", 50, 5000],
  ["TC-06", "T3", "2026-09-16T10:00:00Z", "2026-09-16T11:15:00Z", "ebike", standard, "S01", 75, 12000],
];

for (const [id, rule, pickupAt, returnAt, bike, rider, station, minutes, expected] of basicCases) {
  test(`${rule}: ${id} — базове погодинне нарахування`, () => {
    const result = quote(ride(pickupAt, returnAt, { bike, returnStation: station }), rider);
    assert.equal(result.minutes, minutes);
    assert.equal(result.total, expected);
    assert.equal(result.timeCharge, expected);
  });
}

const riderCases = [
  ["TC-07", "T4", "classic", "2026-09-16T10:40:00Z", { type: "subscriber" }, 5000, 0],
  ["TC-08", "T4", "classic", "2026-09-16T11:40:00Z", { type: "subscriber" }, 10000, 5000],
  ["TC-09", "T4", "ebike", "2026-09-16T11:15:00Z", { type: "subscriber" }, 12000, 9600],
  ["TC-10", "T5", "classic", "2026-09-16T10:40:00Z", { type: "reduced" }, 5000, 2500],
  ["TC-11", "T5", "classic", "2026-09-16T11:20:00Z", { type: "subscriber", concession: true }, 7500, 3750],
  ["TC-12", "T5", "classic", "2026-09-16T11:00:00Z", { type: "subscriber", concession: true }, 5000, 2500],
];

for (const [id, rule, bike, returnAt, rider, charge, expected] of riderCases) {
  test(`${rule}: ${id} — вибір тарифу та знижки`, () => {
    const result = quote(ride("2026-09-16T10:00:00Z", returnAt, { bike }), rider);
    assert.equal(result.timeCharge, charge);
    assert.equal(total(result), expected);
  });
}

test("T6: TC-13 — денний ліміт застосовується до третьої поїздки", () => {
  const dayCap = createDayCap();
  const rider = { id: "u1", type: "standard" };
  const rides = [
    ["06:00", "07:20"], ["10:00", "11:20"], ["15:00", "16:20"],
  ];
  const results = rides.map(([from, to]) => quote(ride(`2026-09-16T${from}:00+03:00`, `2026-09-16T${to}:00+03:00`, { bike: "ebike" }), rider, { dayCap }));
  assert.deepEqual(results.map(total), [12000, 12000, 6000]);
  assert.equal(dayCap.chargedOn("u1", "2026-09-16"), 30000);
});

test("T6/T10: TC-14 — нічна знижка і доба за моментом взяття", () => {
  const result = quote(ride("2026-09-16T23:40:00Z", "2026-09-17T00:20:00Z", { bike: "ebike" }), { id: "u1", type: "standard" }, { dayCap: createDayCap() });
  assert.equal(result.minutes, 40);
  assert.deepEqual(result.discounts, [{ code: "night", amount: 2400 }]);
  assert.equal(result.total, 5600);
});

const feeCases = [
  ["TC-15", "T7", "2026-09-16T10:20:00Z", "X01", 2500, [{ code: "out-of-zone", amount: 15000 }], 17500],
  ["TC-16", "T2/T7", "2026-09-16T10:00:50Z", "X01", 0, [{ code: "out-of-zone", amount: 15000 }], 15000],
  ["TC-17", "T8", "2026-09-17T11:00:01Z", "S01", 127500, [{ code: "unreturned", amount: 200000 }], 230000],
  ["TC-18", "T7/T8", "2026-09-17T11:00:01Z", "X01", 127500, [{ code: "out-of-zone", amount: 15000 }, { code: "unreturned", amount: 200000 }], 245000],
];

for (const [id, rule, returnAt, station, charge, fees, expected] of feeCases) {
  test(`${rule}: ${id} — збори не входять до погодинного ліміту`, () => {
    const rider = id === "TC-17" || id === "TC-18" ? { id: `rider-${id}`, type: "standard" } : standard;
    const options = id === "TC-17" || id === "TC-18" ? { dayCap: createDayCap() } : undefined;
    const result = quote(ride("2026-09-16T10:00:00Z", returnAt, { returnStation: station }), rider, options);
    assert.equal(result.timeCharge, charge);
    assert.deepEqual(result.fees, fees);
    assert.equal(total(result), expected);
  });
}

test("T9/T10: TC-19/TC-20 — суми знижки є цілими копійками", () => {
  const result = quote(ride("2026-09-16T01:10:00Z", "2026-09-16T01:40:00Z"), standard);
  assert.equal(result.timeCharge, 2500);
  assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
  assert.equal(result.total, 1750);
});

test("T9: TC-21 — чек містить погодинне нарахування, ліміт, збори та підсумок", () => {
  const result = quote(ride("2026-09-16T10:00:00Z", "2026-09-17T11:00:01Z", { returnStation: "X01" }), standard);
  assert.equal(result.minutes, 1501);
  assert.equal(result.timeCharge, 127500);
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 97500 }]);
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }, { code: "unreturned", amount: 200000 }]);
  assert.equal(result.total, 245000);
  assert.deepEqual(formatReceipt(result), [
    "Тривалість поїздки: 1501 хв",
    "Погодинне нарахування ........... 1 275,00 грн",
    "Денний ліміт ..................... -975,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "Збір: неповернений велосипед .... 2 000,00 грн",
    "До сплати ....................... 2 450,00 грн",
  ]);
});
