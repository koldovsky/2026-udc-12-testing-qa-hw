# Master test plan: community bike-share tariffs v3

Status: reviewed homework testing proposal, 2026-11-09; participant sign-off remains open.
Structure follows the ISO/IEC/IEEE 29119-3 sections supplied in `docs/templates/test-plan.md`.
The product oracle is approved tariff specification v3, effective 2026-09-15 (`docs/spec/tariffs.md:5-8,15-19`).
Testing policies and targets labelled **proposed** below are planning decisions, not requirements invented for the product.

## 1. Testing context

### 1.1 Project and testing levels

Verify the calculation of finished bike-share rides and their itemized receipts against T1–T10 (`docs/spec/tariffs.md:25-39,43-143`).
Proposed levels: unit checks of individual rules, integration of pricing/ledger/receipt, and acceptance review of unambiguous business examples.
The existing implementation and test entry points are documented in `app/README.md` and root `package.json`; their interfaces are implementation contracts, not additional tariff policy.

### 1.2 Test objects

| Object | Implementation reference | Product behavior / oracle |
|---|---|---|
| Ride pricing | `app/src/tariff.js` | T1–T10, `docs/spec/tariffs.md:43-143` |
| Rider/day ledger | `app/src/day-cap.js`, `app/src/kyiv-time.js` | Kyiv calendar day and pickup ownership, `docs/spec/tariffs.md:34,37-39,100-107` |
| Station lookup | `app/src/zones.js` | The eleven listed stations/points, `docs/spec/tariffs.md:162-176` |
| Receipt composition and money format | `app/src/receipt.js` | Integer kopecks, flooring and Ukrainian amount presentation, `docs/spec/tariffs.md:129-137` |
| HTTP adapter | `app/src/server.js`, `app/test/unit/server.test.js` | Check that approved pricing results reach the response; protocol details come from these repository files, not the tariff specification |

### 1.3 Scope

In scope: elapsed-time rounding, free starts, both bike rates, subscription/concession selection, daily accumulation, independent fees, money/receipt presentation, night-only examples and the specified invalid inputs (`docs/spec/tariffs.md:45-149`).
Include all eight in-zone stations and three outside points (`docs/spec/tariffs.md:166-176`).
Exclude payment processing, station hardware, subscription purchase, performance/security certification and e-mail delivery from tariff acceptance; these workflows have no requirements in the supplied oracle, and automatic receipt e-mail is explicitly unresolved (`docs/spec/tariffs.md:159-160`).
Any UI or protocol characterization must identify its repository contract separately from product acceptance.

### 1.4 Assumptions and constraints

- Derive expected prices independently from approved rules, never from the implementation under test (`docs/spec/tariffs.md:15-19`).
- Amounts in assertions are integer kopecks; receipt checks use the required UAH representation (`docs/spec/tariffs.md:129-137`).
- Use explicit instants and independent synthetic riders/ledgers; Kyiv wall-clock interpretation is required (`docs/spec/tariffs.md:34,37-39,100-107`; repository input convention: `AGENTS.md`).
- Undefined night combinations or receipt presentation details remain questions; do not encode a chosen interpretation as acceptance (`docs/spec/tariffs.md:86-91,132-143`).
- No new npm dependencies, mutation-tool changes or edits to the oracle/CI inputs (`AGENTS.md`).

### 1.5 Stakeholders

The specification names a product owner and operational, financial and legal approvers (`docs/spec/tariffs.md:9-10`).
Proposed testing responsibilities: participant/test author owns the evidence, developer investigates code defects, product owner resolves policy questions, mentor reviews the homework.
These testing roles do not assert that a staffed organization or approval workflow already exists.

## 2. Testing communication

Proposed: record each pricing failure with case ID, specification line, input, expected/actual kopecks and a reproducible command; the oracle remains the approved specification (`docs/spec/tariffs.md:15-19,129-130`).
Publish evidence and unresolved questions in the homework PR after each testing phase; update the defect register after a fix and rerun.
Ask the product owner to decide only the affected ambiguous policy; unambiguous cases may continue.
The detailed artifact and PR process is defined by `docs/walkthrough.md`, not by tariff rules.

