// Task A evidence: checks the priced cases of both AI drafts against the rules of
// docs/spec/tariffs.md, and the A1 cases against the code. The calculator below is written
// from the spec and does not import app/src.
//
//   node docs/evidence/task-a-check.mjs [app-src-dir]     default: app/src
//
// The numbers in docs/test-cases.md were taken on the code from main. After the Task B
// fixes, pass a copy of that code: node docs/evidence/task-a-check.mjs ../ws12-main/app/src

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const srcDir = resolve(process.argv[2] ?? "app/src");
const { quote } = await import(pathToFileURL(resolve(srcDir, "tariff.js")));
const { createDayCap } = await import(pathToFileURL(resolve(srcDir, "day-cap.js")));

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8").split("\n");
const cells = (line) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim().replaceAll("`", ""));

const KYIV = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Kyiv",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function kyiv(ms) {
  const parts = {};
  for (const { type, value } of KYIV.formatToParts(new Date(ms))) parts[type] = value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    second: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

const NIGHT_END = 6 * 3600;

/** Where the ride lies against 00:00-06:00; "edge" and "partial" are Q-2 and Q-1. */
function nightStatus(pickup, returned) {
  const from = kyiv(pickup);
  const to = kyiv(returned);
  const sameDate = from.date === to.date;
  if (from.second === NIGHT_END || (sameDate && to.second === NIGHT_END && from.second < NIGHT_END)) return "edge";
  if (sameDate && from.second < NIGHT_END && to.second < NIGHT_END) return "inside";
  if (sameDate && from.second > NIGHT_END) return "outside";
  return "partial";
}

const RATES = { classic: 2500, ebike: 4000 };
const OUT_OF_ZONE = new Set(["X01", "X02", "X03"]);
const VERSION_3_FROM = Date.parse("2026-09-15T00:00:00+03:00"); // docs/spec/tariffs.md:8

/** T9: what is left to pay after `percent` % off, rounded down to the kopeck. */
const payable = (amount, percent) => Math.floor((amount * (100 - percent)) / 100);

/** The total per the spec: `low` equals `high` unless the result depends on Q-1, Q-2 or Q-3. */
function specTotal({ pickAt, returnAt, bike, type, concession, station, used }) {
  const pickup = Date.parse(pickAt);
  const returned = Date.parse(returnAt);
  const minutes = Math.ceil((returned - pickup) / 60_000);
  const blocks = (value) => Math.ceil(value / 30);
  const full = blocks(minutes) * RATES[bike];
  const subscription =
    bike === "classic" ? blocks(Math.max(0, minutes - 45)) * RATES.classic : Math.floor(full * 0.8);
  const reduced = Math.floor(full / 2);

  let base = full;
  if (minutes <= 2) base = 0;
  else if (type === "reduced") base = reduced;
  else if (type === "subscriber") base = concession ? Math.min(subscription, reduced) : subscription;

  // The lowest amount any reading of T10 could give: 30 % added to the rider's own
  // percentage, or taken off the amount when the discount is not a percentage (classic T4).
  const lowestAtNight = () => {
    if (type === "standard") return Math.floor(base * 0.7);
    if (type === "reduced") return Math.floor(full * 0.2);
    const asSubscriber = bike === "ebike" ? Math.floor(full * 0.5) : Math.floor(subscription * 0.7);
    return concession ? Math.min(asSubscriber, Math.floor(full * 0.2)) : asSubscriber;
  };

  const status = nightStatus(pickup, returned);
  let low = base;
  let high = base;
  if (base > 0 && status === "inside" && type === "standard") low = high = Math.floor((base * 70) / 100);
  else if (base > 0 && status !== "outside") low = lowestAtNight();

  const room = Math.max(0, 30000 - used);
  const fees = (OUT_OF_ZONE.has(station) ? 15000 : 0) + (returned - pickup > 86_400_000 ? 200000 : 0);
  const timeLow = Math.min(low, room);
  const timeHigh = Math.min(high, room);
  return { low: timeLow + fees, high: timeHigh + fees, timeLow, timeHigh };
}

function classify(total, { low, high }) {
  if (total < low || total > high) return "contradict";
  return low === high ? "agree" : "depend";
}

