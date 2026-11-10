// Spec-based tests for quote(): rules T1–T10 and section 4 of docs/spec/tariffs.md.
// Expected values: docs/test-cases.md and docs/spec/tariffs.md only.
// Not automated: the "Питання до специфікації" cases (Q-1…Q-7).

import { test } from "node:test";
import assert from "node:assert/strict";

import { quote, QuoteError, discount } from "../../src/tariff.js";
import { createDayCap } from "../../src/day-cap.js";
import { DAY, NEXT_DAY, ride, rider } from "./support.js";

const EBIKE = { bike: "ebike" };

/** Each row: one test case. `expect` keys are checked only when present. */
function runTable(rule, rows) {
  for (const row of rows) {
    test(`${rule}: ${row.id} ${row.name}`, () => {
      const result = quote(row.ride, row.rider ?? rider());
      const { expect } = row;
      if ("minutes" in expect) assert.equal(result.minutes, expect.minutes, "minutes");
      if ("timeCharge" in expect) assert.equal(result.timeCharge, expect.timeCharge, "timeCharge");
      if ("fees" in expect) assert.deepEqual(result.fees.map((f) => f.amount), expect.fees, "fees");
      // TC-06 checks only minutes and timeCharge (the night part depends on Q-1): compare total only when the case states it.
      if ("total" in expect) assert.equal(result.total, expect.total, "total");
    });
  }
}

// ---------------------------------------------------------------- T1
runTable("T1", [
  { id: "TC-01", name: "10:00:00–10:12:40 → 13 хв, 1 блок", ride: ride("10:00:00", "10:12:40"), expect: { minutes: 13, timeCharge: 2500, total: 2500 } },
  { id: "TC-02", name: "14:05–14:41 → 36 хв, 2 блоки", ride: ride("14:05:00", "14:41:00"), expect: { minutes: 36, timeCharge: 5000, total: 5000 } },
  { id: "TC-03", name: "29:59 → 30 хв, 1 блок", ride: ride("10:00:00", "10:29:59"), expect: { minutes: 30, timeCharge: 2500, total: 2500 } },
  { id: "TC-04", name: "рівно 30:00 → 30 хв, 1 блок", ride: ride("10:00:00", "10:30:00"), expect: { minutes: 30, timeCharge: 2500, total: 2500 } },
  { id: "TC-05", name: "30:01 → 31 хв, 2 блоки", ride: ride("10:00:00", "10:30:01"), expect: { minutes: 31, timeCharge: 5000, total: 5000 } },
  {
    id: "TC-06",
    name: "ніч переведення годинника: фактично 180 хв, 6 блоків (лише minutes і timeCharge)",
    ride: ride("2026-10-25T02:30:00+03:00", "2026-10-25T04:30:00+02:00"),
    expect: { minutes: 180, timeCharge: 15000 },
  },
  {
    id: "TC-58",
    name: "повернення «раніше» за годинником, але фактично пізніше: не відхиляється, 40 хв, −30 % → 3500",
    ride: ride("2026-10-25T03:30:00+03:00", "2026-10-25T03:10:00+02:00"),
    expect: { minutes: 40, timeCharge: 5000, total: 3500 },
  },
]);

// ---------------------------------------------------------------- T2
runTable("T2", [
  { id: "TC-07", name: "50 с → 1 хв, 0", ride: ride("10:00:00", "10:00:50"), expect: { minutes: 1, timeCharge: 0, total: 0 } },
  { id: "TC-08", name: "рівно 2 хв → 0", ride: ride("10:00:00", "10:02:00"), expect: { minutes: 2, timeCharge: 0, total: 0 } },
  { id: "TC-09", name: "2 хв 1 с → 3 хв → 2500", ride: ride("10:00:00", "10:02:01"), expect: { minutes: 3, timeCharge: 2500, total: 2500 } },
  { id: "TC-10", name: "4 хв → 1 блок 2500", ride: ride("10:00:00", "10:04:00"), expect: { minutes: 4, timeCharge: 2500, total: 2500 } },
  { id: "TC-11", name: "0 с → 0 хв, не відхиляється, 0", ride: ride("10:00:00", "10:00:00"), expect: { minutes: 0, timeCharge: 0, total: 0 } },
  { id: "TC-12", name: "1 хв + повернення на X01 → лише збір 15000", ride: ride("10:00:00", "10:00:50", { station: "X01" }), expect: { timeCharge: 0, fees: [15000], total: 15000 } },
]);

