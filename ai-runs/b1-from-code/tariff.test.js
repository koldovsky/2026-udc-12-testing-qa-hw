// Unit-тести для app/src/tariff.js — розрахунок вартості поїздки.
// Тести написано за кодом (специфікацію docs/spec/tariffs.md не читали), тож вони фіксують
// поточну поведінку. Місця, які варто звірити зі специфікацією, зібрано в останньому describe.
// Очікувані суми записано числами, а не через константи модуля, щоб зміна тарифу була помітна.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../app/src/day-cap.js";
import { QuoteError, RATES, discount, quote } from "../../app/src/tariff.js";

// ── допоміжне ────────────────────────────────────────────────────────────────

const MINUTE = 60_000;
const DAYTIME = "2026-01-15T10:00:00+02:00"; // 10:00 за Києвом (зима, UTC+2)
const NIGHT = "2026-01-15T01:00:00+02:00"; // 01:00 за Києвом

/** Власна таблиця зон: IN — у зоні, OUT — поза зоною, решта — невідомі станції. */
const testZones = {
  zoneOf: (id) => (id === "IN" ? "in" : id === "OUT" ? "out" : null),
};

const standard = { type: "standard" };
const reduced = { type: "reduced" };
const subscriber = { type: "subscriber" };
const concession = { type: "subscriber", concession: true };

function rideOf({ pickupAt = DAYTIME, minutes = 0, seconds = 0, bike = "classic", returnStation = "IN" } = {}) {
  const returnAt = new Date(Date.parse(pickupAt) + minutes * MINUTE + seconds * 1000).toISOString();
  return { pickupAt, returnAt, bike, returnStation };
}

function price(rideOptions, rider = standard, options = {}) {
  return quote(rideOf(rideOptions), rider, { zones: testZones, ...options });
}

const sum = (items) => items.reduce((s, item) => s + item.amount, 0);

function assertQuoteError(fn, message) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof QuoteError, `очікували QuoteError, отримали ${err}`);
    assert.match(err.message, message);
    return true;
  });
}

// ── тести ────────────────────────────────────────────────────────────────────

describe("discount (T9: залишок до сплати округлюється вниз до копійки)", () => {
  test("точні відсотки", () => {
    assert.equal(discount(5000, 50), 2500);
    assert.equal(discount(2500, 30), 750);
    assert.equal(discount(4000, 20), 800);
  });

  test("неподільна сума — знижка округлюється на користь райдера", () => {
    assert.equal(discount(1001, 50), 501); // до сплати 500
    assert.equal(discount(999, 30), 300); // до сплати 699
    assert.equal(discount(1, 30), 1); // до сплати 0
  });

  test("крайні значення", () => {
    assert.equal(discount(0, 50), 0);
    assert.equal(discount(7777, 0), 0);
    assert.equal(discount(7777, 100), 7777);
  });
});

describe("QuoteError", () => {
  test("це Error з name = QuoteError", () => {
    const err = new QuoteError("x");
    assert.ok(err instanceof Error);
    assert.equal(err.name, "QuoteError");
    assert.equal(err.message, "x");
  });
});

describe("RATES", () => {
  test("ставки за блок: класичний 25 грн, електро 40 грн; об'єкт заморожено", () => {
    assert.deepEqual({ ...RATES }, { classic: 2500, ebike: 4000 });
    assert.ok(Object.isFrozen(RATES));
  });
});

