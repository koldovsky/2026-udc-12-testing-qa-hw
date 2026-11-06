// Price of a single ride and rejected requests (T1–T5, T7, T8, T10, §4).
// Cases and expected values: docs/test-cases.md, docs/spec/tariffs.md.
import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError, quote } from "../../src/tariff.js";

const STANDARD = { type: "standard" };
const REDUCED = { type: "reduced" };
const SUBSCRIBER = { type: "subscriber" };
const SUBSCRIBER_WITH_CONCESSION = { type: "subscriber", concession: true };

const PICKUP = "2026-09-16T10:00:00+03:00";

// Defaults for a row: standard rider, classic bike, pickup 16.09 10:00 Kyiv, return at S01, no fees.
// `reducedApplied` is set only where the case names the variant chosen for a subscriber
// with a concession. It checks the reduced fare alone, because how the subscription shows
// up in `discounts` depends on open question Q-7.
const PRICES = [
  { id: "TC-01", rule: "T1", name: "12 хв 40 с округлюються вгору до 13 хв", returnAt: "2026-09-16T10:12:40+03:00", minutes: 13, total: 2500 },
  { id: "TC-35", rule: "T1", name: "ніч переведення годинника: фактичні 140 хв, а не різниця показів годинника", pickupAt: "2026-10-25T02:50:00+03:00", returnAt: "2026-10-25T04:10:00+02:00", minutes: 140, total: 8750 },

  { id: "TC-03", rule: "T2", name: "рівно 2 хв — хибний старт, без нарахування", returnAt: "2026-09-16T10:02:00+03:00", minutes: 2, total: 0 },
  { id: "TC-04", rule: "T2", name: "2 хв 1 с — це вже 3 хв і 1 блок", returnAt: "2026-09-16T10:02:01+03:00", minutes: 3, total: 2500 },
  { id: "TC-05", rule: "T2", name: "хибний старт поза зоною: збір усе одно нараховано", returnAt: "2026-09-16T10:00:50+03:00", station: "X01", minutes: 1, fees: [15000], total: 15000 },

  { id: "TC-06", rule: "T3", name: "30 хв 1 с — це 31 хв і 2 блоки", returnAt: "2026-09-16T10:30:01+03:00", minutes: 31, total: 5000 },
  { id: "TC-07", rule: "T3", name: "електровелосипед, 3 блоки по 40 грн", bike: "ebike", returnAt: "2026-09-16T11:15:00+03:00", total: 12000 },

  { id: "TC-09", rule: "T4", name: "абонент, рівно 45 хв — безкоштовно", rider: SUBSCRIBER, returnAt: "2026-09-16T10:45:00+03:00", total: 0 },
  { id: "TC-10", rule: "T4", name: "абонент, 45 хв 1 с — 46 хв і 1 платний блок", rider: SUBSCRIBER, returnAt: "2026-09-16T10:45:01+03:00", minutes: 46, total: 2500 },
  { id: "TC-11", rule: "T4", name: "абонент, 100 хв — 55 платних хв і 2 блоки", rider: SUBSCRIBER, returnAt: "2026-09-16T11:40:00+03:00", total: 5000 },
  { id: "TC-12", rule: "T4", name: "абонент на електровелосипеді: без безкоштовних хвилин, знижка 20 %", rider: SUBSCRIBER, bike: "ebike", returnAt: "2026-09-16T10:45:00+03:00", total: 6400 },

  { id: "TC-13", rule: "T5", name: "пільга не зменшує збір поза зоною", rider: REDUCED, returnAt: "2026-09-16T10:40:00+03:00", station: "X01", fees: [15000], total: 17500 },
  { id: "TC-14", rule: "T5", name: "абонент із пільгою, 80 хв: пільга дешевша за абонемент", rider: SUBSCRIBER_WITH_CONCESSION, returnAt: "2026-09-16T11:20:00+03:00", reducedApplied: true, total: 3750 },
  { id: "TC-15", rule: "T5", name: "абонент із пільгою, 50 хв: за рівних сум застосовано абонемент", rider: SUBSCRIBER_WITH_CONCESSION, returnAt: "2026-09-16T10:50:00+03:00", reducedApplied: false, total: 2500 },
  { id: "TC-16", rule: "T5", name: "абонент із пільгою, 40 хв: абонемент дає 0", rider: SUBSCRIBER_WITH_CONCESSION, returnAt: "2026-09-16T10:40:00+03:00", total: 0 },

  { id: "TC-24", rule: "T7", name: "повернення на X01 — збір 150 грн", returnAt: "2026-09-16T10:20:00+03:00", station: "X01", fees: [15000], total: 17500 },
  { id: "TC-37", rule: "T7", name: "повернення на X02 — збір 150 грн", returnAt: "2026-09-16T10:20:00+03:00", station: "X02", fees: [15000], total: 17500 },
  ...["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((station) => ({
    id: "TC-36",
    rule: "T7",
    name: `повернення на ${station} — без збору`,
    returnAt: "2026-09-16T10:20:00+03:00",
    station,
    total: 2500,
  })),

  { id: "TC-26", rule: "T8", name: "рівно 24 год — без збору", returnAt: "2026-09-17T10:00:00+03:00", total: 30000 },
  { id: "TC-27", rule: "T8", name: "24 год 1 с — збір 2 000 грн", returnAt: "2026-09-17T10:00:01+03:00", fees: [200000], total: 230000 },
  { id: "TC-28", rule: "T8", name: "понад 24 год і поза зоною — обидва збори", returnAt: "2026-09-17T11:00:00+03:00", station: "X03", fees: [15000, 200000], total: 245000 },
  { id: "TC-29", rule: "T8", name: "пільговий, 25 год: ліміт на нарахування, збір повний", rider: REDUCED, bike: "ebike", returnAt: "2026-09-17T11:00:00+03:00", fees: [200000], total: 230000 },

  { id: "TC-33", rule: "T10", name: "поїздка 01:10–01:40 — нічна знижка 30 %", pickupAt: "2026-09-16T01:10:00+03:00", returnAt: "2026-09-16T01:40:00+03:00", total: 1750 },
  { id: "TC-34", rule: "T10", name: "час у Z: 23:10Z — це 02:10 за Києвом, знижка діє", pickupAt: "2026-09-16T23:10:00Z", returnAt: "2026-09-16T23:40:00Z", total: 1750 },
];