// ---------------------------------------------------------------- T3
runTable("T3", [
  { id: "TC-13", name: "класичний 50 хв → 2 блоки 5000", ride: ride("10:00", "10:50"), expect: { timeCharge: 5000, total: 5000 } },
  { id: "TC-14", name: "електро 75 хв → 3 блоки 12000", ride: ride("10:00", "11:15", EBIKE), expect: { timeCharge: 12000, total: 12000 } },
  { id: "TC-15", name: "класичний 60 хв → 5000", ride: ride("10:00", "11:00"), expect: { timeCharge: 5000, total: 5000 } },
  { id: "TC-15", name: "класичний 61 хв → 7500", ride: ride("10:00", "11:01"), expect: { timeCharge: 7500, total: 7500 } },
  { id: "TC-16", name: "електро 30 хв → 4000", ride: ride("10:00", "10:30", EBIKE), expect: { timeCharge: 4000, total: 4000 } },
  { id: "TC-16", name: "електро 31 хв → 8000", ride: ride("10:00", "10:31", EBIKE), expect: { timeCharge: 8000, total: 8000 } },
]);

// ---------------------------------------------------------------- T4
const sub = rider("subscriber");
runTable("T4", [
  { id: "TC-17", name: "абонент, класичний 40 хв → 0", ride: ride("10:00", "10:40"), rider: sub, expect: { total: 0 } },
  { id: "TC-18", name: "абонент, класичний 100 хв → 5000", ride: ride("10:00", "11:40"), rider: sub, expect: { total: 5000 } },
  { id: "TC-19", name: "абонент, класичний 45 хв → 0", ride: ride("10:00", "10:45"), rider: sub, expect: { total: 0 } },
  { id: "TC-20", name: "абонент, класичний 46 хв → 2500", ride: ride("10:00", "10:46"), rider: sub, expect: { total: 2500 } },
  { id: "TC-21", name: "абонент, класичний 75 хв → 2500", ride: ride("10:00", "11:15"), rider: sub, expect: { total: 2500 } },
  { id: "TC-21", name: "абонент, класичний 76 хв → 5000", ride: ride("10:00", "11:16"), rider: sub, expect: { total: 5000 } },
  // docs/spec/tariffs.md:62 (40 min = 2 started blocks), :76-77 (no free minutes on an e-bike, 20 % off)
  { id: "TC-22", name: "абонент, електро 40 хв → 2 блоки 8000 − 20 % = 6400", ride: ride("10:00", "10:40", EBIKE), rider: sub, expect: { timeCharge: 8000, total: 6400 } },
  { id: "TC-23", name: "абонент, електро 75 хв → 12000 − 20 % = 9600", ride: ride("10:00", "11:15", EBIKE), rider: sub, expect: { total: 9600 } },
  {
    id: "TC-59",
    name: "абонент, електро 20 хв, X01 → 3200 + збір 15000 без знижки = 18200",
    ride: ride("10:00", "10:20", { ...EBIKE, station: "X01" }),
    rider: sub,
    expect: { fees: [15000], total: 18200 },
  },
]);

// ---------------------------------------------------------------- T5
const reduced = rider("reduced");
const subConc = rider("subscriber", { concession: true });
runTable("T5", [
  { id: "TC-24", name: "пільговий, класичний 40 хв → 5000 − 50 % = 2500", ride: ride("10:00", "10:40"), rider: reduced, expect: { timeCharge: 5000, total: 2500 } },
  { id: "TC-25", name: "пільговий, електро 75 хв → 6000", ride: ride("10:00", "11:15", EBIKE), rider: reduced, expect: { total: 6000 } },
  { id: "TC-26", name: "абонент+пільга, класичний 80 хв: абонемент 5000 vs пільга 3750 → 3750", ride: ride("10:00", "11:20"), rider: subConc, expect: { total: 3750 } },
  { id: "TC-27", name: "абонент+пільга, класичний 40 хв: абонемент 0 vs пільга 2500 → 0", ride: ride("10:00", "10:40"), rider: subConc, expect: { total: 0 } },
  { id: "TC-28", name: "абонент+пільга, класичний 91 хв: суми рівні (5000) → до сплати 5000", ride: ride("10:00", "11:31"), rider: subConc, expect: { timeCharge: 10000, total: 5000 } },
  // docs/spec/tariffs.md:62, :76, :86, :89-91 — 8000: subscription 6400 vs reduced 4000 → reduced
  { id: "TC-29", name: "абонент+пільга, електро 40 хв: абонемент 6400 vs пільга 4000 → 4000", ride: ride("10:00", "10:40", EBIKE), rider: subConc, expect: { timeCharge: 8000, total: 4000 } },
  {
    id: "TC-30",
    name: "пільговий, 20 хв, X01 → 1250 + збір 15000 без знижки = 16250",
    ride: ride("10:00", "10:20", { station: "X01" }),
    rider: reduced,
    expect: { fees: [15000], total: 16250 },
  },
  {
    id: "TC-31",
    name: "пільговий, 25 год → ліміт 30000 + збір 200000 без знижки = 230000",
    ride: ride("09:00", ["10:00", "2026-09-17"]),
    rider: reduced,
    expect: { minutes: 1500, fees: [200000], total: 230000 },
  },
]);

