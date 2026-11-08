// Task C — evidence for docs/test-quality.md (section 2): the five real defects BUG-1…BUG-5 put back into the current code.
// Each row = exact reverse of the fix commit (51a43e7, fb84387, d373a24, eef52eb, b115710) applied once to app/src in a temp copy.
// Columns = suites: unit@5b5c48c (git archive, before the Task C smell fixes), unit now, spec now,
// B1 (ai-runs/b1-from-code), C-rules (ai-runs/c-with-rules) — the last two are shown as a diff against the baseline row.
//   node docs/evidence/c-historic-bugs.mjs   (from the repo root)
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const T = "src/tariff.js", D = "src/day-cap.js";
const FEES_NOW = "  const fees = feesFor(minutes, zone);";
const FEES_OLD = `  const fees = feesFor(minutes, zone).map((fee) =>
    plan.code === "reduced" ? { code: fee.code, amount: fee.amount - discount(fee.amount, REDUCED_PERCENT) } : fee,
  );`;
const SUB_NOW = `  const free = bike === "classic" ? SUBSCRIPTION_FREE_MINUTES : 0;
  const charge = blocks(Math.max(0, minutes - free)) * RATES[bike];`;
const SUB_OLD = "  const charge = blocks(Math.max(0, minutes - SUBSCRIPTION_FREE_MINUTES)) * RATES[bike];";
const BUGS = [
  ["baseline"],
  ["BUG-1 round instead of ceil", T, "return Math.ceil((returned - pickup) / 60_000);", "return Math.round((returned - pickup) / 60_000);"],
  ["BUG-2 < instead of <= FREE_START", T, "if (minutes <= FREE_START_MINUTES) return 0;", "if (minutes < FREE_START_MINUTES) return 0;"],
  ["BUG-3 subscription free minutes on ebike", T, SUB_NOW, SUB_OLD],
  ["BUG-4 reduced discount on fees", T, FEES_NOW, FEES_OLD],
  ["BUG-5 dayKey by UTC", D, "return kyivTime(pickupAt).date;", "return new Date(pickupAt).toISOString().slice(0, 10);"],
];
const SUITES = [
  ["unit@5b5c48c", "old", ["test/unit/**/*.test.js"]],
  ["unit now", "app", ["test/unit/**/*.test.js"]],
  ["spec now", "app", ["test/spec/**/*.test.js"]],
  ["B1", "ai-b1-from-code", ["ai-runs/b1-from-code/*.test.js"]],
  ["C-rules", "ai-c-with-rules", ["ai-runs/c-with-rules/*.test.js"]],
];
console.log("$ node docs/evidence/c-historic-bugs.mjs");
if (execFileSync("git", ["diff", "5b5c48c", "--", "app/src"]).length) throw new Error("app/src differs from 5b5c48c");

const root = mkdtempSync(join(tmpdir(), "ws12-historic-"));
const skipNM = (s) => !s.includes("node_modules");
const inject = (p, label, from, to) => {
  const src = readFileSync(p, "utf8");
  if (src.split(from).length !== 2) throw new Error(`${label}: pattern not found exactly once`);
  writeFileSync(p, src.replace(from, () => to));
};
const run = (cwd, args) => {
  const r = spawnSync("node", ["--test", ...args], { cwd, encoding: "utf8" });
  const out = r.stdout + r.stderr, n = (k) => out.match(new RegExp(`^ℹ ${k} (\\d+)`, "m"))?.[1];
  const red = [...new Set([...out.matchAll(/^\s*✖ (.+?)(?: \([\d.]+ms\))?$/gm)].map((m) => m[1]).filter((s) => s !== "failing tests:"))];
  return { pass: n("pass"), fail: n("fail"), todo: n("todo"), red };
};
const base = {};
try {
  const tar = execFileSync("git", ["archive", "5b5c48c", "app"], { maxBuffer: 1 << 28 });
  BUGS.forEach(([label, file, from, to], i) => {
    console.log(`\n== ${label}`);
    const dir = join(root, String(i));
    mkdirSync(join(dir, "old"), { recursive: true });
    execFileSync("tar", ["-x", "-C", join(dir, "old")], { input: tar });
    cpSync("app", join(dir, "app/app"), { recursive: true, filter: skipNM });
    // old/ = {app/}; unit/spec run inside <x>/app. AI layouts: root with app/src + ai-runs/<set> + {"type":"module"}.
    const unitOld = join(dir, "old/app"), unitNew = join(dir, "app/app");
    for (const name of ["b1-from-code", "c-with-rules"]) {
      const r = join(dir, "ai-" + name);
      cpSync("app/src", join(r, "app/src"), { recursive: true });
      cpSync(`ai-runs/${name}`, join(r, "ai-runs", name), { recursive: true });
      writeFileSync(join(r, "package.json"), '{ "type": "module" }\n');
    }
    if (file) {
      inject(join(unitOld, file), label, from, to);
      inject(join(unitNew, file), label, from, to);
      for (const name of ["b1-from-code", "c-with-rules"]) inject(join(dir, "ai-" + name, "app", file), label, from, to);
    }
    const cwd = { old: unitOld, app: unitNew, "ai-b1-from-code": join(dir, "ai-b1-from-code"), "ai-c-with-rules": join(dir, "ai-c-with-rules") };
    for (const [sname, key, args] of SUITES) {
      const res = run(cwd[key], args);
      const head = `${sname}: pass ${res.pass}, fail ${res.fail}, todo ${res.todo}`;
      if (!file) { base[sname] = res; console.log(head + res.red.map((s) => `\n  ✖ ${s}`).join("")); continue; }
      if (key.startsWith("ai-")) {
        const b = base[sname].red;
        const nowRed = res.red.filter((s) => !b.includes(s)), nowGreen = b.filter((s) => !res.red.includes(s));
        console.log(head + `\n  vs baseline: newly red ${nowRed.length}, newly green ${nowGreen.length}` +
          nowRed.map((s) => `\n  + red   ${s}`).join("") + nowGreen.map((s) => `\n  - green ${s}`).join(""));
      } else console.log(head + res.red.map((s) => `\n  ✖ ${s}`).join(""));
    }
  });
} finally {
  rmSync(root, { recursive: true, force: true });
}
