import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createDayCap } from "../../app/src/day-cap.js";
import { QuoteError, discount, quote } from "../../app/src/tariff.js";

// 12:00 за Києвом: нічна знижка не діє, доба UTC і київська збігаються.
const NOON = "2026-01-15T10:00:00Z";

const STANDARD = { type: "standard" };
const REDUCED = { type: "reduced" };
const SUBSCRIBER = { type: "subscriber" };
const CONCESSION = { type: "subscriber", concession: true };

/** Поїздка заданої тривалості; решту полів можна перевизначити. */
function ride(minutes, { pickupAt = NOON, bike = "classic", returnStation = "S01" } = {}) {
  const returnAt = new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString();
  return { pickupAt, returnAt, bike, returnStation };
}

function withStandard(rideFields) {
  return quote({ bike: "classic", returnStation: "S01", ...rideFields }, STANDARD);
}

function assertQuoteError(fn, message) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof QuoteError, `очікували QuoteError, отримали ${err}`);
    assert.match(err.message, message);
    return true;
  });
}

describe("discount", () => {
  const cases = [
    { amount: 2500, percent: 30, expected: 750 },
    { amount: 1000, percent: 0, expected: 0 },
    { amount: 1000, percent: 100, expected: 1000 },
    { amount: 0, percent: 30, expected: 0 },
    // До сплати округлюється вниз, тому заокруглення йде на користь райдера.
    { amount: 333, percent: 50, expected: 167 },
    { amount: 999, percent: 30, expected: 300 },
    { amount: 1, percent: 50, expected: 1 },
  ];

  for (const { amount, percent, expected } of cases) {
    test(`${percent}% від ${amount} = ${expected}`, () => {
      assert.equal(discount(amount, percent), expected);
    });
  }
});

describe("погодинне нарахування", () => {
  const cases = [
    { minutes: 0, bike: "classic", timeCharge: 0 },
    { minutes: 1, bike: "classic", timeCharge: 0 },
    { minutes: 2, bike: "classic", timeCharge: 2500 },
    { minutes: 30, bike: "classic", timeCharge: 2500 },
    { minutes: 31, bike: "classic", timeCharge: 5000 },
    { minutes: 60, bike: "classic", timeCharge: 5000 },
    { minutes: 61, bike: "classic", timeCharge: 7500 },
    { minutes: 1, bike: "ebike", timeCharge: 0 },
    { minutes: 2, bike: "ebike", timeCharge: 4000 },
    { minutes: 30, bike: "ebike", timeCharge: 4000 },
    { minutes: 31, bike: "ebike", timeCharge: 8000 },
  ];

  for (const { minutes, bike, timeCharge } of cases) {
    test(`${bike}, ${minutes} хв → ${timeCharge}`, () => {
      assert.deepEqual(quote(ride(minutes, { bike }), STANDARD), {
        minutes,
        timeCharge,
        discounts: [],
        fees: [],
        total: timeCharge,
      });
    });
  }
});

describe("тривалість і формат часу", () => {
  test("рахує тривалість між різними зміщеннями", () => {
    const result = withStandard({
      pickupAt: "2026-01-15T12:00:00+02:00",
      returnAt: "2026-01-15T10:30:00Z",
    });
    assert.equal(result.minutes, 30);
  });

  test("рахує реальну тривалість через перехід на літній час", () => {
    const result = withStandard({
      pickupAt: "2026-03-29T02:30:00+02:00",
      returnAt: "2026-03-29T04:30:00+03:00",
    });
    assert.equal(result.minutes, 60);
  });

  test("приймає час без секунд і з дробовими секундами", () => {
    const result = withStandard({
      pickupAt: "2026-01-15T10:00Z",
      returnAt: "2026-01-15T10:30:00.000Z",
    });
    assert.equal(result.minutes, 30);
  });

  test("повернення в момент видачі дає нульову поїздку", () => {
    const result = withStandard({ pickupAt: NOON, returnAt: NOON });
    assert.equal(result.minutes, 0);
    assert.equal(result.total, 0);
  });
});