describe("тривалість і погодинне нарахування (стандартний тариф, удень, у зоні)", () => {
  const cases = [
    ["classic", 0, 0],
    ["classic", 1, 0],
    ["classic", 2, 2500],
    ["classic", 29, 2500],
    ["classic", 30, 2500],
    ["classic", 31, 5000],
    ["classic", 60, 5000],
    ["classic", 61, 7500],
    ["ebike", 1, 0],
    ["ebike", 2, 4000],
    ["ebike", 30, 4000],
    ["ebike", 31, 8000],
  ];
  for (const [bike, minutes, expected] of cases) {
    test(`${bike}, ${minutes} хв → ${expected} коп.`, () => {
      assert.deepEqual(price({ bike, minutes }), {
        minutes,
        timeCharge: expected,
        discounts: [],
        fees: [],
        total: expected,
      });
    });
  }

  test("тривалість округлюється до найближчої хвилини", () => {
    assert.equal(price({ minutes: 1, seconds: 29 }).minutes, 1);
    assert.equal(price({ minutes: 1, seconds: 29 }).total, 0);
    assert.equal(price({ minutes: 1, seconds: 30 }).minutes, 2);
    assert.equal(price({ minutes: 1, seconds: 30 }).total, 2500);
    assert.equal(price({ minutes: 30, seconds: 29 }).timeCharge, 2500);
    assert.equal(price({ minutes: 30, seconds: 30 }).timeCharge, 5000);
  });

  test("час можна задавати з різними зсувами, без секунд і з частками секунди", () => {
    const ride = {
      pickupAt: "2026-01-15T10:00+02:00",
      returnAt: "2026-01-15T08:45:00.000Z",
      bike: "classic",
      returnStation: "IN",
    };
    const result = quote(ride, standard, { zones: testZones });
    assert.equal(result.minutes, 45);
    assert.equal(result.timeCharge, 5000);
  });

  test("тривалість через перехід на літній час рахується за реальним часом", () => {
    // 29.03.2026 о 03:00 за Києвом годинник переводять на 04:00
    const ride = {
      pickupAt: "2026-03-29T02:30:00+02:00",
      returnAt: "2026-03-29T04:30:00+03:00",
      bike: "classic",
      returnStation: "IN",
    };
    const result = quote(ride, standard, { zones: testZones });
    assert.equal(result.minutes, 60);
    assert.equal(result.timeCharge, 5000);
  });
});

describe("абонемент", () => {
  test("перші 45 хв безкоштовні", () => {
    assert.deepEqual(price({ minutes: 45 }, subscriber), {
      minutes: 45,
      timeCharge: 5000,
      discounts: [{ code: "subscription", amount: 5000 }],
      fees: [],
      total: 0,
    });
  });

  test("після 45 хв — блоки по 30 хв, відлік від 45-ї хвилини", () => {
    const at46 = price({ minutes: 46 }, subscriber);
    assert.deepEqual(at46.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(at46.total, 2500);

    const at75 = price({ minutes: 75 }, subscriber);
    assert.equal(at75.timeCharge, 7500);
    assert.deepEqual(at75.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(at75.total, 2500);

    const at76 = price({ minutes: 76 }, subscriber);
    assert.deepEqual(at76.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(at76.total, 5000);
  });

  test("електровелосипед: платні блоки зі знижкою 20 %", () => {
    const at30 = price({ bike: "ebike", minutes: 30 }, subscriber);
    assert.equal(at30.total, 0);

    const at60 = price({ bike: "ebike", minutes: 60 }, subscriber);
    assert.equal(at60.timeCharge, 8000);
    assert.deepEqual(at60.discounts, [{ code: "subscription", amount: 4800 }]);
    assert.equal(at60.total, 3200);

    const at106 = price({ bike: "ebike", minutes: 106 }, subscriber);
    assert.equal(at106.timeCharge, 16000);
    assert.equal(at106.total, 9600);
  });

  test("нульова знижка до чека не потрапляє", () => {
    assert.deepEqual(price({ minutes: 1 }, subscriber).discounts, []);
  });

  test("збори абонент сплачує повністю", () => {
    const result = price({ minutes: 20, returnStation: "OUT" }, subscriber);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 15000);
  });
});

describe("пільговий тариф", () => {
  test("50 % від погодинного нарахування", () => {
    assert.deepEqual(price({ minutes: 31 }, reduced), {
      minutes: 31,
      timeCharge: 5000,
      discounts: [{ code: "reduced", amount: 2500 }],
      fees: [],
      total: 2500,
    });
    assert.equal(price({ bike: "ebike", minutes: 2 }, reduced).total, 2000);
  });

  test("збори для пільговика зменшуються вдвічі", () => {
    const result = price({ minutes: 10, returnStation: "OUT" }, reduced);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(result.total, 1250 + 7500);
  });

  test("concession ігнорується, якщо райдер не абонент", () => {
    const result = price({ minutes: 31 }, { type: "standard", concession: true });
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 5000);
  });

  test("абонент із пільгою: обирається вигідніша для поїздки знижка", () => {
    // коротка поїздка — абонемент (2500) вигідніший за пільгу (1250)
    assert.deepEqual(price({ minutes: 30 }, concession).discounts, [{ code: "subscription", amount: 2500 }]);
    // довга поїздка — пільга (8750) вигідніша за абонемент (2500)
    const long = price({ minutes: 200 }, concession);
    assert.equal(long.timeCharge, 17500);
    assert.deepEqual(long.discounts, [{ code: "reduced", amount: 8750 }]);
    assert.equal(long.total, 8750);
  });

  test("коли перемагає пільга, збори абонента теж зменшуються вдвічі", () => {
    const result = price({ minutes: 200, returnStation: "OUT" }, concession);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
  });

  test("concession має бути саме true", () => {
    const result = price({ minutes: 200 }, { type: "subscriber", concession: "yes" });
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 15000);
  });
});

