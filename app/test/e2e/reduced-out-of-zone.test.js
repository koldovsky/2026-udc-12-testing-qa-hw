// Task E, path 1 — the AI-browser scenario (ai-runs/e-browser.md) as a deterministic e2e test.
//
// Scenario: a student with the right to the reduced fare takes a classic bike on 16.09.2026
// at 10:00 Kyiv time and at 10:40 the same day leaves it at X01 «Озеро (пляж)», outside the
// service zone. She pays 175,00 грн; the receipt shows the discount and the fee separately.
//
// The test starts the real HTTP server itself on a free port (listen(0)), talks to it with
// fetch exactly as public/index.html does, and closes it in `after`. Expected values come
// from docs/spec/tariffs.md (line numbers in comments), never from app/src.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { createHandler } from "../../src/server.js";

let server;
let baseUrl;

before(async () => {
  server = createServer(createHandler()).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  // fetch keeps idle keep-alive sockets; close them explicitly so "close" always fires.
  server.closeIdleConnections();
  await once(server, "close");
});

// The body public/index.html sends for the form: datetime-local values are Kyiv wall-clock
// time, kyivToIso() appends the Kyiv offset — +03:00 in September (summer time, EEST).
// The concession checkbox is false for every category but «Абонент».
const SCENARIO_BODY = {
  ride: {
    pickupAt: "2026-09-16T10:00:00+03:00",
    returnAt: "2026-09-16T10:40:00+03:00",
    bike: "classic",
    returnStation: "X01",
  },
  rider: { type: "reduced", concession: false },
};

async function postScenarioQuote() {
  const response = await fetch(`${baseUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(SCENARIO_BODY),
  });
  return { status: response.status, json: await response.json() };
}

test("fixture only: SCENARIO_BODY sends 10:00 / 10:40 Kyiv on 16.09.2026 (EEST) as 07:00Z / 07:40Z", () => {
  // tariffs.md:37 — all times are Europe/Kyiv; September is EEST = UTC+3.
  // Checks only the fixture this file sends — neither app/src nor the page: kyivToIso() in
  // public/index.html runs only on form submit, and no test here fills the form. Kyiv time in
  // the tariff is tested in test/spec (T6, T10).
  assert.equal(new Date(SCENARIO_BODY.ride.pickupAt).toISOString(), "2026-09-16T07:00:00.000Z");
  assert.equal(new Date(SCENARIO_BODY.ride.returnAt).toISOString(), "2026-09-16T07:40:00.000Z");
});

test("GET / serves the page with the quote form", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(html, /<form id="quote-form">/);
  assert.match(html, /<option value="reduced">Пільговий \(студент, пенсіонер\)<\/option>/);
  assert.match(html, /<option value="X01">X01 — Озеро \(пляж\), поза зоною<\/option>/);
  assert.match(html, /fetch\("\/api\/quote"/);
});

test("T1 T3 T5 T7: reduced rider, classic, 40 min, returned at X01 — quote 17500", async () => {
  const { status, json } = await postScenarioQuote();

  assert.equal(status, 200);
  assert.deepEqual(json.quote, {
    // T1 tariffs.md:45-47 — 10:00 → 10:40 = 40 min
    minutes: 40,
    // T3 tariffs.md:62,66 — 40 min = 2 started 30-min blocks × 25 грн (classic) = 50 грн
    timeCharge: 5000,
    // T5 tariffs.md:86,93 — reduced fare: −50 % of the time charge = 25 грн
    discounts: [{ code: "reduced", amount: 2500 }],
    // T7 tariffs.md:111-112, X01 is out of zone (tariffs.md:174) — 150 грн;
    // T5 tariffs.md:87 — the reduced fare does not apply to fees, so the fee stays whole
    fees: [{ code: "out-of-zone", amount: 15000 }],
    // 5000 − 2500 + 15000
    total: 17500,
  });
});

test("T9: receipt — separate discount line, separate fee line, «До сплати» 175,00 грн", async () => {
  const { status, json } = await postScenarioQuote();

  assert.equal(status, 200);
  // T9 tariffs.md:132-135 — UAH with two decimals and a comma; a line per discount (minus
  // sign), a line per fee, then «До сплати». The dot leaders are the receipt's layout.
  assert.deepEqual(json.receipt, [
    "Тривалість поїздки: 40 хв",
    "Погодинне нарахування .............. 50,00 грн",
    "Знижка: пільговий тариф ........... -25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ]);
});
