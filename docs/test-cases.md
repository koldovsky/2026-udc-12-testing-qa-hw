# Test cases: community bike-share tariffs v3

Money is integer kopecks; the oracle is docs/spec/tariffs.md.
Unless overridden: pickup=2026-09-16T07:00:00Z, bike=classic, rider.type=standard, station=S01, fresh ledger.
Duration defines returnAt as pickup plus the exact elapsed duration; generated instants use Z.
EP=equivalence partition; BVA=boundary values; DT=decision table; ST=states/time.
Each case is high priority because it affects money or validation.
Specification references below are line numbers in docs/spec/tariffs.md.
These are agent-reviewed participant artifacts; the participant must review and own the decisions before submission.

## Test cases

| ID | Rule | Technique | Inputs / overrides | Expected result | Specification lines | Priority |
|---|---|---|---|---|---|---|
| TC-01 | T1 | BVA | 30 min 1 s | minutes=31; timeCharge=5000; total=5000 | 45-47,62-66 | high |
| TC-02 | T1 | EP | 12 min 40 s | minutes=13; total=2500 | 45-49 | high |
| TC-03 | T1 | ST | 2026-10-25T02:30:00+03:00 to 2026-10-25T04:30:00+02:00 | minutes=180; timeCharge=15000; total deferred Q-1 | 45-47 | high |
| TC-04 | T2 | BVA | 1 min 59 s | minutes=2; total=0 | 54-55 | high |
| TC-05 | T2 | BVA | 2 min | minutes=2; total=0 | 54-55 | high |
| TC-06 | T2 | BVA | 2 min 1 s | minutes=3; total=2500 | 46,54,62-66 | high |
| TC-07 | T2,T7 | DT | 50 s; X01 | timeCharge=0; fee=15000; total=15000 | 54-55,111-112 | high |
| TC-08 | T3 | BVA | 29 min | total=2500 | 62-66 | high |
| TC-09 | T3 | BVA | 30 min | total=2500 | 62-66 | high |
| TC-10 | T3 | BVA | 31 min | total=5000 | 62-66 | high |
| TC-11 | T3 | EP | ebike; 75 min | total=12000 | 62-70 | high |
| TC-12 | T4 | BVA | subscriber; 44 min | total=0 | 74-75 | high |
| TC-13 | T4 | BVA | subscriber; 45 min | total=0 | 74-75 | high |
| TC-14 | T4 | BVA | subscriber; 46 min | total=2500 | 74-75 | high |
| TC-15 | T4 | EP | subscriber; 100 min | total=5000 | 74-82 | high |
| TC-16 | T4 | DT | subscriber; ebike; 40 min | timeCharge=8000; subscription=1600; total=6400 | 76-77 | high |
| TC-17 | T4 | BVA | subscriber; ebike; 2 min | total=0 | 54,76-77 | high |
| TC-18 | T5 | EP | reduced; 40 min | timeCharge=5000; reduced=2500; total=2500 | 86-93 | high |
| TC-19 | T5 | DT | subscriber; concession=true; 80 min | reduced=3750; total=3750 | 89-96 | high |
| TC-20 | T5 | DT | subscriber; concession=true; 50 min | subscription=2500; total=2500; tie chooses subscription | 89-91 | high |
| TC-21 | T5 | DT | subscriber; concession=true; 40 min | subscription=5000; total=0 | 74-75,89-91 | high |
| TC-22 | T5,T7 | DT | reduced; 40 min; X01 | reduced time=2500; fee=15000; total=17500 | 86-87,111-112 | high |
| TC-23 | T5,T8 | DT | reduced; 25 h | capped time=30000; fee=200000; total=230000 | 86-87,100-103,119-125 | high |
| TC-24 | T6 | ST | r1; ebike; 80 min each; pickups 2026-09-16 at 06:00Z,10:00Z,15:00Z | totals=12000,12000,6000; chargedOn(r1,2026-09-16)=30000 | 100-106 | high |
| TC-25 | T6 | ST | r1 charged 29000 that day; pickup 2026-09-16T20:40:00Z; return 2026-09-16T21:20:00Z | total deferred Q-1; dayKey(pickup)=2026-09-16; booking belongs to pickup day | 100-107 | high |
| TC-26 | T6 | ST | r1 charged 29000 at 2026-09-16T20:00:00Z; next pickup 2026-09-16T21:10:00Z; 20 min | new Kyiv day=2026-09-17; allowance=30000; timeCharge=2500; total deferred Q-2 | 34,100-103 | high |
| TC-27 | T6 | ST | r1 at cap 30000 on 2026-09-16; r2 rides 20 min same day | total=2500; r1 unchanged; r2 charged=2500 | 100-103 | high |
| TC-28 | T6,T7 | DT | r1 at cap 30000; 20 min; X02 | time due=0; fee=15000; total=15000 | 100-103,111-112 | high |
| TC-29 | T7 | EP | 20 min; each of X01,X02,X03 separately | fee=15000; total=17500 | 111-115,174-176 | high |
| TC-30 | T7 | EP | 20 min; each of S01..S08 separately | fees=[]; total=2500 | 111-112,166-173 | high |
| TC-31 | T8 | BVA | 24 h | no unreturned fee; capped total=30000 | 119-120 | high |
| TC-32 | T8 | BVA | 24 h 1 min | fee=200000; capped total=230000 | 119-125 | high |
| TC-33 | T7,T8 | DT | 25 h; X03 | fees=15000 and 200000; time due=30000; total=245000 | 100-103,111-125 | high |
| TC-34 | T9 | BVA | discount helper amount=1235; percent=30 | discount=371; payable=864 | 129-137 | high |
| TC-35 | T9 | EP | format amounts 230000,-1250,0 | 2 300,00 грн; -12,50 грн; 0,00 грн | 132-135 | high |
| TC-36 | T9 | DT | receipt minutes=1500,timeCharge=125000,discount day-cap=95000,fees out-of-zone=15000 and unreturned=200000,total=245000 | 6 lines: duration,base,negative cap,both fees,До сплати 2 450,00 грн | 132-135 | high |
| TC-37 | T10 | EP | pickup 2026-09-15T22:10:00Z; 30 min | timeCharge=2500; night=750; total=1750 | 141-143 | high |
| TC-38 | T10 | ST | pickup 2026-09-15T21:00:00Z; 30 min | timeCharge=2500; night=750; total=1750; wholly inside night | 37,141-143 | high |
| TC-39 | T10 | ST | pickup 2026-09-16T03:00:00Z; 30 min | discounts=[]; total=2500; wholly after night | 37,141 | high |
| TC-40 | Invalid | EP | returnAt=2026-09-16T06:59:59Z | reject with explanation | 147-149 | high |
| TC-41 | Invalid | EP | bike=cargo; 20 min | reject with explanation | 147-149 | high |
| TC-42 | Invalid | EP | rider.type=visitor; 20 min | reject with explanation | 147-149 | high |
| TC-43 | Invalid | EP | returnStation=S99; 20 min | reject with explanation | 147-149 | high |