test("T5: TC-28 рівність сум → застосовано знижку «абонемент», а не пільгу", () => {
  const result = quote(ride("10:00", "11:31"), subConc);
  assert.deepEqual(result.discounts.map((d) => d.code), ["subscription"]);
  assert.equal(result.discounts[0].amount, 5000);
});

// ---------------------------------------------------------------- T6
/** Rides booked into one shared ledger; each step: [ride, rider, expected total]. */
function runSequence(rule, id, name, steps, ledger = createDayCap()) {
  test(`${rule}: ${id} ${name}`, () => {
    for (const [index, [r, who, expected]] of steps.entries()) {
      assert.equal(quote(r, who, { dayCap: ledger }).total, expected, `крок ${index + 1}`);
    }
  });
}

/** TC-32: the rider reaches the 30000 cap on 16.09. */
const capReaching = () => [
  [ride("09:00", "10:20", EBIKE), rider(), 12000],
  [ride("13:00", "14:20", EBIKE), rider(), 12000],
  [ride("18:00", "19:20", EBIKE), rider(), 6000],
];
const filledLedger = () => {
  const ledger = createDayCap();
  for (const [r, who] of capReaching()) quote(r, who, { dayCap: ledger });
  return ledger;
};

runSequence("T6", "TC-32", "три поїздки електро по 80 хв: 12000, 12000, 6000", capReaching());
runSequence("T6", "TC-33", "300 хв → 25000; 60 хв → 5000 (рівно 30000); 20 хв → 0", [
  [ride("09:00", "14:00"), rider(), 25000],
  [ride("15:00", "16:00"), rider(), 5000],
  [ride("17:00", "17:20"), rider(), 0],
]);
runSequence("T6", "TC-34", "поїздка 16.09 23:40 → 17.09 00:20 належить до 16.09, ліміт вичерпано → 0", [
  [ride("23:40", ["00:20", NEXT_DAY]), rider(), 0],
], filledLedger());
runSequence("T6", "TC-35", "17.09 00:30–01:00 за Києвом — нова доба: 2500 − 30 % = 1750", [
  [ride("2026-09-16T21:30:00Z", "2026-09-16T22:00:00Z"), rider(), 1750],
], filledLedger());
runSequence("T6", "TC-36", "ліміт на одного користувача: інший користувач платить 2500", [
  [ride("19:00", "19:20"), rider("standard", { id: "rider-2" }), 2500],
], filledLedger());
runSequence("T6", "TC-37", "пільговий, електро: 20000, потім залишок ліміту 10000", [
  [ride("09:00", "14:00", EBIKE), rider("reduced"), 20000],
  [ride("15:00", "20:00", EBIKE), rider("reduced"), 10000],
]);
runSequence("T6", "TC-38", "ліміт вичерпано, повернення на X02: лише збір 15000", [
  [ride("19:00", "19:20", { station: "X02" }), rider(), 15000],
], filledLedger());

test("T6: TC-33 третя поїздка — рядок «ліміт» на 2500; друга (рівно 30000) — без рядка ліміту", () => {
  const ledger = createDayCap();
  const first = quote(ride("09:00", "14:00"), rider(), { dayCap: ledger });
  const second = quote(ride("15:00", "16:00"), rider(), { dayCap: ledger });
  const third = quote(ride("17:00", "17:20"), rider(), { dayCap: ledger });
  assert.deepEqual([first.discounts.length, second.discounts.length, third.discounts.length], [0, 0, 1]);
  assert.equal(third.discounts[0].amount, 2500);
});