// ---- A1: sections A-F have a price; F runs on one ledger per case group.

function a1Rider(text) {
  const [base, id] = text.split("#");
  if (base.startsWith("{")) {
    const type = /type:"(\w+)"/.exec(base)[1];
    const flag = /concession:("true"|true|false)/.exec(base)?.[1];
    return { rider: { type, concession: flag && JSON.parse(flag) }, outsideSpec: true };
  }
  if (base === "subscriber+c") return { rider: { type: "subscriber", concession: true, id } };
  return { rider: { type: base, id } };
}

const a1Lines = read("ai-runs/a1-from-code.md");
const a1Ids = a1Lines.filter((line) => /^\| [A-J]-\d/.test(line)).map((line) => cells(line)[0]);
const verdicts = new Map();
const codeMismatches = [];
let priced = 0;
let beforeVersion3 = 0;
let group = null;
let ledger = null;
let used = new Map();

for (const line of a1Lines.filter((row) => /^\| [A-F]-\d/.test(row))) {
  const [id, , pickAt, returnAt, bike, stations, riderText, totalText] = cells(line);
  const total = Number(totalText);
  const inLedger = id.startsWith("F-");
  const caseGroup = inLedger ? id.replace(/[a-d]$/, "") : null;
  if (caseGroup !== group) {
    group = caseGroup;
    ledger = inLedger ? createDayCap(group === "F-11" ? { limit: 5000 } : {}) : null;
    used = new Map();
  }
  priced += 1;
  if (Date.parse(pickAt) < VERSION_3_FROM) beforeVersion3 += 1;
  for (const station of stations.split(",").map((value) => value.trim())) {
    const { rider, outsideSpec } = a1Rider(riderText);
    const ride = { pickupAt: pickAt, returnAt, bike, returnStation: station };
    const actual = quote(ride, rider, ledger ? { dayCap: ledger } : {}).total;
    if (actual !== total) codeMismatches.push(`${id}: draft ${total}, code ${actual}`);

    if (outsideSpec || id === "F-11" || id === "F-12b") {
      verdicts.set(id, { kind: "outside" });
      continue;
    }
    const day = `${rider.id}|${kyiv(Date.parse(pickAt)).date}`;
    // An earlier ride may depend on an open question, so the ledger keeps both ends.
    const [usedLow, usedHigh] = inLedger ? (used.get(day) ?? [0, 0]) : [0, 0];
    const input = { pickAt, returnAt, bike, type: rider.type, concession: rider.concession === true, station };
    const fromLow = specTotal({ ...input, used: usedLow });
    const fromHigh = specTotal({ ...input, used: usedHigh });
    const expected = { low: fromHigh.low, high: fromLow.high };
    if (inLedger) used.set(day, [usedLow + fromLow.timeLow, usedHigh + fromHigh.timeHigh]);
    verdicts.set(id, { kind: classify(total, expected), total, expected, flagged: line.includes("⚠") });
  }
}

const ofKind = (kind) => [...verdicts].filter(([, verdict]) => verdict.kind === kind);
const contradictions = ofKind("contradict");
const range = ({ low, high }) => (low === high ? `${low}` : `${low}..${high}`);

console.log(`A1: ${a1Ids.length} case IDs, ${priced} with a price`);
console.log(`A1 vs code: ${priced - codeMismatches.length} of ${priced} totals match`);
for (const mismatch of codeMismatches) console.log(`  ${mismatch}`);
console.log(
  `A1 vs spec: ${ofKind("agree").length} agree, ${contradictions.length} contradict, ` +
    `${ofKind("depend").length} depend on Q-1 to Q-3, ${ofKind("outside").length} have inputs the spec does not define`,
);
const flagged = contradictions.filter(([, verdict]) => verdict.flagged).length;
console.log(`A1 contradictions: ${flagged} flagged by the draft, ${contradictions.length - flagged} stated with no warning`);
for (const [id, verdict] of contradictions) {
  console.log(`  ${id}${verdict.flagged ? " (flagged)" : ""}: draft ${verdict.total}, spec ${range(verdict.expected)}`);
}
console.log(`A1 depends on open questions: ${ofKind("depend").map(([id]) => id).join(" ")}`);
console.log(`A1 inputs outside the spec: ${ofKind("outside").map(([id]) => id).join(" ")}`);
console.log(`A1 dates: ${beforeVersion3} of ${priced} priced cases are before 2026-09-15`);

