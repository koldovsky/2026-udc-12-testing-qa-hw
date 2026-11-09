import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";
import { formatReceipt } from "../../src/receipt.js";

const rider = { id: "tc-shared-rider", type: "standard" };
const ride = (pickupAt, returnAt, bike = "ebike", returnStation = "S03") => ({
  pickupAt,
  returnAt,
  bike,
  returnStation,
});

test("TC-12 T6: applies one daily cap across three rides", () => {
  const dayCap = createDayCap();
  const quotes = [
    quote(ride("2026-09-16T09:00:00+03:00", "2026-09-16T10:20:00+03:00"), rider, { dayCap }),
    quote(ride("2026-09-16T13:00:00+03:00", "2026-09-16T14:20:00+03:00"), rider, { dayCap }),
    quote(ride("2026-09-16T18:00:00+03:00", "2026-09-16T19:20:00+03:00"), rider, { dayCap }),
  ];

  assert.deepEqual(quotes.map(({ total }) => total), [12000, 12000, 6000]);
  assert.equal(dayCap.chargedOn(rider.id, "2026-09-16"), 30000);
});

test("TC-13 T6: assigns an overnight ride to its pickup date", () => {
  const dayCap = createDayCap();
  dayCap.record(rider.id, "2026-09-16T00:10:00+03:00", 24000);
  const result = quote(
    ride("2026-09-16T23:40:00+03:00", "2026-09-17T00:20:00+03:00"),
    rider,
    { dayCap },
  );

  assert.equal(result.timeCharge, 8000);
  assert.equal(result.total, 6000);
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2000 }]);
  assert.equal(dayCap.chargedOn(rider.id, "2026-09-16"), 30000);
});

test("TC-19 T9: receipt itemises a capped 25-hour out-of-zone ride", () => {
  const result = quote(
    ride("2026-09-16T10:00:00+03:00", "2026-09-17T11:00:00+03:00", "classic", "X01"),
    rider,
  );
  const lines = formatReceipt(result);
  const hasLine = (label, amount) => lines.some((line) => line.startsWith(label) && line.endsWith(amount));

  assert.equal(result.minutes, 1500);
  assert.equal(result.timeCharge, 125000);
  assert.equal(result.total, 245000);
  assert.ok(lines.some((line) => line.includes("Тривалість") && line.includes("1500")));
  assert.ok(hasLine("Погодинне нарахування", "1 250,00 грн"));
  assert.ok(hasLine("Денний ліміт", "-950,00 грн"));
  assert.ok(hasLine("Збір: повернення поза зоною", "150,00 грн"));
  assert.ok(hasLine("Збір: неповернений велосипед", "2 000,00 грн"));
  assert.ok(hasLine("До сплати", "2 450,00 грн"));
});