## Питання до специфікації

| ID | Rule | Question | Alternatives | Owner | Automation |
|---|---|---|---|---|---|
| Q-1 | T10 | Which discount applies across 00:00 or 06:00? | pickup / whole interval / prorate | product owner | Only wholly inside/outside intervals; TC-03/25 assert duration/base/date only |
| Q-2 | T10,T4,T5,T9 | How do night and plan discounts compose, and in which rounding order? | sequential / additive / choose best | product owner | No combined discount expectations |
| Q-3 | T8,T1 | Is 24 h plus fractional minute assessed using elapsed or rounded time? | actual / rounded | product owner | Exactly 24 h and 24 h 1 min only |
| Q-4 | T9 | Must a chosen zero discount appear in the receipt? | omit / show zero | product owner | No zero discount-line expectation |
| Q-5 | T9 | Which receipt alignment is required? | arbitrary / fixed padding | product owner | Semantic content and amounts only |

## Порівняння чернеток AI

Counts are descriptive, not a controlled causal comparison: A1 received a parent brevity follow-up, and global platform rules remained active.
A rule counts as covered when at least one correct case exists, even if other cases for the rule are wrong.
Unsupported expectations count case rows with at least one behavior/contract not established by the specification; exact API wording counts too.

| Metric | A1 code | A2 specification |
|---|---|---|
| Rules correctly covered | 10/10 | 10/10 |
| Case rows containing unsupported expectations | 25 | 1 |
| Ambiguities explicitly recorded as questions | 0 | 5 |