// One agreeing case per rule. T9 has no priced case: I-02 calls the rounding step directly.
const A1_RULE_CASES = [
  ["T1", "A-07"],
  ["T2", "A-01"],
  ["T3", "A-05"],
  ["T4", "C-07"],
  ["T5", "C-01"],
  ["T6", "E-02"],
  ["T7", "D-02"],
  ["T8", "D-06"],
  ["T9", "I-02"],
  ["T10", "B-05"],
];
const [, , i02Call, i02Discount] = cells(a1Lines.find((line) => line.startsWith("| I-02 |")));
const [i02Amount, i02Percent] = i02Call.match(/\d+/g).map(Number);
const i02Agrees = i02Amount - payable(i02Amount, i02Percent) === Number(i02Discount);
const agrees = (id) => (id === "I-02" ? i02Agrees : verdicts.get(id)?.kind === "agree");
const a1Rules = A1_RULE_CASES.filter(([, id]) => agrees(id)).map(([rule, id]) => `${rule} ${id}`);
console.log(`A1 rules: ${a1Rules.length} of 10 have an agreeing case: ${a1Rules.join(", ")}`);

// ---- A2: rows of sections 1-8 and 10 have a price. Times are Kyiv, September unless offset.

const CATEGORIES = {
  "стандартний": ["standard", false],
  "пільговий": ["reduced", false],
  "абонент": ["subscriber", false],
  "абонент+пільга": ["subscriber", true],
};
const BIKES = { "класичний": "classic", "електровелосипед": "ebike" };
const instant = (text) => {
  const [date, time] = text.split(" ");
  return /[+-]\d{2}:\d{2}$/.test(time) ? `${date}T${time}` : `${date}T${time}+03:00`;
};

const a2Lines = read("ai-runs/a2-from-spec.md");
const a2Ids = a2Lines.filter((line) => /^\| TC-/.test(line)).map((line) => cells(line)[0]);
const a2 = { agree: 0, contradict: 0, depend: 0 };
const a2Agreeing = new Map();
const countAgreeing = (id) => {
  const rule = id.split("-")[1];
  a2Agreeing.set(rule, (a2Agreeing.get(rule) ?? 0) + 1);
};
for (const line of a2Lines.filter((row) => /^\| TC-T\d+-/.test(row))) {
  const row = cells(line);
  if (row.length !== 10) {
    // Section 9 has no ride: base amount, percent, amount payable, discount.
    const [id, , base, percent, paid, discount] = row;
    const left = payable(Number(base), parseInt(percent, 10));
    if (left === Number(paid) && Number(base) - left === Number(discount)) countAgreeing(id);
    continue;
  }
  const [id, , category, bike, pickAt, returnAt, station, usedText, totalText] = row;
  const [type, concession] = CATEGORIES[category];
  const expected = specTotal({
    pickAt: instant(pickAt),
    returnAt: instant(returnAt),
    bike: BIKES[bike],
    type,
    concession,
    station: station.startsWith("S01–") ? "S01" : station,
    used: Number(usedText),
  });
  const kind = classify(Number(totalText), expected);
  a2[kind] += 1;
  if (kind === "agree") countAgreeing(id);
  else console.log(`  A2 ${id}: draft ${totalText}, spec ${range(expected)}`);
}

const without = (prefix) => a2Ids.filter((id) => id.startsWith(prefix)).length;
console.log(
  `A2: ${a2Ids.length} case IDs, ${a2.agree + a2.contradict + a2.depend} with a price, ` +
    `${without("TC-T9")} rounding, ${without("TC-E")} invalid data, ${without("TC-U")} with no expected value`,
);
console.log(`A2 vs spec: ${a2.agree} agree, ${a2.contradict} contradict, ${a2.depend} depend on Q-1 to Q-3`);
const a2Rules = [...a2Agreeing].map(([rule, count]) => `${rule} ${count}`);
console.log(`A2 rules: ${a2Rules.length} of 10 have agreeing cases: ${a2Rules.join(", ")}`);
