// Автоматизація тест-кейсів TC-40…TC-43 з docs/test-cases.md (правило T9).
// Оракул очікувань — docs/test-cases.md і docs/spec/tariffs.md.

import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { discount, quote } from "../../src/tariff.js";

const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;
const plus = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

// Рядок чека — «мітка … сума», тож сума завжди йде після пробілу.
const linesEndingWith = (lines, amount) => lines.filter((line) => line.endsWith(` ${amount}`));

const cases = [
  {
    tc: "TC-40",
    name: "чек для поїздки з TC-39 — останній рядок «До сплати» на 2 450,00 грн (кома, тисячі через пробіл)",
    ride: { minutes: 25 * 60, bike: "classic", returnStation: "X03" },
    rider: { type: "standard" },
    due: "2 450,00 грн",
  },
  {
    tc: "TC-41",
    name: "чек для поїздки з TC-34 — тривалість, погодинне нарахування, окремий рядок збору, підсумок",
    ride: { minutes: 20, bike: "classic", returnStation: "X01" },
    rider: { type: "standard" },
    duration: 20,
    timeCharge: "25,00 грн",
    items: ["150,00 грн"],
    due: "175,00 грн",
  },
  {
    tc: "TC-42",
    name: "чек для поїздки з TC-21 — окремий рядок знижки зі знаком мінус",
    ride: { minutes: 40, bike: "classic", returnStation: "S01" },
    rider: { type: "reduced" },
    duration: 40,
    timeCharge: "50,00 грн",
    items: ["-25,00 грн"],
    due: "25,00 грн",
  },
];

for (const c of cases) {
  test(`T9 (${c.tc}): ${c.name}`, () => {
    const pickupAt = at("10:00:00");
    const result = quote(
      { pickupAt, returnAt: plus(pickupAt, c.ride.minutes), bike: c.ride.bike, returnStation: c.ride.returnStation },
      c.rider,
    );
    const lines = formatReceipt(result);
    const shown = lines.join(" | ");

    if (c.duration !== undefined) {
      assert.equal(lines[0], `Тривалість поїздки: ${c.duration} хв`, `рядок тривалості: ${shown}`);
    }
    if (c.timeCharge) {
      const timeChargeLines = linesEndingWith(lines, c.timeCharge).filter((line) =>
        line.startsWith("Погодинне нарахування"),
      );
      assert.equal(timeChargeLines.length, 1, `рядок погодинного нарахування ${c.timeCharge}: ${shown}`);
    }
    for (const amount of c.items ?? []) {
      assert.equal(linesEndingWith(lines, amount).length, 1, `окремий рядок на ${amount}: ${shown}`);
    }

    const last = lines.at(-1);
    assert.ok(last.startsWith("До сплати"), `останній рядок чека — «До сплати»: ${shown}`);
    assert.ok(last.endsWith(` ${c.due}`), `останній рядок чека — ${c.due}: ${shown}`);
  });
}

test("T9 (TC-43): знижка 30 % від 1235 коп. → до сплати 864 коп. (округлення вниз), знижка 371 коп.", () => {
  const timeCharge = 1235;
  const amount = discount(timeCharge, 30);
  assert.equal(amount, 371, "сума знижки");
  assert.equal(timeCharge - amount, 864, "до сплати після знижки");
});