## 3. Risk register

These are proposed testing priorities, not measured probabilities or claims that defects are currently present.

| Risk | Likelihood | Impact | Rule / source | Proposed mitigation |
|---|---|---|---|---|
| Partial minutes or exact free-start boundary are over/undercharged | Unmeasured | High: wrong time charge | T1/T2, `docs/spec/tariffs.md:45-58` | Below/at/above boundaries, including milliseconds |
| Electric subscription inherits classic free minutes | Unmeasured | High: lost or excess revenue | T4, `docs/spec/tariffs.md:74-77` | Compare both bikes with literal expected amounts |
| Concession discounts a fee or plans stack incorrectly | Unmeasured | High: fixed fees are 15000/200000 kopecks | T5/T7/T8, `docs/spec/tariffs.md:86-96,111-125` | Decision table including both plans and both fees |
| A cap is assigned to UTC/return date or leaks across riders | Unmeasured | High: incorrect daily billing | T6, `docs/spec/tariffs.md:100-107` | Stateful sequences around Kyiv midnight and rider isolation |
| One applicable fee suppresses another | Unmeasured | High: missing 200000 kopecks | T8, `docs/spec/tariffs.md:119-125` | Both fees in one ride, checking codes, amounts and total |
| Green tests assert code behavior or assume undefined policy | Unmeasured | High: false confidence | Oracle priority and night/receipt wording, `docs/spec/tariffs.md:15-19,132-143` | Independent expected values, mutation review, explicit questions |
| Monetary formatting hides a wrong or missing receipt item | Unmeasured | Medium/high: misleading financial record | T9, `docs/spec/tariffs.md:129-137` | Signed item-level checks plus thousands/comma formatting |

## 4. Testing strategy

### 4.1 Testing subprocesses

Proposed sequence: review the oracle; design cases; independently review expected values; automate; capture the first run; classify failures; fix and retest; evaluate test quality; audit reproducibility.
Record first AI answers unchanged, then make corrections only in participant artifacts (`AGENTS.md`, `ai-runs/README.md`, `docs/walkthrough.md`).
Product correctness comes from the approved oracle (`docs/spec/tariffs.md:15-19`); an observed green run is evidence about a specific suite and revision.

### 4.2 Test artifacts

| Artifact | Location | Purpose |
|---|---|---|
| Reviewed cases and product questions | `docs/test-cases.md` | Inputs, expected results, rules and specification lines |
| Requirement traceability | `docs/traceability.md` | T1–T10 to cases and test names |
| Acceptance automation | `app/test/spec/*.test.js` | Execute unambiguous reviewed cases |
| AI draft and review delta for this plan | `ai-runs/e-test-plan.md`, `docs/task-e-bonus.md` | Preserve and evaluate the first answer |
| Defect evidence and fix commits | `docs/bugs/README.md`, `docs/bugs/BUG-*.md` | Reproducible expected/actual comparison |
| Quality and flaky/CI analyses | `docs/test-quality.md`, `docs/triage.md` | Explain measured effectiveness and unstable failures |

These locations follow `docs/walkthrough.md`; the plan does not claim that every proposed check is already implemented.

### 4.3 Test-design techniques and independent examples

Unless overridden below: pickup `2026-09-16T07:00:00Z`, classic bike, standard rider, S01 return, fresh ledger; return is pickup plus the exact stated elapsed interval.
Amounts below are kopecks; stateful rows specify their prior ledger state explicitly.