describe("пільговий тариф", () => {
  test("знімає половину нарахування", () => {
    assert.deepEqual(quote(ride(60), REDUCED), {
      minutes: 60,
      timeCharge: 5000,
      discounts: [{ code: "reduced", amount: 2500 }],
      fees: [],
      total: 2500,
    });
  });

  test("діє і на електровелосипед", () => {
    const result = quote(ride(30, { bike: "ebike" }), REDUCED);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 2000 }]);
    assert.equal(result.total, 2000);
  });

  test("зменшує збір за повернення поза зоною вдвічі", () => {
    const result = quote(ride(30, { returnStation: "X01" }), REDUCED);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(result.total, 8750);
  });

  test("зменшує обидва збори вдвічі, а денний ліміт застосовує після знижки", () => {
    assert.deepEqual(quote(ride(1441, { returnStation: "X01" }), REDUCED), {
      minutes: 1441,
      timeCharge: 122500,
      discounts: [
        { code: "reduced", amount: 61250 },
        { code: "day-cap", amount: 31250 },
      ],
      fees: [
        { code: "out-of-zone", amount: 7500 },
        { code: "unreturned", amount: 100000 },
      ],
      total: 137500,
    });
  });

  test("прапорець concession не дає знижки стандартному райдеру", () => {
    const result = quote(ride(30), { type: "standard", concession: true });
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 2500);
  });
});

describe("абонемент", () => {
  const cases = [
    { minutes: 1, bike: "classic", timeCharge: 0, amount: 0, total: 0 },
    { minutes: 45, bike: "classic", timeCharge: 5000, amount: 5000, total: 0 },
    { minutes: 46, bike: "classic", timeCharge: 5000, amount: 2500, total: 2500 },
    { minutes: 75, bike: "classic", timeCharge: 7500, amount: 5000, total: 2500 },
    { minutes: 76, bike: "classic", timeCharge: 7500, amount: 2500, total: 5000 },
    { minutes: 45, bike: "ebike", timeCharge: 8000, amount: 8000, total: 0 },
    // Блоки після 45 хв, мінус 20% для електровелосипеда: 4000 → 3200.
    { minutes: 46, bike: "ebike", timeCharge: 8000, amount: 4800, total: 3200 },
    { minutes: 76, bike: "ebike", timeCharge: 12000, amount: 5600, total: 6400 },
  ];

  for (const { minutes, bike, timeCharge, amount, total } of cases) {
    test(`${bike}, ${minutes} хв → до сплати ${total}`, () => {
      const result = quote(ride(minutes, { bike }), SUBSCRIBER);
      assert.equal(result.timeCharge, timeCharge);
      assert.deepEqual(result.discounts, amount > 0 ? [{ code: "subscription", amount }] : []);
      assert.equal(result.total, total);
    });
  }

  test("не зменшує збір за повернення поза зоною", () => {
    const result = quote(ride(30, { returnStation: "X01" }), SUBSCRIBER);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 15000);
  });
});

describe("абонемент із правом на пільгу", () => {
  test("коротка поїздка: абонемент вигідніший", () => {
    const result = quote(ride(30), CONCESSION);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 0);
  });

  test("довга поїздка: пільга вигідніша", () => {
    const result = quote(ride(120), CONCESSION);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 5000 }]);
    assert.equal(result.total, 5000);
  });

  test("довга поїздка на електровелосипеді: пільга вигідніша", () => {
    const result = quote(ride(120, { bike: "ebike" }), CONCESSION);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 8000 }]);
    assert.equal(result.total, 8000);
  });

  test("коли переміг пільговий план, збір зменшується вдвічі", () => {
    const result = quote(ride(120, { returnStation: "X01" }), CONCESSION);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(result.total, 12500);
  });

  for (const concession of ["true", 1]) {
    test(`concession = ${JSON.stringify(concession)} не вважається правом на пільгу`, () => {
      const result = quote(ride(120), { type: "subscriber", concession });
      assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    });
  }
});

