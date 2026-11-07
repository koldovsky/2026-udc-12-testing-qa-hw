// Task D evidence for docs/triage.md and docs/bugs/CI-1152.md. Works on copies of `app/` taken
// from a commit, in temporary folders; the repo's files are never touched.
//
//   node docs/evidence/task-d-check.mjs odds               section 1, rows 3-6
//   node docs/evidence/task-d-check.mjs sabotage [commit]  section 1, row 8
//   node docs/evidence/task-d-check.mjs repro [runs]       section 2, every run (default: 20 runs)
//   node docs/evidence/task-d-check.mjs dst                section 2, run-1141
//   node docs/evidence/task-d-check.mjs smoke              section 2, run-1147
//   node docs/evidence/task-d-check.mjs fees               section 2, run-1152, and CI-1152.md
//
// odds: the durations of the old receipt test (range and count read from its files on `main`)
// for which its oracle, floor(minutes / 30) + 1, differs from the number of started 30-minute
// blocks, and the odds of a red run, next to the red runs in ai-runs/d-repeat-before.txt.
// sabotage: the receipt test of `commit` (default 9126021, the fix) against src/tariff.js with
// blocks counted the old oracle's way. Exit code 1 if a row other than 30 and 60 min turns red,
// or if any row is red on the unchanged code.
// repro: `main` as is, then `main` with each ci/changes/run-NNNN.diff applied by `git apply`, as in
// docs/walkthrough.md (Task D step 4); for each, tools/repeat.mjs over the whole app suite.
// dst: the ride of the run-1141 test, its UTC instants, the Kyiv clock around the change, and
// what quote() on `main` returns for it.
// smoke: the smoke step of run-1147 with the PR's src/server.js: once on a free port, once on a
// port another server already holds (it answers 404), then the same with the server.js of
// `main`. The port is passed in PORT; the CI step left PORT unset, which gives 3000 in both versions.
// fees: quote() on `main` and with run-1152.diff for rides with one, the other or both fees, then
// the whole app suite of the fix commit with run-1152.diff applied: the tests that go red.

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIX = "9126021";
const RUNS = ["1141", "1144", "1147", "1152"];

function git(args, cwd = REPO) {
  const run = spawnSync("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 });
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

/** A temporary copy of `app/` from `main`, with ci/changes/run-<run>.diff applied when `run` is given. */
function copyOfMain(run) {
  const dir = mkdtempSync(join(tmpdir(), "ws12-d-"));
  exportApp("main", dir);
  git(["init", "-q"], dir);
  if (run) git(["apply", join(REPO, "ci/changes", `run-${run}.diff`)], dir);
  return dir;
}

const remove = (dir) => rmSync(dir, { recursive: true, force: true, maxRetries: 5 });

function replaceOnce(src, from, to, label) {
  const at = src.indexOf(from);
  if (at === -1 || src.indexOf(from, at + 1) !== -1) throw new Error(`${label}: the text to change must occur exactly once`);
  return src.slice(0, at) + to + src.slice(at + from.length);
}

function unexpected(message) {
  console.log(`UNEXPECTED: ${message}`);
  process.exitCode = 1;
}

/** Started 30-minute blocks of a ride of `minutes`, counted one by one (docs/spec/tariffs.md:29, 62). */
function startedBlocks(minutes) {
  let blocks = 0;
  while (blocks * 30 < minutes) blocks++;
  return blocks;
}

function odds() {
  const factory = git(["show", "main:app/test/helpers/factory.js"]).toString();
  const test = git(["show", "main:app/test/integration/receipt.test.js"]).toString();
  const [, min, max] = factory.match(/const minutes = between\((\d+), (\d+)\);/).map(Number);
  const rides = Number(test.match(/randomRides\((\d+)\)/)[1]);
  const wrong = [];
  for (let m = min; m <= max; m++) if (Math.floor(m / 30) + 1 !== startedBlocks(m)) wrong.push(m);
  const perRide = wrong.length / (max - min + 1);
  const perRun = 1 - (1 - perRide) ** rides;
  const [, red, runs] = readFileSync(join(REPO, "ai-runs/d-repeat-before.txt"), "utf8").match(/Червоних прогонів: (\d+) з (\d+)/);
  console.log(`durations on main: ${min}..${max} min, whole minutes, ${rides} rides per test`);
  console.log(`old oracle differs from the started blocks at: ${wrong.join(", ")} min (${wrong.length} of ${max - min + 1})`);
  console.log(`odds of a red run: 1 - (1 - ${wrong.length}/${max - min + 1})^${rides} = ${(perRun * 100).toFixed(1)} %`);
  console.log(`expected red runs: ${(perRun * Number(runs)).toFixed(1)} of ${runs}; observed: ${red} of ${runs} (ai-runs/d-repeat-before.txt:2)`);
  console.log(`expected red runs with the old test: ${(perRun * 50).toFixed(1)} of 50`);
}

/** Every test of test/integration/receipt.test.js in `app`: "green" or "red". */
function receiptRows(app) {
  const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "test/integration/receipt.test.js"], { cwd: app, encoding: "utf8" });
  return [...run.stdout.matchAll(/^(not ok|ok) \d+ - (.+)$/gm)].map(([, state, name]) => ({ name, state: state === "ok" ? "green" : "red" }));
}