| Rule | Technique / cases to include | Independently calculated example | Oracle |
|---|---|---|---|
| T1 | Elapsed-time boundaries; partial minute; explicit offset change | 30 min + 1 ms => 31 billed minutes, base/total 5000; `02:30+03:00` to `04:30+02:00` => 180 elapsed minutes, without assuming a night total | `docs/spec/tariffs.md:45-50,62-67` |
| T2 | Below/at/above 2 minutes; outside return during free start | 1 min 59 s and exactly 2 min => 0; 2 min 1 ms => 3 min and 2500; 50 s at X01 => time 0 + fee 15000 | `docs/spec/tariffs.md:45-47,54-58,111-112` |
| T3 | Equivalence classes for both bikes; 29/30/31 and 59/60/61 minutes | Classic 30 min => 2500; 31 min => 5000; ebike 75 min => 12000 | `docs/spec/tariffs.md:62-70` |
| T4 | Bike-specific decision table; classic 44/45/46 and 75/76 minutes; ebike block boundaries | Subscriber classic 40 min => 0; 100 min => 5000; subscriber ebike 40 min => 8000 - 1600 = 6400 | `docs/spec/tariffs.md:74-82` |
| T5 | Reduced, subscriber, and subscriber with concession; cheaper option and tie | Concession subscriber classic 80 min => reduced 3750; 50 min => subscription on the 2500 tie; reduced classic 40 min at X01 => 2500 + full fee 15000 = 17500 | `docs/spec/tariffs.md:86-96,111-112` |
| T6 | Stateful accumulation, separate rider/date, pickup ownership across midnight; fees outside cap | Same rider ebike 80 min at `06:00Z`,`10:00Z`,`15:00Z` on 16 September => 12000,12000,6000; ledger total 30000 | `docs/spec/tariffs.md:34,100-107` |
| T7 | Every S01–S08 and X01–X03; free start, discounted time and exhausted cap | Standard classic 20 min at X03 => 2500 + 15000 = 17500; exhausted cap at X03 => 15000 | `docs/spec/tariffs.md:54-55,100-103,111-115,166-176` |
| T8 | At 24 h and just above; both fees together; concession still pays full fees | Exactly 24 h => 30000, no T8 fee; 24 h + 1 s => 230000; 25 h at X03 => 245000 | `docs/spec/tariffs.md:45-47,100-103,111-125` |
| T9 | Fractional kopeck flooring; item labels/signs; zero, negative discount and thousands formatting | `1235 * 0.7` => payable 864, discount 371; 230000 => `2 300,00 грн`; assert each applied discount/fee and final total | `docs/spec/tariffs.md:129-137` |
| T10 | Wholly night and wholly day; crossing and combined plans are questions | Standard classic pickup `2026-09-15T22:10:00Z`, return `22:40:00Z` => base 2500, night discount 750, total 1750 | `docs/spec/tariffs.md:37-39,141-143` |
| Invalid inputs | Separate partitions for reversed time, unknown bike/rider/station | Return before pickup, bike cargo, rider visitor or station S99 => reject with explanation; no invented error wording or status code | `docs/spec/tariffs.md:147-149` |

The two 24-hour comparisons are equivalent under T1: `ceil(elapsedMinutes) > 1440` iff `elapsedMinutes > 1440`; Q-3 in `docs/test-cases.md` is therefore resolved, not an unapproved policy choice (`docs/spec/tariffs.md:45-47,119-120`).
For midnight cap tests, assert pickup-date ownership independently from any unresolved crossing-night price; use fully specified prior charges and inspect both dates (`docs/spec/tariffs.md:100-107,141`).

### 4.4 Entry and completion criteria

**Proposed entry:** approved oracle version identified; all case inputs and prior state specified; runnable repository commands available; unresolved policy questions separated from acceptance assertions (`docs/spec/tariffs.md:5-8,15-19`; `docs/walkthrough.md`).

**Proposed completion targets:**