describe("нічна знижка", () => {
  const boundaries = [
    { label: "зима, 05:59 за Києвом", pickupAt: "2026-01-15T03:59:00Z", night: true },
    { label: "зима, 06:00 за Києвом", pickupAt: "2026-01-15T04:00:00Z", night: false },
    { label: "зима, 00:00 за Києвом", pickupAt: "2026-01-15T22:00:00Z", night: true },
    { label: "зима, 23:59 за Києвом", pickupAt: "2026-01-15T21:59:00Z", night: false },
    { label: "літо, 05:59 за Києвом", pickupAt: "2026-07-15T02:59:00Z", night: true },
    { label: "літо, 06:00 за Києвом", pickupAt: "2026-07-15T03:00:00Z", night: false },
  ];

  for (const { label, pickupAt, night } of boundaries) {
    test(`${label}: ${night ? "діє" : "не діє"}`, () => {
      const result = quote(ride(30, { pickupAt }), STANDARD);
      assert.deepEqual(result.discounts, night ? [{ code: "night", amount: 750 }] : []);
      assert.equal(result.total, night ? 1750 : 2500);
    });
  }

  test("визначається за часом видачі, а не повернення", () => {
    const result = quote(ride(30, { pickupAt: "2026-01-15T03:50:00Z" }), STANDARD);
    assert.equal(result.total, 1750);
  });

  test("рахується від суми після пільги", () => {
    const result = quote(ride(30, { pickupAt: "2026-01-15T02:00:00Z" }), REDUCED);
    assert.deepEqual(result.discounts, [
      { code: "reduced", amount: 1250 },
      { code: "night", amount: 375 },
    ]);
    assert.equal(result.total, 875);
  });

  test("рахується від суми після абонемента", () => {
    const result = quote(ride(46, { pickupAt: "2026-01-15T02:00:00Z", bike: "ebike" }), SUBSCRIBER);
    assert.deepEqual(result.discounts, [
      { code: "subscription", amount: 4800 },
      { code: "night", amount: 960 },
    ]);
    assert.equal(result.total, 2240);
  });

  test("не з'являється, коли до сплати вже нуль", () => {
    const result = quote(ride(30, { pickupAt: "2026-01-15T02:00:00Z" }), SUBSCRIBER);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
  });

  test("не з'являється на безкоштовній поїздці", () => {
    const result = quote(ride(1, { pickupAt: "2026-01-15T02:00:00Z" }), STANDARD);
    assert.deepEqual(result.discounts, []);
  });

  test("не зменшує збори", () => {
    const result = quote(ride(30, { pickupAt: "2026-01-15T02:00:00Z", returnStation: "X01" }), STANDARD);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 16750);
  });

  test("застосовується до денного ліміту: сума під лімітом його не зачіпає", () => {
    const result = quote(ride(400, { pickupAt: "2026-01-15T02:00:00Z" }), STANDARD);
    assert.deepEqual(result.discounts, [{ code: "night", amount: 10500 }]);
    assert.equal(result.total, 24500);
  });
});

describe("збори", () => {
  test("станція в зоні не дає збору", () => {
    assert.deepEqual(quote(ride(30, { returnStation: "S08" }), STANDARD).fees, []);
  });

  test("повернення поза зоною додає 15000 до суми", () => {
    const result = quote(ride(30, { returnStation: "X03" }), STANDARD);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 17500);
  });

  test("рівно 24 години: збору за неповернення немає", () => {
    const result = quote(ride(1440), STANDARD);
    assert.deepEqual(result.fees, []);
    assert.equal(result.total, 30000);
  });

  test("24 години і 1 хвилина: збір є і не обмежується денним лімітом", () => {
    assert.deepEqual(quote(ride(1441), STANDARD), {
      minutes: 1441,
      timeCharge: 122500,
      discounts: [{ code: "day-cap", amount: 92500 }],
      fees: [{ code: "unreturned", amount: 200000 }],
      total: 230000,
    });
  });

  test("обидва збори додаються", () => {
    const result = quote(ride(1441, { returnStation: "X01" }), STANDARD);
    assert.deepEqual(result.fees, [
      { code: "out-of-zone", amount: 15000 },
      { code: "unreturned", amount: 200000 },
    ]);
    assert.equal(result.total, 245000);
  });
});

describe("денний ліміт без журналу", () => {
  test("рівно на ліміті знижки немає", () => {
    const result = quote(ride(360), STANDARD);
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 30000);
  });

  test("понад ліміт різниця йде знижкою day-cap", () => {
    const result = quote(ride(361), STANDARD);
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(result.total, 30000);
  });

  test("діє і на електровелосипед", () => {
    const result = quote(ride(240, { bike: "ebike" }), STANDARD);
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2000 }]);
    assert.equal(result.total, 30000);
  });

  test("застосовується після нічної знижки", () => {
    const result = quote(ride(1441, { pickupAt: "2026-01-15T02:00:00Z" }), STANDARD);
    assert.deepEqual(result.discounts, [
      { code: "night", amount: 36750 },
      { code: "day-cap", amount: 55750 },
    ]);
    assert.equal(result.total, 230000);
  });

  test("поїздки не накопичуються між викликами", () => {
    assert.equal(quote(ride(361), { type: "standard", id: "r1" }).total, 30000);
    assert.equal(quote(ride(361), { type: "standard", id: "r1" }).total, 30000);
  });
});

