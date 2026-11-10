// Розділ 4 — некоректні дані. Кейси TC-77…TC-81 з docs/test-cases.md.
// Текст пояснення специфікація не задає: перевіряються відмова і непорожнє пояснення.
import test from "node:test";
import { quote } from "../../src/tariff.js";
import { ST, assertRefused, at } from "./support.js";

const ROWS = [
  {
    id: "TC-77",
    name: "повернення раніше взяття: 10:00:01 → 10:00:00",
    ride: { pickupAt: at("10:00:01"), returnAt: at("10:00:00"), bike: "classic", returnStation: "S01" },
    rider: ST,
  },
  {
    id: "TC-78",
    name: "невідомий тип велосипеда «самокат»",
    ride: { pickupAt: at("10:00"), returnAt: at("10:30"), bike: "самокат", returnStation: "S01" },
    rider: ST,
  },
  {
    id: "TC-79",
    name: "невідома категорія користувача «VIP»",
    ride: { pickupAt: at("10:00"), returnAt: at("10:30"), bike: "classic", returnStation: "S01" },
    rider: { type: "VIP" },
  },
  {
    id: "TC-80",
    name: "станції повернення S09 немає в додатку А",
    ride: { pickupAt: at("10:00"), returnAt: at("10:30"), bike: "classic", returnStation: "S09" },
    rider: ST,
  },
  {
    id: "TC-81",
    name: "станцію повернення не вказано",
    ride: { pickupAt: at("10:00"), returnAt: at("10:30"), bike: "classic" },
    rider: ST,
  },
];

for (const row of ROWS) {
  test(`Розд. 4: ${row.id} ${row.name} → відмова з поясненням`, () => {
    assertRefused(() => quote(row.ride, row.rider));
  });
}