- Cover 10/10 rules with reviewed unambiguous cases and named automated tests; do not count a disputed expectation as coverage (`docs/spec/tariffs.md:18-19,43-143`).
- Pass 100% of the selected unambiguous cases and all required app/unit/tools checks; zero unexplained skips or weakened assertions (`docs/walkthrough.md`, Definition of Done).
- Have zero unresolved confirmed high/critical pricing defects in scope; document lower-severity issues and every open product-policy question separately (testing-team proposal, not a product release promise).
- Obtain 0 failing runs out of 50 after the flaky-test cause is corrected (`docs/walkthrough.md`, Task D).
- Explain 100% of surviving mutants as equivalent, a missing test, or an explicit unresolved policy; a policy-dependent survivor remains an open limitation, not an equivalent mutant or an achieved detection target (`docs/spec/tariffs.md:15-19`; `docs/walkthrough.md`, Task C).
- Evaluate at least five distinct mutants with evidence; if fewer than five survive the after-run, identify all of them and label additional baseline survivors separately; the stricter walkthrough wording requires mentor acceptance of this adaptation (`docs/walkthrough.md`, Task C step 4).

Current evidence is reported in `docs/test-quality.md` and `docs/triage.md`; those records, including the unresolved Task C limitations, take precedence over any implication that these proposed targets have all been achieved.

### 4.5 Metrics

Proposed reporting: rules/cases reviewed and automated, pass/fail/skip counts, distinct source defects, incorrect test expectations, unresolved questions, unit source line coverage, raw/reviewed mutation score and survivor categories, assert-call-site counts, and flaky failures/runs.
Keep suite scopes and revision identifiers with each value; unit coverage and unit+spec mutation scores describe different test selections (`package.json`, `tools/mutate.config.json`, `docs/test-quality.md`).
No coverage or mutation percentage by itself proves conformance to the oracle (`docs/spec/tariffs.md:15-19`).

### 4.6 Test-data requirements

Use the documented rider/bike categories, listed station codes, integer money and Kyiv calendar dates (`docs/spec/tariffs.md:34,37-39,129-130,166-176`).
Keep accepted and rejected inputs separate; every ledger test starts from an explicit balance and uses isolated rider IDs (`docs/spec/tariffs.md:100-107,147-149`).
Use fixed offset-bearing instants and literal expected amounts, with separate rows for each boundary; no random values, system-clock dependency, sleeps or retries as acceptance evidence (`AGENTS.md`, `docs/triage.md`).

### 4.7 Test environment

Repository requirement: Node >=22.5 and no npm dependencies (`package.json`, `app/package.json`, `AGENTS.md`).
Record actual Node version, operating system, revision and command with each new execution; do not claim an unexecuted platform matrix.
Run handler integration without binding a fixed port where the repository supports injected handlers (`app/src/server.js`, `app/test/unit/server.test.js`); an optional smoke run must own its process/port (`docs/triage.md`, run-1147).
Kyiv date/time is required by the product; it must not depend on the host's local timezone (`docs/spec/tariffs.md:34,37-39,100-107`).

### 4.8 Retesting and regression

For each confirmed defect, retain the first failing evidence, add or identify its specification-backed regression test, fix the source, rerun the focused case and required suites, and link the fix commit (`docs/walkthrough.md`, Task B).
Recheck interactions involving plan selection, caps and independent fees when those rules change (`docs/spec/tariffs.md:74-125`).
Preserve raw AI measurements and rerun the reviewed suite separately after rejecting unsupported assertions (`ai-runs/README.md`, `docs/test-quality.md`).
Mutation testing is a specifically requested Task C activity, not an automatic command for every documentation edit (`AGENTS.md`).

### 4.9 Suspension and resumption

Proposed: suspend only cases whose expected price/presentation depends on an unanswered product decision; resume after the product owner records an approved clarification (`docs/spec/tariffs.md:9,15-19,132-143`).
Suspend environment-dependent execution if the runtime is unavailable or a smoke process cannot own its port; resume after correcting that condition (`package.json`, `docs/triage.md`, run-1147).
Continue independent unambiguous cases; never fabricate an expectation or hide a failure with a retry.

### 4.10 Deviations from organizational strategy

