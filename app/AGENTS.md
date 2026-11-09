# Agent guidance

## Тести

1. Product-price expectations must come from `docs/spec/tariffs.md`, with the rule ID and specification line in the test; never infer an expected price from current code.
2. If the specification is missing, report that limitation and create no price assertions; tests may check explicitly documented API contracts, clearly labelled API, without pretending they cover product pricing.
3. Keep each boundary as a separate data row and named test; include below/at/above monetary thresholds and fractional minutes.
4. Assert exact approved monetary values and itemized codes/amounts; presence, nonnegative values and loose upper bounds do not prove pricing correctness.
5. Call the real system under test; a mock that returns the expected quote does not test quote().
6. Use fixed ISO instants with an offset and independent ledgers; include Kyiv midnight and UTC-offset changes for date-sensitive behavior.
7. Record undefined policies as questions; do not invent night-combination, boundary-crossing or receipt zero-line rules.
8. Never remove, skip or weaken an existing assertion or change an expected value merely to make tests green; cite the approved oracle for any correction.
9. Never change production constants, mutation tools or mutation targets to improve a test score; audit the complete generated diff.
10. Do not use random fixtures, sleeps or retries as the proof of a tariff rule; use deterministic literal boundary cases.
11. Keep protocol/validation characterization separate from specification acceptance tests; state when an exact exception contract or presentation detail lacks a product requirement.