function sabotage(commit) {
  const dir = mkdtempSync(join(tmpdir(), "ws12-d-"));
  try {
    exportApp(commit, dir);
    const app = join(dir, "app");
    const before = receiptRows(app);
    const src = join(app, "src/tariff.js");
    const from = "return Math.ceil(minutes / BLOCK_MINUTES);";
    writeFileSync(src, replaceOnce(readFileSync(src, "utf8"), from, "return Math.floor(minutes / BLOCK_MINUTES) + 1;", "blocks"));
    const after = receiptRows(app);
    console.log(`receipt.test.js of ${commit}; change in src/tariff.js: ${from} → Math.floor(minutes / BLOCK_MINUTES) + 1\n`);
    console.log("code as is | changed | test");
    for (const row of before) {
      const changed = after.find((other) => other.name === row.name)?.state ?? "missing";
      console.log(`${row.state.padEnd(10)} | ${changed.padEnd(7)} | ${row.name}`);
      const boundary = / (30|60) min /.test(row.name);
      if (row.state !== "green") unexpected(`red on the unchanged code: ${row.name}`);
      if (changed !== (boundary ? "red" : "green")) unexpected(`${changed} with the change: ${row.name}`);
    }
  } finally {
    remove(dir);
  }
}

function repro(runs) {
  for (const run of [null, ...RUNS]) {
    const dir = copyOfMain(run);
    try {
      const result = spawnSync(process.execPath, [join(REPO, "tools/repeat.mjs"), String(runs), "--app", join(dir, "app")], { encoding: "utf8" });
      console.log(`== ${run ? `main + ci/changes/run-${run}.diff` : "main"}`);
      console.log(result.stdout.replace(/^Час:.*$/m, "").replace(/^(Прогонів: \d+) \(.*?app:/m, "$1 (<copy>/app:").trim(), "\n");
    } finally {
      remove(dir);
    }
  }
}

async function importTariff(dir) {
  return import(pathToFileURL(join(dir, "app/src/tariff.js")).href);
}

async function dst() {
  const pickupAt = "2026-10-25T02:30:00+03:00"; // ci/changes/run-1141.diff, the ride of the failing test
  const returnAt = "2026-10-25T04:30:00+02:00";
  console.log(`pickup ${pickupAt} = ${new Date(pickupAt).toISOString()}`);
  console.log(`return ${returnAt} = ${new Date(returnAt).toISOString()}`);
  console.log(`elapsed: ${(Date.parse(returnAt) - Date.parse(pickupAt)) / 60_000} min`);
  const kyiv = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "long" });
  for (const instant of ["2026-10-25T00:59:59Z", "2026-10-25T01:00:00Z"]) console.log(`${instant} in Kyiv: ${kyiv.format(new Date(instant))}`);
  const dir = copyOfMain(null);
  try {
    const { quote } = await importTariff(dir);
    const result = quote({ pickupAt, returnAt, bike: "classic", returnStation: "S02" }, { type: "standard" });
    console.log(`quote() on main: minutes ${result.minutes}, timeCharge ${result.timeCharge}`);
  } finally {
    remove(dir);
  }
}

function listen(server, port) {
  return new Promise((done, fail) => server.once("error", fail).listen(port, () => done(server.address().port)));
}

async function freePort() {
  const probe = createServer();
  const port = await listen(probe, 0);
  await new Promise((done) => probe.close(done));
  return port;
}

