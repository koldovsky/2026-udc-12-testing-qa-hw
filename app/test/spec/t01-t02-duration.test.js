// T1 (тривалість) і T2 (хибний старт) — docs/test-cases.md TC-01…TC-10.
import test from "node:test";
import { assertQuote, price, ride } from "../helpers/spec.js";

const cases = [
  { id: "TC-01", rule: "T1", title: "10:00:00 → 10:12:40 — 13 хв, 1 блок",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:12:40+03:00"),
    expected: { minutes: 13, timeCharge: 2500, total: 2500 } },
  { id: "TC-02", rule: "T1", title: "14:05:00 → 14:41:00 — 36 хв, 2 блоки",
    ride: ride("2026-09-16T14:05:00+03:00", "2026-09-16T14:41:00+03:00"),
    expected: { minutes: 36, timeCharge: 5000, total: 5000 } },
  { id: "TC-03", rule: "T1", title: "29 хв 59 с → 30 хв, 1 блок",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:29:59+03:00"),
    expected: { minutes: 30, timeCharge: 2500, total: 2500 } },
  { id: "TC-04", rule: "T1", title: "рівно 30 хв — 1 блок",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:30:00+03:00"),
    expected: { minutes: 30, timeCharge: 2500, total: 2500 } },
  { id: "TC-05", rule: "T1", title: "30 хв 1 с → 31 хв, 2 блоки",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:30:01+03:00"),
    expected: { minutes: 31, timeCharge: 5000, total: 5000 } },
  { id: "TC-06", rule: "T1 (+T10)", title: "перехід на зимовий час — фактичні 50 хв, нічна знижка",
    ride: ride("2026-10-25T03:30:00+03:00", "2026-10-25T03:20:00+02:00"),
    expected: { minutes: 50, timeCharge: 5000, discounts: { night: 1500 }, total: 3500 } },

  { id: "TC-07", rule: "T2", title: "рівно 2 хв — хибний старт, 0",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:02:00+03:00"),
    expected: { minutes: 2, hourly: 0, total: 0 } },
  { id: "TC-08", rule: "T2", title: "2 хв 1 с → 3 хв — не хибний старт, 1 блок",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:02:01+03:00"),
    expected: { minutes: 3, timeCharge: 2500, total: 2500 } },
  { id: "TC-09", rule: "T2", title: "50 с → 1 хв — 0",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:00:50+03:00"),
    expected: { minutes: 1, hourly: 0, total: 0 } },
  { id: "TC-10", rule: "T2 (+T7)", title: "хибний старт з поверненням на X02 — збір T7 нараховується",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:01:00+03:00", { station: "X02" }),
    expected: { hourly: 0, fees: 15000, total: 15000 } },
];

for (const c of cases) {
  test(`${c.rule}: ${c.id} ${c.title}`, () => {
    assertQuote(price(c.ride), c.expected);
  });
}