describe("нічна знижка (30 %, посадка до 06:00 за Києвом)", () => {
  test("посадка о 05:59 — знижка є", () => {
    assert.deepEqual(price({ pickupAt: "2026-01-15T05:59:00+02:00", minutes: 20 }), {
      minutes: 20,
      timeCharge: 2500,
      discounts: [{ code: "night", amount: 750 }],
      fees: [],
      total: 1750,
    });
  });

  test("посадка о 06:00 — знижки немає", () => {
    assert.deepEqual(price({ pickupAt: "2026-01-15T06:00:00+02:00", minutes: 20 }).discounts, []);
  });

  test("посадка о 00:00 — знижка є, о 23:59 — немає", () => {
    assert.equal(price({ pickupAt: "2026-01-15T00:00:00+02:00", minutes: 20 }).total, 1750);
    assert.equal(price({ pickupAt: "2026-01-14T23:59:00+02:00", minutes: 20 }).total, 2500);
  });

  test("вирішує час посадки, а не повернення", () => {
    assert.equal(price({ pickupAt: "2026-01-15T05:50:00+02:00", minutes: 30 }).total, 1750);
  });

  test("година береться за Києвом незалежно від зсуву у вхідних даних", () => {
    assert.equal(price({ pickupAt: "2026-01-15T03:59:00Z", minutes: 20 }).total, 1750); // 05:59 Київ
    assert.equal(price({ pickupAt: "2026-01-15T05:00:00Z", minutes: 20 }).total, 2500); // 07:00 Київ
  });

  test("влітку (UTC+3) межа — 03:00 UTC", () => {
    assert.equal(price({ pickupAt: "2026-06-15T02:59:00Z", minutes: 20 }).total, 1750);
    assert.equal(price({ pickupAt: "2026-06-15T03:00:00Z", minutes: 20 }).total, 2500);
  });

  test("застосовується після пільги", () => {
    const result = price({ pickupAt: NIGHT, minutes: 20 }, reduced);
    assert.deepEqual(result.discounts, [
      { code: "reduced", amount: 1250 },
      { code: "night", amount: 375 },
    ]);
    assert.equal(result.total, 875);
  });

  test("застосовується після абонемента", () => {
    const result = price({ pickupAt: NIGHT, bike: "ebike", minutes: 60 }, subscriber);
    assert.deepEqual(result.discounts, [
      { code: "subscription", amount: 4800 },
      { code: "night", amount: 960 },
    ]);
    assert.equal(result.total, 2240);
  });

  test("не з'являється, коли платити вже нічого", () => {
    assert.deepEqual(price({ pickupAt: NIGHT, minutes: 20 }, subscriber).discounts, [
      { code: "subscription", amount: 2500 },
    ]);
    assert.deepEqual(price({ pickupAt: NIGHT, minutes: 1 }).discounts, []);
  });

  test("не зменшує збори", () => {
    const result = price({ pickupAt: NIGHT, minutes: 20, returnStation: "OUT" });
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 1750 + 15000);
  });
});