Coverage witnesses A1: T1=A1-09; T2=02; T3=06; T4=12; T5=11; T6=27; T7=30; T8=34; T9=53; T10=23.
Coverage witnesses A2: T1=A2-07; T2=03; T3=08; T4=20; T5=22; T6=30; T7=39; T8=46; T9=rounding/receipt section; T10=49.
A2 questions: A2-Q1 through A2-Q5; A1 has no explicit question table.

## Що AI вигадав

These are review findings, not edits to the first responses; an unsupported API contract can still be useful in a separately approved API test.

| Draft | Case | Unsupported expectation | Specification / reason |
|---|---|---|---|
| A1 | A1-03 | Rounds 1m29s to 1 rather than 2 | T1:45-47 |
| A1 | A1-04 | Bills 1m30s as 2500 instead of free | T2:54 |
| A1 | A1-05 | Bills exactly 2 min | T2:54 |
| A1 | A1-08 | Rounds 30m29s down | T1:45-47 |
| A1 | A1-16 | Free 45 min on ebike | T4:76-77 |
| A1 | A1-17 | Subtracts free 45 min before ebike percentage | T4:76-77 |
| A1 | A1-21 | Treats string concession as no eligibility | No schema for nonboolean concession in product spec |
| A1 | A1-22 | Crossing 06:00 uses pickup only | T10:141; Q-1 |
| A1 | A1-24 | Sequential night and concession discounts | T5/T10:86-91,141; Q-2 |
| A1 | A1-25 | Crossing midnight uses pickup only | T10:141; Q-1 |
| A1 | A1-26 | Omits a zero night discount line | T9:132-135; Q-4 |
| A1 | A1-29 | Applies night to entire crossing interval | T10:141; Q-1 |
| A1 | A1-31 | Halves outside fee | T5:87 |
| A1 | A1-36 | Halves both fixed fees | T5:87 |
| A1 | A1-41 | Uses UTC day rather than Kyiv day | T6:100-103 |
| A1 | A1-42 | Uses configurable nonproduct cap 1000 | T6:101 mandates 30000 |
| A1 | A1-43 | Requires null input specific QuoteError wording | Not specified by section 4:147-149 |
| A1 | A1-44 | Exact exception type and English message | Section 4 requires rejection/explanation only:147-149 |
| A1 | A1-45 | Rejects missing offset with exact message | Product spec does not define timestamp serialization rejection |
| A1 | A1-46 | Invalid timestamp exact exception wording | Product spec does not specify invalid timestamp handling |
| A1 | A1-47 | Exact bike error wording/type | Section 4:147-149 only requires explanation |
| A1 | A1-48 | Exact station error wording/type | Section 4:147-149 only requires explanation |
| A1 | A1-49 | Exact rider error wording/type | Section 4:147-149 only requires explanation |
| A1 | A1-50 | Ledger rider.id mandatory API contract | Not a product requirement in specification |
| A1 | A1-51 | Allows injected unknown P01 station | Section 4:147-149 and appendix only define listed stations |
| A2 | A2-45 | Assumes 24 h + 1 s fee threshold uses actual rather than rounded duration | T1:45-47, T8:119-120; review question Q-3; no automated expectation for this disputed fraction |

A2-45 is a conservative review flag for an unconfirmed interpretation, not proof the stated total is false.
No independent experiment output was rewritten; preliminary shared-context records remain under ai-runs/shared-context/.
