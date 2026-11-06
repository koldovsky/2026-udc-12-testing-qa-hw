// Task B evidence: compares `total` of a subscriber's e-bike ride on two copies of the code, for
// every whole minute. The ranges in docs/bugs/BUG-3.md come from here.
//
//   node docs/evidence/task-b-check.mjs [base-src-dir] [other-src-dir]
//
// Defaults: base ../ws12-main/app/src (step 1 of docs/bugs/BUG-1.md makes it), other app/src.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [baseDir = "../ws12-main/app/src", otherDir = "app/src"] = process.argv.slice(2);
const load = async (dir) => (await import(pathToFileURL(resolve(dir, "tariff.js")))).quote;
const baseQuote = await load(baseDir);
const otherQuote = await load(otherDir);

const PICKUP = Date.parse("2026-09-16T07:00:00Z");
const SUBSCRIBER = { type: "subscriber" };
const WITH_CONCESSION = { type: "subscriber", concession: true };

function total(quote, minutes, rider) {
  const ride = {
    pickupAt: new Date(PICKUP).toISOString(),
    returnAt: new Date(PICKUP + minutes * 60_000).toISOString(),
    bike: "ebike",
    returnStation: "S03",
  };
  return quote(ride, rider).total;
}

/** [3, 4, 5, 9] gives "3-5, 9". */
function ranges(minutes) {
  const spans = [];
  for (const minute of minutes) {
    const last = spans.at(-1);
    if (last && last[1] === minute - 1) last[1] = minute;
    else spans.push([minute, minute]);
  }
  if (spans.length === 0) return "none";
  return spans.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`)).join(", ");
}

function compare(label, rider, lastMinute) {
  const differ = [];
  const match = [];
  for (let minutes = 0; minutes <= lastMinute; minutes += 1) {
    const same = total(baseQuote, minutes, rider) === total(otherQuote, minutes, rider);
    (same ? match : differ).push(minutes);
  }
  console.log(`${label}, 0-${lastMinute} min: totals differ at ${ranges(differ)}; match at ${ranges(match)}`);
}

compare("subscriber", SUBSCRIBER, 840);
compare("subscriber with concession", WITH_CONCESSION, 840);
compare("subscriber with concession", WITH_CONCESSION, 2000);
console.log(
  `subscriber with concession, 1441 min: total ${total(baseQuote, 1441, WITH_CONCESSION)} on the base, ` +
    `${total(otherQuote, 1441, WITH_CONCESSION)} on the other`,
);