describe("денний ліміт без журналу (кожна поїздка — не більше 300 грн)", () => {
  test("рівно 300 грн — без рядка day-cap", () => {
    const result = price({ minutes: 360 });
    assert.equal(result.timeCharge, 30000);
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 30000);
  });

  test("понад ліміт — різниця йде знижкою day-cap", () => {
    assert.deepEqual(price({ minutes: 361 }).discounts, [{ code: "day-cap", amount: 2500 }]);
    const ebike = price({ bike: "ebike", minutes: 400 });
    assert.equal(ebike.timeCharge, 56000);
    assert.deepEqual(ebike.discounts, [{ code: "day-cap", amount: 26000 }]);
    assert.equal(ebike.total, 30000);
  });

  test("ліміт застосовується після нічної знижки", () => {
    const under = price({ pickupAt: NIGHT, bike: "ebike", minutes: 300 });
    assert.deepEqual(under.discounts, [{ code: "night", amount: 12000 }]);
    assert.equal(under.total, 28000);

    const over = price({ pickupAt: NIGHT, bike: "ebike", minutes: 330 });
    assert.deepEqual(over.discounts, [
      { code: "night", amount: 13200 },
      { code: "day-cap", amount: 800 },
    ]);
    assert.equal(over.total, 30000);
  });

  test("без журналу поїздки не накопичуються", () => {
    assert.equal(price({ minutes: 400 }, { type: "standard", id: "r1" }).total, 30000);
    assert.equal(price({ minutes: 400 }, { type: "standard", id: "r1" }).total, 30000);
  });

  test("збори додаються понад ліміт", () => {
    const result = price({ minutes: 1441, returnStation: "OUT" });
    assert.equal(result.timeCharge, 122500);
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 92500 }]);
    assert.equal(result.total, 30000 + 15000 + 200000);
  });
});

describe("денний ліміт із журналом createDayCap()", () => {
  const r1 = { type: "standard", id: "r1" };

  test("без rider.id — QuoteError", () => {
    assertQuoteError(() => price({ minutes: 10 }, standard, { dayCap: createDayCap() }), /rider\.id is required/);
  });

  test("поїздки одного дня сумуються до ліміту", () => {
    const dayCap = createDayCap();
    const first = price({ pickupAt: "2026-01-15T10:00:00+02:00", minutes: 300 }, r1, { dayCap });
    assert.equal(first.total, 25000);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 25000);

    const second = price({ pickupAt: "2026-01-15T16:00:00+02:00", minutes: 100 }, r1, { dayCap });
    assert.equal(second.timeCharge, 10000);
    assert.deepEqual(second.discounts, [{ code: "day-cap", amount: 5000 }]);
    assert.equal(second.total, 5000);

    const third = price({ pickupAt: "2026-01-15T19:00:00+02:00", minutes: 31 }, r1, { dayCap });
    assert.deepEqual(third.discounts, [{ code: "day-cap", amount: 5000 }]);
    assert.equal(third.total, 0);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 30000);
  });

  test("коли ліміт вичерпано, збори все одно стягуються і в журнал не пишуться", () => {
    const dayCap = createDayCap();
    price({ minutes: 400 }, r1, { dayCap });
    const result = price({ pickupAt: "2026-01-15T20:00:00+02:00", minutes: 31, returnStation: "OUT" }, r1, {
      dayCap,
    });
    assert.equal(result.total, 15000);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 30000);
  });

  test("інший райдер та інший день мають власний ліміт", () => {
    const dayCap = createDayCap();
    price({ minutes: 400 }, r1, { dayCap });
    assert.equal(price({ minutes: 300 }, { type: "standard", id: "r2" }, { dayCap }).total, 25000);
    assert.equal(price({ pickupAt: "2026-01-16T10:00:00+02:00", minutes: 300 }, r1, { dayCap }).total, 25000);
  });

  test("у журнал іде сума після знижок", () => {
    const dayCap = createDayCap();
    price({ minutes: 100 }, { type: "reduced", id: "p1" }, { dayCap });
    assert.equal(dayCap.chargedOn("p1", "2026-01-15"), 5000);
    assert.equal(dayCap.remaining("p1", Date.parse(DAYTIME)), 25000);
  });

  test("враховує власний ліміт журналу", () => {
    const dayCap = createDayCap({ limit: 10000 });
    const result = price({ minutes: 300 }, r1, { dayCap });
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 15000 }]);
    assert.equal(result.total, 10000);
  });

  test("поїздка з помилкою в даних у журнал не потрапляє", () => {
    const dayCap = createDayCap();
    assertQuoteError(() => price({ minutes: 300, returnStation: "NOPE" }, r1, { dayCap }), /unknown station/);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 0);
  });
});

