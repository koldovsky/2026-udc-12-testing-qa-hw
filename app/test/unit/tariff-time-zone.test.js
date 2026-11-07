// Every time in the spec is Kyiv time (docs/spec/tariffs.md:37-38), so the price of a ride must not
// depend on the time zone of the machine that runs the service. No expected price is asserted:
// whether a moment without an offset is rejected or priced is open question Q-8
// (docs/test-cases.md:166). The test runs the same input in two processes with different
// time zones and compares the two outcomes.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const TARIFF = new URL("../../src/tariff.js", import.meta.url).href;

/** quote() in a separate Node process with the given TZ: the result, or the name of the error. */
function quoteIn(timeZone, ride) {
  const script = `
    const { quote } = await import(${JSON.stringify(TARIFF)});
    let outcome;
    try {
      outcome = quote(${JSON.stringify(ride)}, { type: "standard" });
    } catch (error) {
      outcome = error.name;
    }
    const offset = new Date("2026-09-16T07:00:00Z").getTimezoneOffset();
    console.log(JSON.stringify({ offset, outcome }));
  `;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, TZ: timeZone },
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error(`setup: the ${timeZone} process failed: ${run.stderr}`);
  return JSON.parse(run.stdout);
}

const rows = [
  {
    title: "a pickup moment without an offset",
    ride: { pickupAt: "2026-09-16T07:00:00", returnAt: "2026-09-16T07:20:00Z", bike: "classic", returnStation: "S01" },
  },
  {
    title: "a return moment without an offset",
    ride: { pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:20:00", bike: "classic", returnStation: "S01" },
  },
];

for (const { title, ride } of rows) {
  test(`§2: the outcome does not depend on the time zone of the server: ${title}`, () => {
    const newYork = quoteIn("America/New_York", ride);
    const kyiv = quoteIn("Europe/Kyiv", ride);
    assert.notEqual(newYork.offset, kyiv.offset, "setup: the two processes must run in different time zones");
    assert.deepEqual(newYork.outcome, kyiv.outcome);
  });
}
