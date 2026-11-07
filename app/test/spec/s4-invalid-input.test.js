// §4 (некоректні дані) — docs/test-cases.md TC-V-01…TC-V-05.
// Текст пояснення специфікація не визначає (Q-11): перевіряється лише «відхилено, розрахунку немає».
import test from "node:test";
import { STANDARD, assertQuote, assertRejected, price, ride } from "../helpers/spec.js";

// "решта як у TC-11": стандартний, класичний, 16.09 10:00 → 10:50, S01
const TC11 = ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:50:00+03:00");

const rejected = [
  { id: "TC-V-01", title: "повернення на 1 с раніше за взяття",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T09:59:59+03:00"), rider: STANDARD },
  { id: "TC-V-03", title: "невідомий тип велосипеда «тандем»",
    ride: { ...TC11, bike: "tandem" }, rider: STANDARD },
  { id: "TC-V-04", title: "невідома категорія «корпоративний»",
    ride: TC11, rider: { type: "corporate" } },
  { id: "TC-V-05", title: "станції повернення X04 немає в додатку А",
    ride: { ...TC11, returnStation: "X04" }, rider: STANDARD },
];

for (const c of rejected) {
  test(`§4: ${c.id} ${c.title} — запит відхилено`, () => {
    assertRejected(() => price(c.ride, c.rider));
  });
}

test("§4 (+T2): TC-V-02 взяття = повернення — не відхиляється, 0 хв, до сплати 0", () => {
  const q = price(ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:00:00+03:00"));
  assertQuote(q, { minutes: 0, total: 0 });
});
