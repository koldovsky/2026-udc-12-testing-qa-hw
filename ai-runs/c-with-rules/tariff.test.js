// Tests for app/src/tariff.js
// No docs/spec/ found → all expected values come from the source code.
// Every test is marked ASSUMPTION: per project rule 2.
//
// Night-discount tests use dates after 2026-10-25 (EET = UTC+2 winter time).
// At least one pickup per night group uses T22:00Z, where UTC date ≠ Kyiv date.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quote, QuoteError, discount } from "../../app/src/tariff.js";
import { stationZones } from "../../app/src/zones.js";
import { createDayCap } from "../../app/src/day-cap.js";

const zones = stationZones;
const std = { type: "standard" };
const red = { type: "reduced" };
const sub = { type: "subscriber" };

// Build a ride with exact integer duration in minutes.
function rideOf(pickupAt, minutes, bike = "classic", returnStation = "S01") {
  return {
    pickupAt,
    returnAt: new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString(),
    bike,
    returnStation,
  };
}

// Fixed reference instants (all in EET = UTC+2 winter, after 2026-10-25):
//   DAY            → Kyiv 12:00, well inside daytime (hour 12 ≥ 6)
//   NIGHT_H05      → Kyiv 05:59, one minute before the night/day boundary (hour 5 < 6)
//   DAY_H06        → Kyiv 06:30, inside first day hour (hour 6, 6 < 6 = false)
//   NIGHT_UTC_PREV → Kyiv 00:00 on 06.11 but UTC 22:00 on 05.11 (UTC date ≠ Kyiv date)
const DAY            = "2026-11-05T10:00:00Z"; // Kyiv 12:00
const NIGHT_H05      = "2026-11-05T03:59:00Z"; // Kyiv 05:59
const DAY_H06        = "2026-11-05T04:30:00Z"; // Kyiv 06:30
const NIGHT_UTC_PREV = "2026-11-05T22:00:00Z"; // Kyiv 00:00 on 06.11 (UTC+2)

// ─── discount helper ─────────────────────────────────────────────────────────

describe("discount()", () => {
  it("ASSUMPTION: discount = amount − floor(amount × (100−pct) / 100)", () => {
    // ПРИПУЩЕННЯ: формула з tariff.js:102; знижка — це та частина, яка НЕ сплачується
    // ПИТАННЯ: підтвердити правило округлення знижки (підлога vs банківське округлення)
    for (const { id, amount, percent, expected } of [
      { id: "2500@50%", amount: 2500, percent: 50, expected: 1250 },
      { id: "2500@30%", amount: 2500, percent: 30, expected:  750 },
      { id: "1250@30%", amount: 1250, percent: 30, expected:  375 },
      { id: "15000@50%", amount: 15000, percent: 50, expected: 7500 },
      { id: "0@50%",   amount:    0, percent: 50, expected:    0 },
    ]) {
      assert.equal(discount(amount, percent), expected, id);
    }
  });
});

// ─── Validation ──────────────────────────────────────────────────────────────

describe("quote() – input validation", () => {
  it("ASSUMPTION: null ride throws QuoteError", () => {
    // ПРИПУЩЕННЯ: null → QuoteError("ride is required") — tariff.js:113
    assert.throws(() => quote(null, std, { zones }), QuoteError);
  });

  it("ASSUMPTION: returnAt before pickupAt throws QuoteError", () => {
    // ПРИПУЩЕННЯ: returnAt < pickupAt → QuoteError — tariff.js:116
    assert.throws(
      () => quote(
        { pickupAt: "2026-11-05T10:00:00Z", returnAt: "2026-11-05T09:00:00Z",
          bike: "classic", returnStation: "S01" },
        std, { zones },
      ),
      QuoteError,
    );
  });

  it("ASSUMPTION: unknown bike type throws QuoteError", () => {
    // ПРИПУЩЕННЯ: bike ∉ {classic, ebike} → QuoteError — tariff.js:117
    assert.throws(() => quote(rideOf(DAY, 30, "scooter"), std, { zones }), QuoteError);
  });

  it("ASSUMPTION: unknown return station throws QuoteError", () => {
    // ПРИПУЩЕННЯ: stationId не в таблиці stations → QuoteError — tariff.js:119
    assert.throws(() => quote(rideOf(DAY, 30, "classic", "Z99"), std, { zones }), QuoteError);
  });

  it("ASSUMPTION: unknown rider type throws QuoteError", () => {
    // ПРИПУЩЕННЯ: rider.type ∉ RIDER_TYPES → QuoteError — tariff.js:124
    assert.throws(() => quote(rideOf(DAY, 30), { type: "vip" }, { zones }), QuoteError);
  });

  it("ASSUMPTION: dayCap without rider.id throws QuoteError", () => {
    // ПРИПУЩЕННЯ: dayCap && !rider.id → QuoteError — tariff.js:125
    // ПИТАННЯ: чи rider.id = "" (порожній рядок) вважається відсутнім?
    assert.throws(
      () => quote(rideOf(DAY, 30), std, { zones, dayCap: createDayCap() }),
      QuoteError,
    );
  });
});