describe("збори", () => {
  test("повернення поза зону — 150 грн", () => {
    const result = price({ minutes: 10, returnStation: "OUT" });
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 17500);
  });

  test("збір за зону стягується навіть за безкоштовну поїздку", () => {
    assert.equal(price({ minutes: 0, returnStation: "OUT" }).total, 15000);
  });

  test("неповернення — понад 24 год (1440 хв ще без збору)", () => {
    const at1440 = price({ minutes: 1440 });
    assert.deepEqual(at1440.fees, []);
    assert.equal(at1440.total, 30000);

    const at1441 = price({ minutes: 1441 });
    assert.deepEqual(at1441.fees, [{ code: "unreturned", amount: 200000 }]);
    assert.equal(at1441.total, 230000);
  });

  test("обидва збори пільговику — вдвічі менші, у порядку out-of-zone, unreturned", () => {
    const result = price({ minutes: 1441, returnStation: "OUT" }, reduced);
    assert.deepEqual(result.discounts, [
      { code: "reduced", amount: 61250 },
      { code: "day-cap", amount: 31250 },
    ]);
    assert.deepEqual(result.fees, [
      { code: "out-of-zone", amount: 7500 },
      { code: "unreturned", amount: 100000 },
    ]);
    assert.equal(result.total, 30000 + 7500 + 100000);
  });
});

describe("таблиця станцій за замовчуванням", () => {
  test("без опцій використовується zones.js", () => {
    const ride = (returnStation) => ({ ...rideOf({ minutes: 10 }), returnStation });
    assert.deepEqual(quote(ride("S01"), standard).fees, []);
    assert.deepEqual(quote(ride("X01"), standard).fees, [{ code: "out-of-zone", amount: 15000 }]);
    assertQuoteError(() => quote(ride("S99"), standard), /unknown station: S99/);
  });
});

describe("перевірка вхідних даних", () => {
  test("ride відсутній або не об'єкт", () => {
    assertQuoteError(() => quote(undefined, standard), /ride is required/);
    assertQuoteError(() => quote(null, standard), /ride is required/);
    assertQuoteError(() => quote("ride", standard), /ride is required/);
  });

  test("час без зсуву або в іншому форматі", () => {
    const bad = [
      undefined,
      Date.now(),
      "2026-01-15",
      "2026-01-15T10:00:00",
      "2026-01-15 10:00:00Z",
      "2026-01-15T10:00:00+0200",
    ];
    for (const pickupAt of bad) {
      assertQuoteError(
        () => quote({ ...rideOf(), pickupAt }, standard, { zones: testZones }),
        /pickupAt must be an ISO 8601 date-time with an offset/,
      );
    }
    assertQuoteError(
      () => quote({ ...rideOf(), returnAt: "2026-01-15T10:30:00" }, standard, { zones: testZones }),
      /returnAt must be an ISO 8601 date-time with an offset/,
    );
  });

  test("формат правильний, але дата неможлива", () => {
    assertQuoteError(
      () => quote({ ...rideOf(), pickupAt: "2026-13-01T10:00:00Z" }, standard, { zones: testZones }),
      /pickupAt is not a valid date-time/,
    );
  });

  test("повернення раніше за посадку", () => {
    const ride = { ...rideOf(), returnAt: "2026-01-15T09:59:00+02:00" };
    assertQuoteError(() => quote(ride, standard, { zones: testZones }), /returnAt is before pickupAt/);
  });

  test("невідомий тип велосипеда, зокрема ключі прототипу", () => {
    // ride будуємо вручну: у rideOf undefined підмінився б значенням за замовчуванням
    for (const bike of ["scooter", undefined, "constructor", "toString"]) {
      const ride = { ...rideOf({ minutes: 10 }), bike };
      assertQuoteError(() => quote(ride, standard, { zones: testZones }), /unknown bike type/);
    }
  });

  test("невідома станція повернення", () => {
    assertQuoteError(() => price({ returnStation: "NOPE" }), /unknown station: NOPE/);
  });

  test("невідомий тип райдера", () => {
    // quote викликаємо напряму: у price undefined підмінився б на standard
    assertQuoteError(() => quote(rideOf({ minutes: 10 }), undefined, { zones: testZones }), /unknown rider type: undefined/);
    assertQuoteError(() => quote(rideOf({ minutes: 10 }), null, { zones: testZones }), /unknown rider type: undefined/);
    assertQuoteError(() => price({ minutes: 10 }, {}), /unknown rider type/);
    assertQuoteError(() => price({ minutes: 10 }, { type: "vip" }), /unknown rider type: vip/);
  });
});