test("T6: TC-32 третя поїздка — рядок «денний ліміт» на 6000", () => {
  const ledger = createDayCap();
  const [first, second, third] = capReaching();
  quote(...first.slice(0, 2), { dayCap: ledger });
  quote(...second.slice(0, 2), { dayCap: ledger });
  const result = quote(...third.slice(0, 2), { dayCap: ledger });
  assert.deepEqual(result.discounts.map((d) => d.amount), [6000]);
});

// ---------------------------------------------------------------- T7
runTable("T7", [
  { id: "TC-39", name: "20 хв, X01 → 2500 + 15000 = 17500", ride: ride("10:00", "10:20", { station: "X01" }), expect: { fees: [15000], total: 17500 } },
  { id: "TC-40", name: "20 хв, X02 → 17500", ride: ride("10:00", "10:20", { station: "X02" }), expect: { total: 17500 } },
  { id: "TC-40", name: "20 хв, X03 → 17500", ride: ride("10:00", "10:20", { station: "X03" }), expect: { total: 17500 } },
  { id: "TC-40", name: "20 хв, S08 (у зоні) → 2500", ride: ride("10:00", "10:20", { station: "S08" }), expect: { fees: [], total: 2500 } },
]);

// ---------------------------------------------------------------- T8
const overnight = (endTime, endDate, extra) => ride("09:00:00", [endTime, endDate], extra);
runTable("T8", [
  { id: "TC-41", name: "рівно 24 год → збору немає, 30000", ride: overnight("09:00:00", NEXT_DAY), expect: { minutes: 1440, fees: [], total: 30000 } },
  { id: "TC-42", name: "24 год 1 с → 1441 хв → 30000 + 200000", ride: overnight("09:00:01", NEXT_DAY), expect: { minutes: 1441, fees: [200000], total: 230000 } },
  { id: "TC-43", name: "25 год → ліміт 30000 + збір 200000 = 230000", ride: overnight("10:00:00", NEXT_DAY), expect: { minutes: 1500, timeCharge: 125000, fees: [200000], total: 230000 } },
  { id: "TC-44", name: "25 год, X03 → 30000 + 15000 + 200000 = 245000", ride: overnight("10:00:00", NEXT_DAY, { station: "X03" }), expect: { total: 245000 } },
]);

test("T8: TC-44 обидва збори застосовано (15000 і 200000)", () => {
  const result = quote(overnight("10:00:00", NEXT_DAY, { station: "X03" }), rider());
  assert.deepEqual(result.fees.map((f) => f.amount).sort((a, b) => a - b), [15000, 200000]);
});

// ---------------------------------------------------------------- T9
test("T9: TC-45 знижка 30 % від 1235 коп.: до сплати 864, знижка 371", () => {
  const off = discount(1235, 30);
  assert.equal(off, 371);
  assert.equal(1235 - off, 864);
});

// ---------------------------------------------------------------- T10
runTable("T10", [
  { id: "TC-49", name: "01:10–01:40 → 2500 − 30 % = 1750", ride: ride("01:10", "01:40"), expect: { total: 1750 } },
  { id: "TC-50", name: "00:00–00:20 → 1750", ride: ride("00:00:00", "00:20:00"), expect: { total: 1750 } },
  { id: "TC-51", name: "05:30–05:59 → 1750", ride: ride("05:30:00", "05:59:00"), expect: { total: 1750 } },
  { id: "TC-52", name: "06:01–06:21 → 2500", ride: ride("06:01:00", "06:21:00"), expect: { total: 2500 } },
  { id: "TC-52", name: "23:00–23:30 → 2500", ride: ride("23:00:00", "23:30:00"), expect: { total: 2500 } },
  { id: "TC-53", name: "електро 02:00–02:30 → 4000 − 30 % = 2800", ride: ride("02:00", "02:30", EBIKE), expect: { total: 2800 } },
]);

// ---------------------------------------------------------------- Section 4
const invalid = [
  { id: "TC-54", name: "повернення раніше за взяття", ride: ride("10:00", "09:00"), rider: rider() },
  { id: "TC-55", name: "тип велосипеда tandem", ride: ride("10:00", "10:20", { bike: "tandem" }), rider: rider() },
  { id: "TC-56", name: "категорія користувача vip", ride: ride("10:00", "10:20"), rider: rider("vip") },
  { id: "TC-57", name: "станція повернення S09", ride: ride("10:00", "10:20", { station: "S09" }), rider: rider() },
];
for (const row of invalid) {
  test(`Розд. 4: ${row.id} ${row.name} → запит відхилено`, () => {
    assert.throws(() => quote(row.ride, row.rider), QuoteError);
  });
}