describe("денний ліміт із журналом", () => {
  const rider = { type: "standard", id: "r1" };

  test("вимагає rider.id", () => {
    assertQuoteError(() => quote(ride(30), STANDARD, { dayCap: createDayCap() }), /rider\.id is required/);
  });

  test("записує нарахування на день видачі", () => {
    const dayCap = createDayCap();
    quote(ride(30), rider, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 2500);
  });

  test("записує суму після знижок", () => {
    const dayCap = createDayCap();
    quote(ride(46), { type: "subscriber", id: "r1" }, { dayCap });
    quote(ride(30, { pickupAt: "2026-01-15T02:00:00Z" }), rider, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 2500 + 1750);
  });

  test("не записує збори", () => {
    const dayCap = createDayCap();
    const result = quote(ride(30, { returnStation: "X01" }), rider, { dayCap });
    assert.equal(result.total, 17500);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 2500);
  });

  test("частково вичерпаний ліміт обмежує наступну поїздку", () => {
    const dayCap = createDayCap();
    dayCap.record("r1", NOON, 29000);
    const result = quote(ride(30), rider, { dayCap });
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 1500 }]);
    assert.equal(result.total, 1000);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 30000);
  });

  test("після вичерпання ліміту час безкоштовний, а збір лишається", () => {
    const dayCap = createDayCap();
    assert.equal(quote(ride(361), rider, { dayCap }).total, 30000);
    const result = quote(ride(30, { returnStation: "X01" }), rider, { dayCap });
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(result.total, 15000);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 30000);
  });

  test("наступного дня ліміт новий", () => {
    const dayCap = createDayCap();
    quote(ride(361), rider, { dayCap });
    const result = quote(ride(30, { pickupAt: "2026-01-16T10:00:00Z" }), rider, { dayCap });
    assert.equal(result.total, 2500);
  });

  test("інший райдер має власний ліміт", () => {
    const dayCap = createDayCap();
    quote(ride(361), rider, { dayCap });
    const result = quote(ride(30), { type: "standard", id: "r2" }, { dayCap });
    assert.equal(result.total, 2500);
  });

  test("поважає власний ліміт журналу", () => {
    const result = quote(ride(60), rider, { dayCap: createDayCap({ limit: 3000 }) });
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2000 }]);
    assert.equal(result.total, 3000);
  });

  test("поїздка через північ записується на день видачі", () => {
    const dayCap = createDayCap();
    quote(ride(1441), rider, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 30000);
    assert.equal(dayCap.chargedOn("r1", "2026-01-16"), 0);
  });

  test("невалідна поїздка нічого не записує", () => {
    const dayCap = createDayCap();
    assert.throws(() => quote(ride(30, { returnStation: "S99" }), rider, { dayCap }), QuoteError);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 0);
  });
});

describe("зони", () => {
  test("використовує передану таблицю зон", () => {
    const zones = { zoneOf: (id) => (id === "A" ? "out" : null) };
    const result = quote(ride(30, { returnStation: "A" }), STANDARD, { zones });
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
  });

  test("станція, якої немає в переданій таблиці, — помилка", () => {
    const zones = { zoneOf: () => null };
    assertQuoteError(() => quote(ride(30), STANDARD, { zones }), /unknown station: S01/);
  });
});

describe("перевірка вхідних даних", () => {
  test("QuoteError — це Error з іменем QuoteError", () => {
    const err = new QuoteError("x");
    assert.ok(err instanceof Error);
    assert.equal(err.name, "QuoteError");
    assert.equal(err.message, "x");
  });

  for (const value of [null, undefined, "ride"]) {
    test(`ride = ${JSON.stringify(value)} відхиляється`, () => {
      assertQuoteError(() => quote(value, STANDARD), /ride is required/);
    });
  }

  const badDateTimes = [
    { label: "без значення", value: undefined },
    { label: "число", value: 1768471200000 },
    { label: "лише дата", value: "2026-01-15" },
    { label: "без зміщення", value: "2026-01-15T10:00:00" },
    { label: "не дата", value: "вчора" },
  ];

  for (const { label, value } of badDateTimes) {
    test(`pickupAt: ${label} — відхиляється`, () => {
      assertQuoteError(
        () => quote({ ...ride(30), pickupAt: value }, STANDARD),
        /pickupAt must be an ISO 8601 date-time with an offset/,
      );
    });

    test(`returnAt: ${label} — відхиляється`, () => {
      assertQuoteError(
        () => quote({ ...ride(30), returnAt: value }, STANDARD),
        /returnAt must be an ISO 8601 date-time with an offset/,
      );
    });
  }

  for (const value of ["2026-13-01T10:00:00Z", "2026-01-15T25:00:00Z"]) {
    test(`${value} має правильний формат, але не є датою`, () => {
      assertQuoteError(() => quote({ ...ride(30), pickupAt: value }, STANDARD), /pickupAt is not a valid date-time/);
    });
  }

  test("повернення раніше за видачу відхиляється", () => {
    assertQuoteError(
      () => withStandard({ pickupAt: NOON, returnAt: "2026-01-15T09:59:59Z" }),
      /returnAt is before pickupAt/,
    );
  });

  for (const bike of ["scooter", "toString", null]) {
    test(`bike = ${bike} відхиляється`, () => {
      assertQuoteError(() => quote(ride(30, { bike }), STANDARD), /unknown bike type/);
    });
  }

  for (const station of ["S99", "toString"]) {
    test(`станція ${station} відхиляється`, () => {
      assertQuoteError(() => quote(ride(30, { returnStation: station }), STANDARD), /unknown station/);
    });
  }

  for (const rider of [null, undefined, {}, { type: "vip" }, { type: "toString" }]) {
    test(`rider = ${JSON.stringify(rider)} відхиляється`, () => {
      assertQuoteError(() => quote(ride(30), rider), /unknown rider type/);
    });
  }
});