for (const row of PRICES) {
  test(`${row.rule}: ${row.id} ${row.name}`, () => {
    const { rider = STANDARD, bike = "classic", pickupAt = PICKUP, returnAt, station = "S01" } = row;

    const result = quote({ pickupAt, returnAt, bike, returnStation: station }, rider);

    assert.equal(result.total, row.total);
    const feeAmounts = result.fees.map((fee) => fee.amount).toSorted((a, b) => a - b);
    assert.deepEqual(feeAmounts, row.fees ?? []);
    if (row.minutes !== undefined) assert.equal(result.minutes, row.minutes);
    if (row.reducedApplied !== undefined) {
      const codes = result.discounts.map((item) => item.code);
      assert.equal(codes.includes("reduced"), row.reducedApplied);
    }
  });
}

const VALID_RIDE = { pickupAt: PICKUP, returnAt: "2026-09-16T10:20:00+03:00", bike: "classic", returnStation: "S01" };

const REJECTIONS = [
  { id: "TC-02", rule: "T1", name: "повернення раніше за взяття", ride: { pickupAt: "2026-09-16T10:00:01+03:00", returnAt: "2026-09-16T10:00:00+03:00" } },
  { id: "TC-08", rule: "T3", name: "невідомий тип велосипеда", ride: { bike: "самокат" } },
  { id: "TC-17", rule: "T5", name: "невідома категорія користувача", rider: { type: "VIP" } },
  { id: "TC-25", rule: "T7", name: "станції S09 немає в додатку А", ride: { returnStation: "S09" } },
];

for (const row of REJECTIONS) {
  test(`${row.rule}: ${row.id} запит відхилено з поясненням — ${row.name}`, () => {
    assert.throws(
      () => quote({ ...VALID_RIDE, ...row.ride }, row.rider ?? STANDARD),
      (err) => err instanceof QuoteError && err.message.length > 0,
    );
  });
}

test("T1, §4: повернення в момент взяття не раніше за взяття — 0 хв, без нарахування", () => {
  const result = quote({ ...VALID_RIDE, returnAt: PICKUP }, STANDARD);

  assert.equal(result.minutes, 0);
  assert.equal(result.total, 0);
});

// Both rides lie wholly on one side of the night window, so every reading of Q-1 gives the
// same price. The instant 06:00:00 itself is open question Q-2 and is deliberately not pinned.
const NIGHT_EDGES = [
  { name: "05:30–05:50 — уся поїздка у вікні, знижка діє", pickupAt: "2026-09-16T05:30:00+03:00", returnAt: "2026-09-16T05:50:00+03:00", total: 1750, night: true },
  { name: "06:30–06:50 — уся поїздка після вікна, знижки немає", pickupAt: "2026-09-16T06:30:00+03:00", returnAt: "2026-09-16T06:50:00+03:00", total: 2500, night: false },
];

for (const row of NIGHT_EDGES) {
  test(`T10: ${row.name}`, () => {
    const result = quote({ ...VALID_RIDE, pickupAt: row.pickupAt, returnAt: row.returnAt }, STANDARD);

    assert.equal(result.total, row.total);
    assert.equal(result.discounts.some((item) => item.code === "night"), row.night);
  });
}

// T9 asks for a receipt line per discount; a discount of nothing would print as an empty
// line «Знижка: нічна ... 0,00 грн».
const FREE_NIGHT_RIDES = [
  { name: "хибний старт", rider: STANDARD, returnAt: "2026-09-16T01:11:00+03:00" },
  { name: "абонент у межах безкоштовних хвилин", rider: SUBSCRIBER, returnAt: "2026-09-16T01:50:00+03:00" },
];

for (const row of FREE_NIGHT_RIDES) {
  test(`T9, T10: ${row.name} уночі — немає рядка знижки на 0 грн`, () => {
    const result = quote({ ...VALID_RIDE, pickupAt: "2026-09-16T01:10:00+03:00", returnAt: row.returnAt }, row.rider);

    assert.equal(result.total, 0);
    assert.deepEqual(result.discounts.filter((item) => item.amount === 0), []);
  });
}
