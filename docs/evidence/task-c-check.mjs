// Task C evidence for docs/test-quality.md. Works on a copy of `app/` taken from a commit, in a
// temporary folder; the repo's files are never touched.
//
//   node docs/evidence/task-c-check.mjs sabotage [commit]       section 2, column "Evidence"
//   node docs/evidence/task-c-check.mjs unit-mutants [commit]   section 1, last row
//   node docs/evidence/task-c-check.mjs equivalence             section 4, M016 and M019
//   node docs/evidence/task-c-check.mjs probes                  section 4, M018, M023 and M075
//
// Default commit: 6c85f02, the state the smells were listed on. Its `app/` is the code after the
// Task B fixes (2c45deb) with the unit tests before the AI strengthened them.
//
// sabotage: for each smell, one change to `app/src/` in the copy, then the named unit test on
// its own. "green" means the test did not notice the change. Exit code 1 if any result differs
// from the one in docs/test-quality.md.
// unit-mutants: tools/mutate.mjs with the configured targets and only `test/unit` as the suite.
// equivalence: the current app/src/tariff.js for every whole minute from 0 to 3000, both bikes and
// every rider category, daytime pickup, no ledger. M016 and M019 change `> 0` to `> 1`, so they
// differ from the code only if the fare discount or the amount due before T10 is exactly 1.
// probes: inputs on which the mutant and the current code give different results, on a temporary
// copy of app/src/; for M018 and M023 also the mutant's receipt. The first M075 input depends on
// the time zone of the process: compare with
// `TZ=America/New_York node docs/evidence/task-c-check.mjs probes`.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TARGETS = ["app/src/tariff.js", "app/src/day-cap.js"];

const SABOTAGE = [
  {
    smell: 1,
    change: "the total ignores discounts and fees",
    src: "src/tariff.js",
    from: "return { minutes, timeCharge, discounts, fees, total };",
    to: "return { minutes, timeCharge, discounts, fees, total: timeCharge };",
    expect: [["tariff.test.js", "quote returns an itemised price", "green"]],
  },
  {
    smell: 2,
    change: "BLOCK_MINUTES = 20",
    src: "src/tariff.js",
    from: "export const BLOCK_MINUTES = 30;",
    to: "export const BLOCK_MINUTES = 20;",
    expect: [["tariff.test.js", "e-bikes are billed at the e-bike rate", "green"]],
  },
  {
    smell: 2,
    change: "Math.ceil → Math.floor in rideMinutes",
    src: "src/tariff.js",
    from: "return Math.ceil((returned - pickup) / 60_000);",
    to: "return Math.floor((returned - pickup) / 60_000);",
    expect: [["tariff.test.js", "e-bikes are billed at the e-bike rate", "green"]],
  },
  {
    smell: 3,
    change: "RATES.classic = 5000",
    src: "src/tariff.js",
    from: "export const RATES = Object.freeze({ classic: 2500, ebike: 4000 });",
    to: "export const RATES = Object.freeze({ classic: 5000, ebike: 4000 });",
    expect: [
      ["tariff.test.js", "a 45-minute classic ride costs 50 UAH", "green"],
      ["tariff.test.js", "a ride of 30 min 20 s is billed as two blocks", "red"],
      ["tariff.test.js", "reduced fare for a ride returned outside the zone", "red"],
      ["tariff.test.js", "night rides get 30 % off", "red"],
    ],
  },
  {
    smell: 4,
    change: "no daily cap at all",
    src: "src/tariff.js",
    from: "if (due > allowance) {",
    to: "if (false) {",
    expect: [["tariff.test.js", "the daily cap limits the time charge", "green"]],
  },
  {
    smell: 5,
    change: "NIGHT_PERCENT = 10",
    src: "src/tariff.js",
    from: "export const NIGHT_PERCENT = 30;",
    to: "export const NIGHT_PERCENT = 10;",
    expect: [["tariff.test.js", "night rides get 30 % off", "green"]],
  },
  {
    smell: 6,
    change: "subscription e-bike discount 1 %",
    src: "src/tariff.js",
    from: "export const SUBSCRIPTION_EBIKE_PERCENT = 20;",
    to: "export const SUBSCRIPTION_EBIKE_PERCENT = 1;",
    expect: [["tariff.test.js", "subscription on a long e-bike ride", "green"]],
  },
  {
    smell: 7,
    change: "UNRETURNED_FEE = 2000",
    src: "src/tariff.js",
    from: "export const UNRETURNED_FEE = 200000;",
    to: "export const UNRETURNED_FEE = 2000;",
    expect: [["tariff.test.js", "a bike kept over a day and left outside the zone pays both fees", "green"]],
  },
  {
    smell: 9,
    change: "record adds half the amount",
    src: "src/day-cap.js",
    from: "charged.set(key, (charged.get(key) ?? 0) + amount);",
    to: "charged.set(key, (charged.get(key) ?? 0) + amount / 2);",
    expect: [["day-cap.test.js", "charges recorded for a day reduce what is left of the cap", "green"]],
  },
  {
    smell: 10,
    change: "dayKey returns the UTC date",
    src: "src/day-cap.js",
    from: "return kyivTime(pickupAt).date;",
    to: "return new Date(pickupAt).toISOString().slice(0, 10);",
    expect: [["day-cap.test.js", "the day of a ride is the date of its pickup", "green"]],
  },
  {
    smell: 11,
    change: "fee line printed with the label `?` and a minus sign",
    src: "src/receipt.js",
    from: "for (const item of quote.fees) lines.push(line(LABELS[item.code] ?? item.code, item.amount));",
    to: 'for (const item of quote.fees) lines.push(line("?", -item.amount));',
    expect: [["receipt-format.test.js", "a receipt has a line for every item", "green"]],
  },
];

