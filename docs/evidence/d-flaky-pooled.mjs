// Task D, flaky receipt test: do the three measured red-run series agree with the mechanism?
// Run from the repo root: node docs/evidence/d-flaky-pooled.mjs
// p = 1 - (83/85)^10 per run; exact binomial tails, no simulation.
const p = 1 - (83 / 85) ** 10;
const comb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const pmf = (n, k) => comb(n, k) * p ** k * (1 - p) ** (n - k);
const sum = (n, a, b) => { let s = 0; for (let i = a; i <= b; i++) s += pmf(n, i); return s; };
console.log("$ node docs/evidence/d-flaky-pooled.mjs");
console.log(`p = ${p.toFixed(4)}`);
for (const [name, k, n] of [["11/30 ai-runs/d-repeat-before.txt:2", 11, 30], ["7/30 d-ci-1144-repeat.txt:4", 7, 30], ["4/30 d-ci-1144-repeat.txt:20", 4, 30], ["22/90 pooled", 22, 90]])
  console.log(`${name}: expected ${(n * p).toFixed(4)}, P(X>=${k}) = ${sum(n, k, n).toFixed(4)}, P(X<=${k}) = ${sum(n, 0, k).toFixed(4)}`);