// ─── Free start and block billing ────────────────────────────────────────────

describe("quote() – free start boundary (< 2 min)", () => {
  it("ASSUMPTION: 1 min is free; 2 min costs exactly 1 block (classic 2 500 kop)", () => {
    // ПРИПУЩЕННЯ: FREE_START_MINUTES=2, RATES.classic=2500, BLOCK_MINUTES=30 — tariff.js:18-21
    // ПИТАННЯ: підтвердити межу безкоштовного старту (< 2 хв чи ≤ 1 хв?)
    for (const { id, minutes, expected } of [
      { id: "1min-free",        minutes:  1, expected:    0 },
      { id: "2min-first-block", minutes:  2, expected: 2500 },
    ]) {
      const r = quote(rideOf(DAY, minutes), std, { zones });
      assert.equal(r.timeCharge, expected, id);
    }
  });
});

describe("quote() – block billing boundary (30 / 31 min)", () => {
  it("ASSUMPTION: 30 min = 1 block; 31 min = 2 blocks for classic", () => {
    // ПРИПУЩЕННЯ: ceil(31/30)=2, тому 31 хв — вже 2 блоки — tariff.js:74-75,80
    // ПИТАННЯ: підтвердити межу блоку (30:00 vs 30:01)
    for (const { id, minutes, expected } of [
      { id: "30min=1block",  minutes: 30, expected: 2500 },
      { id: "31min=2blocks", minutes: 31, expected: 5000 },
    ]) {
      const r = quote(rideOf(DAY, minutes), std, { zones });
      assert.equal(r.timeCharge, expected, id);
    }
  });

  it("ASSUMPTION: ebike rate is 4 000 kop/block vs classic 2 500 kop/block", () => {
    // ПРИПУЩЕННЯ: RATES = { classic: 2500, ebike: 4000 } — tariff.js:18
    // ПИТАННЯ: підтвердити тарифні ставки для обох типів велосипедів
    for (const { id, bike, expected } of [
      { id: "classic-30min", bike: "classic", expected: 2500 },
      { id: "ebike-30min",   bike: "ebike",   expected: 4000 },
    ]) {
      const r = quote(rideOf(DAY, 30, bike), std, { zones });
      assert.equal(r.timeCharge, expected, id);
    }
  });
});

// ─── Standard rider ──────────────────────────────────────────────────────────

describe("quote() – standard rider", () => {
  it("ASSUMPTION: standard rider has no discounts and total equals timeCharge", () => {
    // ПРИПУЩЕННЯ: cheaperPlan повертає {code:'none', amount:0} для standard — tariff.js:90-98
    const r = quote(rideOf(DAY, 30), std, { zones });
    assert.deepEqual(r.discounts, []);
    assert.equal(r.total, 2500);
  });
});

// ─── Reduced fare ────────────────────────────────────────────────────────────

describe("quote() – reduced fare", () => {
  it("ASSUMPTION: reduced rider gets 50% discount on timeCharge (classic 30 min = 1 250 kop)", () => {
    // ПРИПУЩЕННЯ: REDUCED_PERCENT=50; discount(2500,50)=1250 — tariff.js:23,95
    // ПИТАННЯ: підтвердити розмір пільгової знижки
    const r = quote(rideOf(DAY, 30), red, { zones });
    assert.deepEqual(r.discounts, [{ code: "reduced", amount: 1250 }]);
    assert.equal(r.total, 1250);
  });
});

// ─── Subscription ────────────────────────────────────────────────────────────

describe("quote() – subscriber plan (classic)", () => {
  it("ASSUMPTION: 45 min is fully free; 46 min pays for 1 block (subscription boundary)", () => {
    // ПРИПУЩЕННЯ: SUBSCRIPTION_FREE_MINUTES=45 — tariff.js:21,83-86
    // ПИТАННЯ: підтвердити межу 45 хв для абонемента
    for (const { id, minutes, expectedTotal } of [
      { id: "45min-free",        minutes: 45, expectedTotal:    0 },
      { id: "46min-pays-1block", minutes: 46, expectedTotal: 2500 },
    ]) {
      const r = quote(rideOf(DAY, minutes), sub, { zones });
      assert.equal(r.total, expectedTotal, id);
    }
  });
});