function git(args) {
  const run = spawnSync("git", args, { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.toString().trim()}`);
  return run.stdout;
}

/** Writes `app/` of `commit` into `dir` (dir/app/...). */
function exportApp(commit, dir) {
  const paths = git(["ls-tree", "-r", "--name-only", commit, "--", "app"]).toString().split("\n").filter(Boolean);
  for (const path of paths) {
    const target = join(dir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, git(["show", `${commit}:${path}`]));
  }
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Runs one unit test by its exact name; "green" or "red". */
function runOne(appDir, file, name) {
  const run = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=tap", `--test-name-pattern=^${escapeRegExp(name)}$`, `test/unit/${file}`],
    { cwd: appDir, encoding: "utf8" },
  );
  const count = (key) => Number(run.stdout.match(new RegExp(`^# ${key} (\\d+)$`, "m"))?.[1] ?? NaN);
  if (count("pass") + count("fail") !== 1) throw new Error(`${file} › ${name}: expected exactly one test to run`);
  return count("fail") === 0 ? "green" : "red";
}

function replaceOnce(src, from, to, label) {
  const at = src.indexOf(from);
  if (at === -1 || src.indexOf(from, at + 1) !== -1) throw new Error(`${label}: the text to change must occur exactly once`);
  return src.slice(0, at) + to + src.slice(at + from.length);
}

function sabotage(commit) {
  const dir = mkdtempSync(join(tmpdir(), "task-c-check-"));
  let mismatches = 0;
  try {
    exportApp(commit, dir);
    const appDir = join(dir, "app");
    const named = [...new Map(SABOTAGE.flatMap((c) => c.expect).map(([f, n]) => [`${f}|${n}`, [f, n]])).values()];
    for (const [file, name] of named) {
      if (runOne(appDir, file, name) !== "green") throw new Error(`baseline: ${file} › ${name} is red without any change`);
    }
    console.log(`sabotage on app/ from ${commit}; baseline: ${named.length} named tests green\n`);
    for (const c of SABOTAGE) {
      const file = join(appDir, c.src);
      const original = readFileSync(file, "utf8");
      writeFileSync(file, replaceOnce(original, c.from, c.to, `#${c.smell} ${c.change}`));
      try {
        const results = c.expect.map(([testFile, name, expected]) => {
          const actual = runOne(appDir, testFile, name);
          if (actual !== expected) mismatches++;
          return `${testFile} › ${name}: ${actual}${actual === expected ? "" : ` (docs/test-quality.md says ${expected})`}`;
        });
        console.log(`#${c.smell} ${c.src}: ${c.change}\n  ${results.join("\n  ")}`);
      } finally {
        writeFileSync(file, original);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
  console.log(`\n${mismatches === 0 ? "every result as in docs/test-quality.md" : `${mismatches} result(s) differ`}`);
  process.exitCode = mismatches === 0 ? 0 : 1;
}

function unitMutants(commit) {
  const dir = mkdtempSync(join(tmpdir(), "task-c-check-"));
  try {
    exportApp(commit, dir);
    const config = join(dir, "mutate.unit.json");
    writeFileSync(config, JSON.stringify({ root: dir, app: "app", targets: TARGETS, tests: ["test/unit"], timeoutMs: 20000 }));
    console.log(`tools/mutate.mjs on app/ from ${commit}, suite: test/unit only\n`);
    const run = spawnSync(process.execPath, [join(REPO, "tools/mutate.mjs"), "--config", config], { stdio: ["ignore", "inherit", "ignore"] });
    process.exitCode = run.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
}

async function equivalence() {
  const { quote } = await import(pathToFileURL(join(REPO, "app/src/tariff.js")).href);
  const riders = [
    { type: "standard" },
    { type: "reduced" },
    { type: "subscriber" },
    { type: "subscriber", concession: true },
  ];
  const pickup = Date.parse("2026-09-16T07:00:00Z"); // 10:00 in Kyiv: no night discount
  const plans = new Set();
  const dues = new Set();
  for (let minutes = 0; minutes <= 3000; minutes++) {
    for (const bike of ["classic", "ebike"]) {
      for (const rider of riders) {
        const ride = {
          pickupAt: new Date(pickup).toISOString(),
          returnAt: new Date(pickup + minutes * 60_000).toISOString(),
          bike,
          returnStation: "S01",
        };
        const result = quote(ride, rider);
        const plan = result.discounts.find((d) => d.code === "subscription" || d.code === "reduced")?.amount ?? 0;
        plans.add(plan);
        dues.add(result.timeCharge - plan);
      }
    }
  }
  const smallestAbove0 = (set) => Math.min(...[...set].filter((n) => n > 0));
  console.log(`rides: ${3001 * 2 * riders.length}`);
  console.log(`M016 fare discount: exactly 1 kopeck ${plans.has(1) ? "occurs" : "never occurs"}; smallest above 0: ${smallestAbove0(plans)}`);
  console.log(`M019 amount due before T10: exactly 1 kopeck ${dues.has(1) ? "occurs" : "never occurs"}; smallest above 0: ${smallestAbove0(dues)}`);
  process.exitCode = plans.has(1) || dues.has(1) ? 1 : 0;
}

const PROBES = [
  {
    id: "M018",
    from: "if (due > 0 && kyivTime(pickup).hour < NIGHT_UNTIL_HOUR) {",
    to: "if (due >= 0 && kyivTime(pickup).hour < NIGHT_UNTIL_HOUR) {",
    input: "1 min at 01:00 in Kyiv, standard, classic",
    ride: { pickupAt: "2026-09-15T22:00:00Z", returnAt: "2026-09-15T22:01:00Z" },
    receipt: true,
  },
  {
    id: "M023",
    from: "if (due > allowance) {",
    to: "if (due >= allowance) {",
    input: "360 min, standard, classic: exactly the cap",
    ride: { pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T13:00:00Z" },
    receipt: true,
  },
  ...[
    ["pickupAt without an offset, return at 07:20Z", "2026-09-16T07:00:00"],
    ["pickupAt as a date only, return at 07:20Z", "2026-09-16"],
    ["pickupAt 07:00Z wrapped in an array, return at 07:20Z", ["2026-09-16T07:00:00Z"]],
  ].map(([input, pickupAt]) => ({
    id: "M075",
    from: 'if (typeof value !== "string" || !ISO_DATE_TIME.test(value)) {',
    to: 'if (typeof value !== "string" && !ISO_DATE_TIME.test(value)) {',
    input,
    ride: { pickupAt, returnAt: "2026-09-16T07:20:00Z" },
  })),
];

async function probes() {
  const dir = mkdtempSync(join(tmpdir(), "task-c-check-"));
  const { formatReceipt } = await import(pathToFileURL(join(REPO, "app/src/receipt.js")).href);
  const outcome = async (srcDir, ride) => {
    const { quote } = await import(pathToFileURL(join(srcDir, "tariff.js")).href);
    try {
      const result = quote({ bike: "classic", returnStation: "S01", ...ride }, { type: "standard" });
      return { text: JSON.stringify(result), result };
    } catch (error) {
      return { text: `${error.name}: ${error.message}`, result: null };
    }
  };
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log(`time zone of this process: ${timeZone}\n`);
    for (const [index, probe] of PROBES.entries()) {
      const srcDir = join(dir, String(index), "src");
      mkdirSync(dirname(srcDir), { recursive: true });
      cpSync(join(REPO, "app/src"), srcDir, { recursive: true });
      const file = join(srcDir, "tariff.js");
      writeFileSync(file, replaceOnce(readFileSync(file, "utf8"), probe.from, probe.to, probe.id));
      const code = await outcome(join(REPO, "app/src"), probe.ride);
      const mutant = await outcome(srcDir, probe.ride);
      const same = code.text === mutant.text ? "  (same)" : "";
      console.log(`${probe.id}: ${probe.input}\n  code:   ${code.text}\n  mutant: ${mutant.text}${same}`);
      if (probe.receipt && mutant.result) console.log(`  mutant receipt: ${formatReceipt(mutant.result).join(" | ")}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
}

const [mode, commit = "6c85f02"] = process.argv.slice(2);
if (mode === "sabotage") sabotage(commit);
else if (mode === "unit-mutants") unitMutants(commit);
else if (mode === "equivalence") await equivalence();
else if (mode === "probes") await probes();
else {
  console.error("usage: node docs/evidence/task-c-check.mjs sabotage|unit-mutants [commit] | equivalence | probes");
  process.exitCode = 2;
}