// Фіксує те, що код робить зараз. Значення взяті з коду; з app/src/ не можна встановити,
// чи це задумане правило, чи дефект. Перед тим як покладатися на ці тести, їх слід
// звірити з docs/spec/tariffs.md: якщо правило інше, змінюються і код, і тест.
describe("[не звірено зі специфікацією] поточна поведінка", () => {
  describe("тривалість округлюється до найближчої хвилини", () => {
    const at = (duration) => `2026-01-15T${duration}Z`;
    const cases = [
      { returnAt: at("10:01:29"), minutes: 1, timeCharge: 0 },
      { returnAt: at("10:01:30"), minutes: 2, timeCharge: 2500 },
      { returnAt: at("10:30:29"), minutes: 30, timeCharge: 2500 },
      { returnAt: at("10:30:30"), minutes: 31, timeCharge: 5000 },
    ];

    for (const { returnAt, minutes, timeCharge } of cases) {
      test(`видача 10:00:00, повернення ${returnAt} → ${minutes} хв`, () => {
        const result = withStandard({ pickupAt: NOON, returnAt });
        assert.equal(result.minutes, minutes);
        assert.equal(result.timeCharge, timeCharge);
      });
    }

    test("24 год 0 хв 29 с: збору за неповернення немає", () => {
      const result = withStandard({ pickupAt: NOON, returnAt: "2026-01-16T10:00:29Z" });
      assert.deepEqual(result.fees, []);
    });

    test("24 год 0 хв 30 с: збір за неповернення є", () => {
      const result = withStandard({ pickupAt: NOON, returnAt: "2026-01-16T10:00:30Z" });
      assert.deepEqual(result.fees, [{ code: "unreturned", amount: 200000 }]);
    });
  });

  test("доба журналу — UTC: 00:30 за Києвом 16 січня записується на 15 січня", () => {
    const dayCap = createDayCap();
    const rider = { type: "standard", id: "r1" };
    const result = quote(ride(600, { pickupAt: "2026-01-15T22:30:00Z" }), rider, { dayCap });
    assert.equal(result.total, 30000);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 30000);
    assert.equal(dayCap.chargedOn("r1", "2026-01-16"), 0);
  });

  test("доба журналу — UTC: у межах однієї київської доби ліміт відкривається знову", () => {
    const dayCap = createDayCap();
    const rider = { type: "standard", id: "r1" };
    quote(ride(600, { pickupAt: "2026-01-15T22:30:00Z" }), rider, { dayCap });
    const later = quote(ride(30, { pickupAt: "2026-01-16T10:00:00Z" }), rider, { dayCap });
    assert.deepEqual(later.discounts, []);
    assert.equal(later.total, 2500);
  });

  test("пільговик платить повний збір, якщо поїздка коротша за 2 хв", () => {
    const short = quote(ride(1, { returnStation: "X01" }), REDUCED);
    assert.deepEqual(short.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(short.total, 15000);

    const longer = quote(ride(2, { returnStation: "X01" }), REDUCED);
    assert.deepEqual(longer.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(longer.total, 8750);
  });

  test("план обирається лише за часом: абонемент із пільгою платить більше через збір", () => {
    // Пільговий план дав би 1250 + 7500 = 8750, а обрано абонемент: 0 + 15000.
    const result = quote(ride(30, { returnStation: "X01" }), CONCESSION);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 15000);
  });

  test("за рівної знижки перемагає абонемент, і збір не зменшується", () => {
    const result = quote(ride(46, { returnStation: "X01" }), CONCESSION);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 17500);
  });

  test("rider.id = 0 вважається відсутнім", () => {
    assert.throws(
      () => quote(ride(30), { type: "standard", id: 0 }, { dayCap: createDayCap() }),
      /rider\.id is required/,
    );
  });
});
