# AGENTS.md — app/ (Велопрокат громади)

Rules for an AI agent that writes or changes tests in this app. They come from what went
wrong in the homework runs (see `docs/test-quality.md`, section 5).

## Тести

1. **Expected values come from the specification, never from the current code.** Take every
   expected number from `docs/spec/tariffs.md` and put the rule id in the test name
   (`"T4: …"`) plus the spec line in a comment (`// docs/spec/tariffs.md:76-77`). Do not run
   the code to "see what it returns" and paste that in. If the specification is not
   available to you, do not invent expected values: write the case down as an open question
   in your answer and leave the test out (or mark the file as "behaviour snapshot, not
   verified against the spec" in its first line).
2. **Never change an assertion or an expected value to make a test pass without saying why.**
   A red test is a question "who is wrong — code, test or spec?". If you believe the test is
   wrong, quote the spec line that proves it in your answer. Never delete a test, never add
   `skip` / `todo` / `only`, never turn `equal` into `ok`, `<`, `>` or "not empty".
3. **Assert exact values.** `assert.equal(result.total, 1750)`, `assert.deepEqual(lines, [...])` —
   not `total > 0`, `total < timeCharge`, `length === 2`, `includes(...)`, `Array.isArray`.
   Check the codes and amounts of `discounts` and `fees`, not only how many there are.
4. **Do not compute the expected value with the production formula or constants.** No
   `Math.ceil(minutes / BLOCK_MINUTES) * RATES.ebike` in a test: write the number
   (`12000`) and, if useful, the arithmetic from the spec in a comment.
5. **Test the real code.** Do not replace `quote`, `createDayCap` or `formatReceipt` with a
   `mock.fn` and then assert what the mock returns. Mocks are only for things outside this
   app (there are none now).
6. **Boundaries get one table row each, on both sides.** 2 min / 3 min (T2), 30 / 31 min (T3),
   45 / 46 min (T4), 24:00:00 / 24:00:01 (T8), pickup 00:00 and 06:00 (T10), the Kyiv day
   change at 00:00 Kyiv = 21:00Z in summer (T6). Same-shape cases go into one data table and a
   loop, not copies of a test.
7. **Times are explicit about Kyiv.** Write instants with an offset (`2026-09-16T01:10:00+03:00`)
   or add a comment with the Kyiv wall-clock time; the night discount and the daily cap
   depend on the Kyiv date and hour, not on UTC.
8. **Tests are deterministic.** No `Math.random()`, no `Date.now()`, no current time zone of
   the machine. No `retry`, `sleep`, `setTimeout` or "run until green". If a test fails only
   sometimes, find the input that makes it fail and fix the cause.
9. **Do not touch `src/` or `tools/` to make tests pass, and do not change the mutation
   config.** To raise the mutation score, add tests that kill mutants; if a mutant cannot be
   killed, explain why it is equivalent instead of hiding it.
10. **Run `npm test` from the repo root before you answer**, and report red tests as red —
    with the spec line each one is checked against.