/** Starts src/server.js of `app` with PORT; resolves on its first line on stdout or on its exit. */
function startServer(app, port) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, ["src/server.js"], { cwd: app, env: { ...process.env, PORT: String(port) } });
    let stderr = "";
    const guard = setTimeout(() => {
      child.kill();
      fail(new Error("the server neither printed a line nor exited within 10 s"));
    }, 10_000);
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.stdout.once("data", (chunk) => {
      clearTimeout(guard);
      done({ child, line: chunk.toString().trim() });
    });
    child.once("exit", (code) => {
      clearTimeout(guard);
      done({ code, error: stderr.split("\n").find((line) => line.startsWith("Error:")) });
    });
  });
}

async function health(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  return `${response.status} ${(await response.text()).trim()}`;
}

async function smoke() {
  const unset = undefined;
  console.log(`PORT unset: main Number(PORT ?? 3000) = ${Number(unset ?? 3000)}; PR #236 Number.parseInt(PORT ?? "", 10) || 3000 = ${Number.parseInt(unset ?? "", 10) || 3000}`);
  const dir = copyOfMain("1147");
  const app = join(dir, "app");
  const occupier = createServer((req, res) => {
    res.statusCode = 404;
    res.end("not found");
  });
  try {
    const free = await freePort();
    const started = await startServer(app, free);
    console.log(`\nPR #236, free port: server printed "${started.line}"; GET /api/health → ${await health(free)}`);
    started.child.kill();
    const busy = await listen(occupier, 0);
    for (const version of ["PR #236", "main"]) {
      if (version === "main") git(["apply", "-R", join(REPO, "ci/changes/run-1147.diff")], dir);
      const result = await startServer(app, busy);
      if (result.child) {
        result.child.kill();
        unexpected(`${version}: the server started on a port that is taken`);
        continue;
      }
      console.log(`${version}, port taken: server exit code ${result.code}, "${result.error}"; GET /api/health → ${await health(busy)}`);
    }
  } finally {
    occupier.close();
    remove(dir);
  }
}

const FEE_RIDES = [
  { label: "48 h, return X03 (the test of app/test/unit/tariff.test.js:64 on main)", returnAt: "2026-09-18T07:00:00Z", returnStation: "X03" },
  { label: "24 h 01 min, return X03", returnAt: "2026-09-17T07:01:00Z", returnStation: "X03" },
  { label: "24 h 01 min, return S03 (in zone)", returnAt: "2026-09-17T07:01:00Z", returnStation: "S03" },
  { label: "20 min, return X03", returnAt: "2026-09-16T07:20:00Z", returnStation: "X03" },
];

async function fees() {
  for (const run of [null, "1152"]) {
    const dir = copyOfMain(run);
    try {
      const { quote } = await importTariff(dir);
      console.log(`== ${run ? "main + ci/changes/run-1152.diff" : "main"}`);
      for (const ride of FEE_RIDES) {
        const result = quote({ pickupAt: "2026-09-16T07:00:00Z", returnAt: ride.returnAt, bike: "classic", returnStation: ride.returnStation }, { type: "standard" });
        console.log(`${ride.label}: fees ${JSON.stringify(result.fees)}, total ${result.total}`);
      }
    } finally {
      remove(dir);
    }
  }
  const dir = mkdtempSync(join(tmpdir(), "ws12-d-"));
  try {
    exportApp(FIX, dir);
    git(["init", "-q"], dir);
    git(["apply", join(REPO, "ci/changes/run-1152.diff")], dir);
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "test/**/*.test.js"], { cwd: join(dir, "app"), encoding: "utf8" });
    const red = [...run.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(([, name]) => name);
    console.log(`== ${FIX} + ci/changes/run-1152.diff, the whole app suite: ${red.length} red`);
    for (const name of red) console.log(`  ${name}`);
  } finally {
    remove(dir);
  }
}

const [mode, arg] = process.argv.slice(2);
if (mode === "odds") odds();
else if (mode === "sabotage") sabotage(arg ?? FIX);
else if (mode === "repro") repro(Number(arg ?? 20));
else if (mode === "dst") await dst();
else if (mode === "smoke") await smoke();
else if (mode === "fees") await fees();
else {
  console.error("usage: node docs/evidence/task-d-check.mjs odds | sabotage [commit] | repro [runs] | dst | smoke | fees");
  process.exitCode = 2;
}