describe("quote() – subscriber ebike", () => {
  it("ASSUMPTION: subscriber ebike – over-45-min portion has 20% off (46 min = 3 200 kop total)", () => {
    // ПРИПУЩЕННЯ: SUBSCRIPTION_EBIKE_PERCENT=20 — tariff.js:22,85
    // 46 min ebike:
    //   timeCharge = ceil(46/30)*4000 = 8000
    //   charge = blocks(1)*4000 = 4000; subscriptionCharge = 4000 − discount(4000,20) = 3200
    //   plan.amount = 8000 − 3200 = 4800
    // ПИТАННЯ: підтвердити знижку 20% для ebike-абонемента
    const r = quote(rideOf(DAY, 46, "ebike"), sub, { zones });
    assert.deepEqual(r.discounts, [{ code: "subscription", amount: 4800 }]);
    assert.equal(r.total, 3200);
  });
});

// ─── Concession subscriber (cheaperPlan) ─────────────────────────────────────

describe("quote() – concession subscriber: cheaper of subscription vs reduced", () => {
  it("ASSUMPTION: short ride — subscription wins (20 min: full refund > 50% off)", () => {
    // ПРИПУЩЕННЯ: cheaperPlan вибирає підписку якщо її знижка > reduced
    // 20 min: timeCharge=2500; subscription discount=2500 (all free); reduced=1250 → sub wins
    const rider = { type: "subscriber", concession: true };
    const r = quote(rideOf(DAY, 20), rider, { zones });
    assert.deepEqual(r.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(r.total, 0);
  });

  it("ASSUMPTION: long ride — reduced wins (90 min: 50% off > subscription discount)", () => {
    // ПРИПУЩЕННЯ: 90 min classic:
    //   timeCharge = 3*2500 = 7500
    //   subscriptionCharge = ceil(45/30)*2500 = 5000; sub discount = 2500
    //   reduced discount = discount(7500,50) = 3750 → reduced wins
    // ПИТАННЯ: підтвердити правило «дешевший тариф перемагає»
    const rider = { type: "subscriber", concession: true };
    const r = quote(rideOf(DAY, 90), rider, { zones });
    assert.deepEqual(r.discounts, [{ code: "reduced", amount: 3750 }]);
    assert.equal(r.total, 3750);
  });
});

// ─── Night discount ───────────────────────────────────────────────────────────

describe("quote() – night discount (Kyiv hour < 06)", () => {
  it("ASSUMPTION: Kyiv 05:59 → 30% night discount (classic 30 min = 1 750 kop total)", () => {
    // ПРИПУЩЕННЯ: NIGHT_PERCENT=30, NIGHT_UNTIL_HOUR=6; discount(2500,30)=750 — tariff.js:24-25,50-54
    // ПИТАННЯ: підтвердити межу нічного тарифу (< 06:00 чи ≤ 05:59?)
    // 2026-11-05T03:59:00Z = Kyiv 05:59 (UTC+2 EET winter) — just before boundary
    const r = quote(rideOf(NIGHT_H05, 30), std, { zones });
    assert.deepEqual(r.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(r.total, 1750);
  });

  it("ASSUMPTION: Kyiv 06:30 → no night discount (classic 30 min = 2 500 kop total)", () => {
    // ПРИПУЩЕННЯ: kyivTime(pickup).hour < 6 — год. 6 не є нічним — tariff.js:50
    // 2026-11-05T04:30:00Z = Kyiv 06:30 (UTC+2 EET winter)
    const r = quote(rideOf(DAY_H06, 30), std, { zones });
    assert.deepEqual(r.discounts, []);
    assert.equal(r.total, 2500);
  });

  it("ASSUMPTION: night discount uses Kyiv time — 2026-11-05T22:00Z is Kyiv 00:00 (06.11)", () => {
    // ПРИПУЩЕННЯ: kyivTime() використовує Europe/Kyiv (UTC+2 EET після 25.10.2026)
    // UTC дата = 2026-11-05, Київська дата = 2026-11-06, Київська год. = 0 → нічна знижка
    // ПИТАННЯ: підтвердити, що за зимовим часом Europe/Kyiv = UTC+2
    const r = quote(rideOf(NIGHT_UTC_PREV, 30), std, { zones });
    assert.deepEqual(r.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(r.total, 1750);
  });
});

// ─── Daily cap ────────────────────────────────────────────────────────────────

describe("quote() – daily cap (30 000 kop per UTC day)", () => {
  it("ASSUMPTION: 360 min (timeCharge = 30 000 kop) is NOT capped — cap boundary is exclusive", () => {
    // ПРИПУЩЕННЯ: умова `due > allowance` (строго більше) — tariff.js:57; 30000 > 30000 = false
    // ПИТАННЯ: підтвердити, що ліміт виключний (> 30 000, а не ≥ 30 000)
    const cap = createDayCap();
    const rider = { type: "standard", id: "u1" };
    const r = quote(rideOf(DAY, 360), rider, { zones, dayCap: cap });
    assert.deepEqual(r.discounts, []);
    assert.equal(r.total, 30000);
  });

  it("ASSUMPTION: 361 min (timeCharge = 32 500 kop) is capped — total = 30 000 kop", () => {
    // ПРИПУЩЕННЯ: ceil(361/30)*2500 = 32500 > 30000 → day-cap discount = 2500
    // ПИТАННЯ: підтвердити розмір добового ліміту та що він застосовується до timeCharge
    const cap = createDayCap();
    const rider = { type: "standard", id: "u1" };
    const r = quote(rideOf(DAY, 361), rider, { zones, dayCap: cap });
    assert.deepEqual(r.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(r.total, 30000);
  });

  it("ASSUMPTION: second ride same UTC day is fully capped after limit is exhausted", () => {
    // ПРИПУЩЕННЯ: після вичерпання ліміту remaining=0, всі нові timeCharge знімаються day-cap
    const cap = createDayCap();
    const rider = { type: "standard", id: "u1" };
    quote(rideOf(DAY, 361), rider, { zones, dayCap: cap });          // exhausts cap
    const r2 = quote(rideOf("2026-11-05T13:00:00Z", 30), rider, { zones, dayCap: cap });
    assert.equal(r2.total, 0);
  });

  it("ASSUMPTION: rides on a different UTC day use a fresh allowance", () => {
    // ПРИПУЩЕННЯ: dayKey(pickup) = UTC date — 06.11 UTC незалежний від 05.11 UTC
    const cap = createDayCap();
    const rider = { type: "standard", id: "u1" };
    quote(rideOf(DAY, 361), rider, { zones, dayCap: cap });          // exhausts 05.11 UTC
    const r = quote(rideOf("2026-11-06T10:00:00Z", 30), rider, { zones, dayCap: cap });
    assert.equal(r.total, 2500); // 06.11 UTC: fresh allowance
  });
});

// ─── Out-of-zone fee ─────────────────────────────────────────────────────────

describe("quote() – out-of-zone fee", () => {
  it("ASSUMPTION: returning to out-of-zone station adds 15 000 kop fee", () => {
    // ПРИПУЩЕННЯ: OUT_OF_ZONE_FEE=15000 for zone:'out' — tariff.js:26,106-107
    // ПИТАННЯ: підтвердити розмір штрафу за повернення поза зоною
    const r = quote(rideOf(DAY, 30, "classic", "X01"), std, { zones });
    assert.deepEqual(r.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(r.total, 2500 + 15000);
  });

  it("ASSUMPTION: reduced rider gets 50% off the out-of-zone fee (7 500 kop)", () => {
    // ПРИПУЩЕННЯ: reduced fare застосовує REDUCED_PERCENT до зборів — tariff.js:63-65
    // fee = 15000 − discount(15000,50) = 15000 − 7500 = 7500
    // ПИТАННЯ: підтвердити, чи пільга поширюється на збори, а не лише на timeCharge
    const r = quote(rideOf(DAY, 30, "classic", "X01"), red, { zones });
    assert.deepEqual(r.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(r.total, 1250 + 7500); // 1250 (reduced timeCharge) + 7500 (reduced fee)
  });
});

// ─── Unreturned bike fee ──────────────────────────────────────────────────────

describe("quote() – unreturned bike fee (> 24 h)", () => {
  it("ASSUMPTION: exactly 1 440 min (24 h) → no unreturned fee", () => {
    // ПРИПУЩЕННЯ: умова `minutes > 1440` (строго більше) — tariff.js:28,108
    // ПИТАННЯ: підтвердити межу (> 24 год чи ≥ 24 год?)
    const r = quote(rideOf(DAY, 1440), std, { zones });
    assert.deepEqual(r.fees, []);
  });

  it("ASSUMPTION: 1 441 min (24 h + 1 min) → 200 000 kop unreturned fee", () => {
    // ПРИПУЩЕННЯ: UNRETURNED_FEE=200000, UNRETURNED_AFTER_MINUTES=1440 — tariff.js:27-28
    // ПИТАННЯ: підтвердити розмір штрафу за неповернення велосипеда
    const r = quote(rideOf(DAY, 1441), std, { zones });
    assert.deepEqual(r.fees, [{ code: "unreturned", amount: 200000 }]);
  });
});