No organizational testing strategy is supplied; no claim of organizational compliance or approved service levels is made.
This plan uses the provided homework template; its scope and planning targets are explicit proposals, while tariff behavior is governed by `docs/spec/tariffs.md:15-19`.
Existing experiment deviations and the Task C survivor-count adaptation remain disclosed in `docs/pr-description.md` and `docs/test-quality.md`.

## 5. Testing activities and estimates

| Proposed activity | Deliverable / gate | Estimate status |
|---|---|---|
| Review T1–T10, validation and appendix | Traceable case set and question register | One planned review pass; person-hours unestimated |
| Automate unambiguous cases and collect failures | Named tests and original outputs | Estimate after case review |
| Triage, fix and retest | Reproducible reports, separate fix commits | Depends on confirmed defects |
| Assess test strength and review AI changes | Raw/reviewed measurements and mutant verdicts | Depends on survivor count; no assumed score increase |
| Correct flaky cause and classify CI runs | 50-run evidence and four classifications | Run counts fixed by walkthrough, wall-clock duration unestimated |
| Review this plan and submission | Three or more documented draft refinements, final artifacts and PR update | One planned review pass |

These are proposed work packages, not measured staff capacity or an approved delivery commitment (`docs/walkthrough.md`, Tasks A–E).

## 6. Staffing

### 6.1 Roles, activities and responsibility

Proposed: test author maintains cases/evidence, developer owns code fixes, product owner answers tariff questions, participant approves the final submission and mentor evaluates it.
The product owner and original approval roles come from `docs/spec/tariffs.md:9-10`; testing assignments are proposals, not claims that named people are available.
AI may draft and execute authorized experiments; participant responsibility is retained (`docs/walkthrough.md`, rules for all tasks).

### 6.2 Training needs

Proposed preparation: calculate integer-kopek discounts independently, distinguish elapsed instants from Kyiv calendar dates, read mutation reports and separate flaky test defects from environment failures (`docs/spec/tariffs.md:34,45-47,100-107,129-137`; `docs/walkthrough.md`, Tasks C/D).
No completed training or staff qualification is assumed.

## 7. Schedule

Proposed gates: oracle/case review → automated baseline → defect corrections → test-quality review → flaky/CI evidence → bonus plan review → participant submission.
The homework deadline is 2026-11-10 at 23:59 Kyiv time (`docs/walkthrough.md`, Submission); it is not the product's effective date, which is 2026-09-15 (`docs/spec/tariffs.md:8`).
Detailed dates and staff allocations remain uncommitted; unresolved policy cases retain their explicit status at submission.

## Open questions to the product owner

| ID | Question | Why unresolved | Effect on acceptance |
|---|---|---|---|
| Q-1 | For a ride crossing 00:00/06:00, use pickup, the entire interval or prorating; how are exact endpoints treated? | Night rule supplies a window/example but no mixed-interval policy, `docs/spec/tariffs.md:141-143` | Do not assert a crossing-night total; independent elapsed/base/date checks remain possible |
| Q-2 | How do night and subscription/concession discounts compose, including rounding order? | T5 explicitly excludes combining subscription with concession, but T10 composition is not stated, `docs/spec/tariffs.md:86-91,129-130,141-143` | Keep combined-night price expectations out of acceptance |
| Q-4 | Must a zero-valued discount/cap item be omitted or shown? | Receipt requires discount/limit lines without defining zero-valued items, `docs/spec/tariffs.md:132-135` | Do not claim M018/M023 equivalent or kill them with an invented presentation rule |
| Q-5 | What alignment or dot padding is mandatory? | Spec fixes amount formatting and receipt content, not padding, `docs/spec/tariffs.md:132-135` | Verify semantic labels, signs and amounts without imposing a dot count |
| Q-E1 | Is automatic receipt e-mail required? | Explicit open question for support, `docs/spec/tariffs.md:159-160` | Outside tariff acceptance; no e-mail test requirement is invented |

Q-3 is resolved by the T1 ceiling argument in section 4.3; it is not an unresolved blocker.