describe("інваріанти чека на сітці сценаріїв", () => {
  test("total = timeCharge − знижки + збори; знижки додатні; час до сплати в межах [0; 300 грн]", () => {
    const riders = [standard, reduced, subscriber, concession];
    let checked = 0;
    for (const minutes of [0, 1, 2, 30, 31, 45, 46, 75, 76, 200, 361, 1440, 1441]) {
      for (const bike of ["classic", "ebike"]) {
        for (const rider of riders) {
          for (const returnStation of ["IN", "OUT"]) {
            for (const pickupAt of [DAYTIME, NIGHT]) {
              const r = price({ pickupAt, minutes, bike, returnStation }, rider);
              const label = JSON.stringify({ pickupAt, minutes, bike, rider, returnStation });
              assert.equal(r.total, r.timeCharge - sum(r.discounts) + sum(r.fees), label);
              assert.ok(r.discounts.every((d) => d.amount > 0), label);
              const due = r.timeCharge - sum(r.discounts);
              assert.ok(due >= 0 && due <= 30000, label);
              const planCodes = r.discounts.filter((d) => d.code === "subscription" || d.code === "reduced");
              assert.ok(planCodes.length <= 1, label);
              checked++;
            }
          }
        }
      }
    }
    assert.equal(checked, 13 * 2 * 4 * 2 * 2);
  });
});

describe("звірити зі специфікацією: поточна поведінка, схожа на дефект", () => {
  test("доба денного ліміту — за UTC, а нічна знижка — за Києвом", () => {
    const dayCap = createDayCap();
    const r1 = { type: "standard", id: "r1" };
    price({ pickupAt: "2026-01-15T12:00:00+02:00", minutes: 400 }, r1, { dayCap }); // вичерпали ліміт 15.01

    // 01:00 за Києвом 16.01 = 23:00 UTC 15.01 → поїздка йде у ліміт 15.01 і стає безкоштовною
    const at0100 = price({ pickupAt: "2026-01-16T01:00:00+02:00", minutes: 20 }, r1, { dayCap });
    assert.deepEqual(at0100.discounts, [
      { code: "night", amount: 750 },
      { code: "day-cap", amount: 1750 },
    ]);
    assert.equal(at0100.total, 0);
    assert.equal(dayCap.chargedOn("r1", "2026-01-16"), 0);

    // 02:00 за Києвом того ж 16.01 = 00:00 UTC 16.01 → уже нова доба, поїздка платна
    const at0200 = price({ pickupAt: "2026-01-16T02:00:00+02:00", minutes: 20 }, r1, { dayCap });
    assert.equal(at0200.total, 1750);
  });

  test("пільговик за безкоштовну (до 2 хв) поїздку платить збір повністю", () => {
    // при 0 нарахування знижка «reduced» = 0, тож обирається план «none», і збір не зменшується
    const free = price({ minutes: 1, returnStation: "OUT" }, reduced);
    assert.deepEqual(free.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(free.total, 15000);

    const paid = price({ minutes: 2, returnStation: "OUT" }, reduced);
    assert.deepEqual(paid.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(paid.total, 8750);
  });

  test("абонент із пільгою: план обирається лише за погодинним нарахуванням, без урахування зборів", () => {
    // абонемент: 0 за час + 150 грн збору = 150 грн; пільга дала б 25 + 75 = 100 грн
    const result = price({ minutes: 45, returnStation: "OUT" }, concession);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 15000);
  });

  test("абонент із пільгою: за рівних знижок обирається абонемент (і збір не зменшується)", () => {
    const result = price({ minutes: 50, returnStation: "OUT" }, concession);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
  });

  test("неіснуюча календарна дата (30 лютого) приймається без помилки", () => {
    const ride = {
      pickupAt: "2026-02-30T10:00:00+02:00",
      returnAt: "2026-02-30T10:20:00+02:00",
      bike: "classic",
      returnStation: "IN",
    };
    assert.equal(quote(ride, standard, { zones: testZones }).minutes, 20);
  });
});
