// T7 (повернення поза зоною) і T8 (неповернений велосипед) — docs/test-cases.md TC-43…TC-53.
// TC-54 (T8 при вичерпаному ліміті) — у t06-day-cap.test.js, бо потребує історії нарахувань.
import test from "node:test";
import { REDUCED, STANDARD, SUBSCRIBER, assertQuote, price, ride } from "../helpers/spec.js";

const at = (time) => `2026-09-16T${time}+03:00`;

const IN_ZONE = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"];

const cases = [
  { id: "TC-43", rule: "T7", title: "стандартний, класичний, 20 хв, X01 — 25 + 150 грн",
    rider: STANDARD, ride: ride(at("10:00:00"), at("10:20:00"), { station: "X01" }),
    expected: { timeCharge: 2500, fees: 15000, total: 17500 } },
  { id: "TC-44", rule: "T7", title: "стандартний, електро, 40 хв, X02 — 80 + 150 грн",
    rider: STANDARD, ride: ride(at("10:00:00"), at("10:40:00"), { bike: "ebike", station: "X02" }),
    expected: { timeCharge: 8000, fees: 15000, total: 23000 } },
  { id: "TC-45", rule: "T7", title: "абонент, класичний, 40 хв, X03 — погодинне 0 + збір",
    rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("10:40:00"), { station: "X03" }),
    expected: { hourly: 0, fees: 15000, total: 15000 } },
  ...IN_ZONE.map((station) => ({
    id: "TC-46", rule: "T7", title: `повернення на ${station} (у зоні) — збору немає`,
    rider: STANDARD, ride: ride(at("10:00:00"), at("10:20:00"), { station }),
    expected: { fees: 0, total: 2500 },
  })),
  { id: "TC-47", rule: "T7 (+T5)", title: "пільговий, X01 — пільга не поширюється на збір",
    rider: REDUCED, ride: ride(at("10:00:00"), at("10:20:00"), { station: "X01" }),
    expected: { hourly: 1250, fees: 15000, total: 16250 } },
  { id: "TC-48", rule: "T7 (+T10)", title: "нічна поїздка, X02 — нічна знижка лише на погодинне",
    rider: STANDARD, ride: ride("2026-09-17T01:10:00+03:00", "2026-09-17T01:40:00+03:00", { station: "X02" }),
    expected: { discounts: { night: 750 }, hourly: 1750, fees: 15000, total: 16750 } },

  { id: "TC-49", rule: "T8 (+T6)", title: "рівно 24 год — не «понад 24 години», збору немає",
    rider: STANDARD, ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T10:00:00+03:00"),
    expected: { minutes: 1440, timeCharge: 120000, fees: 0, total: 30000 } },
  { id: "TC-50", rule: "T8 (+T6)", title: "24 год + 1 с → 1 441 хв — збір 2 000 грн",
    rider: STANDARD, ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T10:00:01+03:00"),
    expected: { minutes: 1441, timeCharge: 122500, hourly: 30000, fees: 200000, total: 230000 } },
  { id: "TC-51", rule: "T8 (+T6)", title: "25 год — ліміт 300 грн + збір 2 000 грн",
    rider: STANDARD, ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T11:00:00+03:00"),
    expected: { timeCharge: 125000, hourly: 30000, fees: 200000, total: 230000 } },
  { id: "TC-52", rule: "T8 (+T7)", title: "25 год, X03 — обидва збори незалежно",
    rider: STANDARD, ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T11:00:00+03:00", { station: "X03" }),
    expected: { hourly: 30000, fees: 215000, feeAmounts: [15000, 200000], total: 245000 } },
  { id: "TC-53", rule: "T8 (+T5)", title: "пільговий, електро, 25 год — збір T8 без знижки",
    rider: REDUCED, ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T11:00:00+03:00", { bike: "ebike" }),
    expected: { timeCharge: 200000, hourly: 30000, fees: 200000, total: 230000 } },
];

for (const c of cases) {
  test(`${c.rule}: ${c.id} ${c.title}`, () => {
    assertQuote(price(c.ride, c.rider), c.expected);
  });
}
