// E2E: the Task E scenario (docs/task-e-bonus.md, path 1) through the real HTTP server.
//
// A student takes a classic bike on 16.09.2026 at 10:00 and returns it at 10:40 at the lake
// beach (X01, outside the service zone); then the same ride returned at the city park (S03);
// then a return time before the pickup time.
//
// The test starts the server on a free port, sends the requests the page sends for that form
// input, checks the answers against docs/spec/tariffs.md and stops the server at the end.
// Fixed instants, no clock, no daily cap ledger: the result is the same on every run.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHandler } from "../../src/server.js";

let server;
let baseUrl;

before(async () => {
  server = createServer(createHandler());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

// The body the page builds from the form: the datetime-local values are Kyiv wall-clock time,
// sent with the +03:00 offset Kyiv has in September (spec §2, line 37: all times are Kyiv time);
// a student is the "reduced" category (spec §2, lines 33 and 39; T5), and the concession box is
// off for her.
function studentRide({ returnAt = "2026-09-16T10:40:00+03:00", returnStation }) {
  return {
    ride: { pickupAt: "2026-09-16T10:00:00+03:00", returnAt, bike: "classic", returnStation },
    rider: { type: "reduced", concession: false },
  };
}

async function postQuote(body) {
  const response = await fetch(`${baseUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

// The spec names no HTTP status, and docs/test-cases.md ("What the AI invented", row G-01 to G-19)
// lists the codes as a code detail, so only the class of the status is checked, by HTTP semantics:
// an answer with a price is a success (2xx), a request rejected for invalid data (§4) is a client
// error (4xx).
const isSuccess = (status) => status >= 200 && status < 300;
const isClientError = (status) => status >= 400 && status < 500;

// The options of one <select> of the form, found by its name, whatever the order of the
// attributes: option value → the label the rider sees.
function options(html, name) {
  const select = html.match(new RegExp(`<select[^>]*\\bname="${name}"[^>]*>([\\s\\S]*?)</select>`));
  assert.ok(select, `the form has no select "${name}"`);
  const found = select[1].matchAll(/<option[^>]*\bvalue="([^"]*)"[^>]*>([^<]*)<\/option>/g);
  return new Map([...found].map(([, value, label]) => [value, label.trim()]));
}

// The <input> tag of the form with this name, whatever the order of the attributes.
function inputTag(html, name) {
  const tag = html.match(new RegExp(`<input[^>]*\\bname="${name}"[^>]*>`))?.[0];
  assert.ok(tag, `the form has no input "${name}"`);
  return tag;
}

// Q-5 (docs/test-cases.md, "Questions for the specification") leaves the minus character of the
// receipt open: U+2212, as in the spec examples, or the ASCII hyphen. Both are read as the same
// sign until the product owner answers.
const withAsciiMinus = (line) => line.replaceAll("−", "-");

function assertReceiptHasLineEndingWith(receipt, amount) {
  assert.ok(
    receipt.some((line) => withAsciiMinus(line).endsWith(` ${amount}`)),
    `no receipt line ends with "${amount}":\n${receipt.join("\n")}`,
  );
}

// T9 (line 135) names one summary line, «До сплати», but not its place among the lines
// (docs/test-cases.md, "What the AI invented", row C-23 to C-26), so it is found by its label.
// What stands between the label and the amount (dot leaders today) is not checked either.
function assertDueLine(receipt, amount) {
  const due = receipt.filter((line) => line.startsWith("До сплати"));
  assert.equal(due.length, 1, `not exactly one «До сплати» line:\n${receipt.join("\n")}`);
  assert.ok(due[0].endsWith(` ${amount}`), `the «До сплати» line is not «… ${amount}»:\n${receipt.join("\n")}`);
}

// The choices of the scenario: the field, the value the request sends, and the name the spec gives
// that choice. The rider picks an option by its label, so the label must carry that name.
const SCENARIO_CHOICES = [
  ["bike", "classic", "класичний"], // spec §2, line 38
  ["riderType", "reduced", "пільговий"], // spec §2, line 39; students have the reduced fare (lines 33, 86)
  ["returnStation", "X01", "Озеро (пляж)"], // appendix A, line 174: outside the zone
  ["returnStation", "S03", "Міський парк"], // appendix A, line 168: in the zone
];

test("Spec §2, appendix A: the page offers every choice the scenario sends, under the spec's name", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.ok(isSuccess(response.status), `the page is not served: status ${response.status}`);
  const html = await response.text();
  // The requests below stand in for the browser, so they may use only values the form can send,
  // each in the field that sends it, behind a label with the spec's name for it. Only that name is
  // checked, in any letter case; the rest of the label (the station code, the zone note) is not.
  for (const [field, value, specName] of SCENARIO_CHOICES) {
    const label = options(html, field).get(value);
    assert.ok(label !== undefined, `the ${field} field has no option "${value}"`);
    assert.ok(
      label.toLowerCase().includes(specName.toLowerCase()),
      `the ${field} option "${value}" is labelled "${label}", not "${specName}"`,
    );
  }
  for (const name of ["pickupAt", "returnAt"]) {
    assert.match(inputTag(html, name), /\btype="datetime-local"/, `the ${name} field is not a datetime-local input`);
  }
  assert.ok(html.includes("/api/quote"), "the page does not refer to /api/quote");
});

test("T5, T7: student, classic, 40 min, return X01 (lake beach): 175,00 грн due", async () => {
  const { status, body } = await postQuote(studentRide({ returnStation: "X01" }));
  assert.ok(isSuccess(status), `the price is not calculated: status ${status}`);

  const { quote, receipt } = body;
  assert.equal(quote.minutes, 40); // T1: 10:00 → 10:40, whole minutes (spec lines 45-47)
  assert.equal(quote.timeCharge, 5000); // T3: 2 started 30-min blocks × 25 грн (lines 62, 66)
  assert.deepEqual(quote.discounts.map((d) => d.amount), [2500]); // T5: 50 % of the time charge only (lines 86-87)
  assert.deepEqual(quote.fees.map((f) => f.amount), [15000]); // T7: 150 грн, not reduced by T5 (lines 87, 112)
  assert.equal(quote.total, 17500); // 50 − 25 + 150 = 175 грн (lines 66, 86-87, 112)

  // T9 (lines 132-135): the duration, the T3 line, the discount with a minus sign, the fee and
  // the «До сплати» summary line. The spec gives no order of the lines, so only their presence
  // is checked (docs/test-cases.md, "What the AI invented", row C-23 to C-26; app/AGENTS.md,
  // rule 7), with either minus character (Q-5).
  assertReceiptHasLineEndingWith(receipt, "40 хв");
  assertReceiptHasLineEndingWith(receipt, "50,00 грн");
  assertReceiptHasLineEndingWith(receipt, "-25,00 грн");
  assertReceiptHasLineEndingWith(receipt, "150,00 грн");
  assertDueLine(receipt, "175,00 грн");
});

test("T5, T7: the same ride returned at S03 (city park): 25,00 грн due, no fee", async () => {
  const { status, body } = await postQuote(studentRide({ returnStation: "S03" }));
  assert.ok(isSuccess(status), `the price is not calculated: status ${status}`);

  const { quote, receipt } = body;
  assert.equal(quote.timeCharge, 5000); // T3: 2 blocks × 25 грн (lines 62, 66)
  assert.deepEqual(quote.discounts.map((d) => d.amount), [2500]); // T5: 50 % (lines 86-87)
  assert.deepEqual(quote.fees, []); // T7: S03 is in the zone (line 112; appendix A, line 168)
  assert.equal(quote.total, 2500); // 50 − 25 = 25 грн, the spec example on line 93
  assertDueLine(receipt, "25,00 грн");
});

test("Spec §4: return at 09:40, before the 10:00 pickup: rejected with an explanation, no receipt", async () => {
  // The form still holds S03 from the previous step; only the return time changes.
  const { status, body } = await postQuote(
    studentRide({ returnAt: "2026-09-16T09:40:00+03:00", returnStation: "S03" }),
  );
  // §4 (lines 147-149): the price is not calculated and the request is rejected with an
  // explanation. An explanation is a text, so the answer must carry a non-empty one. The spec
  // gives no wording or language, so the text itself is not checked (app/AGENTS.md, rule 7;
  // open question Q-13 in docs/test-cases.md). The spec names no status code either, so only its
  // class is checked: a rejected request is a client error (isClientError above).
  assert.ok(isClientError(status), `the request is not rejected as a client error: status ${status}`);
  assert.equal(typeof body.error, "string", "the rejection has no explanation");
  assert.notEqual(body.error.trim(), "", "the explanation is empty");
  assert.equal(body.quote, undefined);
  assert.equal(body.receipt, undefined);
});
