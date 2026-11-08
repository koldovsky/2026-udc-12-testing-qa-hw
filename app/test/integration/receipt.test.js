// quote() and formatReceipt() together, the way the API uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
import { SEED, randomRider, randomRides } from "../helpers/factory.js";

const PRICE = { classic: 2500, ebike: 4000 };
const uah = (kopecks) => `${(kopecks / 100).toFixed(2).replace(".", ",")} грн`;

// T3 (docs/spec/tariffs.md:62): плата нараховується за кожні **розпочаті** 30 хвилин, тож
// блоків — `ceil(minutes / 30)`. Попередня формула `floor(minutes / 30) + 1` давала на один
// блок більше для тривалостей, кратних 30 (рівно 30 хв → 2 блоки замість 1), і саме через
// неї тест падав, коли фабрика випадково видавала 30 або 60 хвилин.
const blocks = (minutes) => Math.ceil(minutes / 30);

// Рядок чека — «мітка ... сума» (`app/src/receipt.js:35`), тож суму відділяє остання група
// точок. Витягаємо саму суму й порівнюємо її точно: `endsWith` тут дав би хибний збіг, бо
// тисячі в сумі відокремлює пробіл — рядок на «2 425,00 грн» закінчується й на
// « 425,00 грн» (запах № 14 у `docs/test-quality.md`).
const amountOf = (line) => {
  const match = /^.+ \.{3,} (.+)$/.exec(line);
  assert.ok(match, `рядок чека не має вигляду «мітка ... сума»: "${line}"`);
  return match[1];
};

// Фабрика дає поїздки 5–89 хв, у зоні, вдень і без журналу денного ліміту, тож до сплати —
// рівно погодинне нарахування за T3: без T2, T4, T5, T6, T7, T8 і T10.
const dueFor = (ride, minutes) => blocks(minutes) * PRICE[ride.bike];

test("every receipt of a week of rides ends with the amount due", () => {
  const rider = randomRider();
  for (const ride of randomRides(10)) {
    const minutes = (Date.parse(ride.returnAt) - Date.parse(ride.pickupAt)) / 60_000;
    const expected = dueFor(ride, minutes);

    const lines = formatReceipt(quote(ride, rider));

    assert.ok(lines.at(-1).startsWith("До сплати "));
    assert.equal(
      amountOf(lines.at(-1)),
      uah(expected),
      `TEST_SEED=${SEED}: ${ride.bike}, ${minutes} min from ${ride.pickupAt}: got "${lines.at(-1)}", expected ${uah(expected)}`,
    );
  }
});

// Межі блоків перевіряються **щоразу**, а не тоді, коли їх випадково видасть фабрика:
// рівно 30 і рівно 60 хвилин — ті самі значення, на яких тест падав до виправлення.
test("T3: receipts at the exact block boundaries — 29, 30, 31, 59, 60, 61 min", () => {
  const rider = { id: "rider-boundaries", type: "standard" };
  const cases = [
    { minutes: 29, classic: 2500, ebike: 4000 },
    { minutes: 30, classic: 2500, ebike: 4000 },
    { minutes: 31, classic: 5000, ebike: 8000 },
    { minutes: 59, classic: 5000, ebike: 8000 },
    { minutes: 60, classic: 5000, ebike: 8000 },
    { minutes: 61, classic: 7500, ebike: 12000 },
  ];
  for (const { minutes, ...prices } of cases) {
    for (const bike of ["classic", "ebike"]) {
      // Оракул самого тесту теж прив'язаний до чисел зі специфікації: якщо хтось повернe
      // `floor(minutes / 30) + 1`, цей рядок почервоніє одразу, а не раз на п'ять прогонів.
      assert.equal(
        blocks(minutes) * PRICE[bike],
        prices[bike],
        `оракул тесту для ${bike}, ${minutes} хв розійшовся з T3`,
      );
      const pickupAt = "2026-09-21T09:00:00+03:00";
      const ride = {
        pickupAt,
        returnAt: new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString(),
        bike,
        returnStation: "S01",
      };
      const lines = formatReceipt(quote(ride, rider));
      assert.equal(
        amountOf(lines.at(-1)),
        uah(prices[bike]),
        `${bike}, ${minutes} хв: got "${lines.at(-1)}", expected ${uah(prices[bike])}`,
      );
    }
  }
});

test("a receipt lists the fee for a return outside the zone", () => {
  const ride = {
    pickupAt: "2026-09-21T07:15:00Z",
    returnAt: "2026-09-21T07:35:00Z",
    bike: "classic",
    returnStation: "X02",
  };

  const lines = formatReceipt(quote(ride, randomRider()));

  assert.deepEqual(lines, [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ]);
});
