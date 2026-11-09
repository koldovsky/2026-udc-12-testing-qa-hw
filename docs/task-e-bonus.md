# Task E (bonus) — path 2: master test plan

## Шлях 2 — майстер тест-план

- Reviewed plan: docs/test-plan.md; structure follows every numbered section of docs/templates/test-plan.md.
- Oracle: docs/spec/tariffs.md, approved v3; no changes to the specification or template.
- First answer: ai-runs/e-test-plan.md, preserved verbatim after its provenance header; the content hash in that header verifies the original draft.
- Session inputs: only the specification and template in C:\Users\pc\AppData\Local\Temp/ws12-okedo-20261109-e2; fresh subagent with no inherited chat history or participant rules; global platform instructions remained active.
- The draft was generally careful about proposals and unanswered questions; the table below distinguishes a corrected false ambiguity from refinements using repository/homework context unavailable to that session.

### Prompt (verbatim)

```text
У цій теці — специфікація тарифів (docs/spec/tariffs.md) і шаблон тест-плану
(docs/templates/test-plan.md). Склади майстер тест-план для розрахунку вартості поїздки
за цим шаблоном (розділи ISO/IEC/IEEE 29119-3). Кожне твердження про систему — з
посиланням на рядок специфікації. Запиши відповідь у файл ai-runs/e-test-plan.md.
Уточнювальних питань не став; працюй з тим, що є.
```

### Review changes and reasons

| # | Category / draft evidence | Original draft | Reviewed plan | Reason and specification references |
|---|---|---|---|---|
| 1 | Unnecessary ambiguity; ai-runs/e-test-plan.md:256 | Draft question 3 asks whether actual or rounded time changes the >24 h threshold. | Resolve Q-3 with ceil(x)>1440 iff x>1440; explicitly allow the 24 h + 1 s expectation. | T1 fixes ceiling at lines 45–47 and T8 uses a strict 24 h threshold at 119–122; final plan sections 4.3 and Open questions. |
| 2 | Flaky-test exit evidence; ai-runs/e-test-plan.md:145 | Draft proposes 10 consecutive clean runs. | Use the homework requirement of 50 clean runs and keep counts separate from product behavior. | Specification lines 15–19 define the product oracle, not a run-count policy; T3 amounts at 62–70 remain the price oracle. The 50-run obligation comes from docs/walkthrough.md Task D; final section 4.4. |
| 3 | Mutation-score definition; ai-runs/e-test-plan.md:158 | Draft proposes a score denominator excluding invalid/equivalent mutants and an 85% threshold. | Use the actual tool’s raw/reviewed score and report survivor categories separately; do not call a policy-dependent survivor equivalent. | Specification lines 15–19 require an approved oracle; lines 132–135 leave zero-row presentation unspecified. Tool score is defined by tools/mutate.mjs; final sections 4.4–4.5 retain the open M018/M023 limitation. |
| 4 | Unvalidated effort estimates; ai-runs/e-test-plan.md:212 | Draft proposes 8–11 person-days and an eleven-day sequential schedule without implementation access. | Replace with phase gates, explicit unestimated effort and the homework submission deadline; label all staffing as proposed. | Specification lines 5–10 identify approval/effective dates and roles, not testing capacity or duration; final sections 5–7 use docs/walkthrough.md for the homework deadline. |
| 5 | Runnable repository mapping; ai-runs/e-test-plan.md:180 | Draft leaves runtime, modules and invocation unknown because its isolated inputs do not include code. | Map pricing, ledger, time, zones, receipt and HTTP adapter to actual repository paths; identify Node >=22.5 and dependency-free scripts. | Functional scope remains grounded in specification lines 43–149 and stations 166–176; implementation evidence is app/README.md, package.json, app/package.json and app/src/*.js, not invented tariff requirements. |
| 6 | Risk probability evidence; ai-runs/e-test-plan.md:92 | Draft assigns low/medium/high probabilities as preliminary expert estimates without observations. | Use unmeasured likelihood and explicit proposed testing priority; retain concrete monetary impact. | Specification lines 100–103,111–125 and153–155 define limits, fees and changes but do not quantify defect frequencies; final section 3. |

### Validation

- All seven template sections and all seventeen numbered subsections are present in the reviewed plan.
- T1–T10, specified invalid inputs and all eleven station codes are covered by the proposed strategy with exact oracle line references.
- Product facts cite docs/spec/tariffs.md; repository/runtime facts cite the relevant repository files; proposals and unmeasured quantities are labelled.
- Open night/receipt policies remain questions; no price or presentation answer was silently chosen.
- This documentation-only bonus adds no app code, tests, npm dependencies or workflows; existing A–D run outputs and the original first draft are unchanged.
- The plan’s criteria are proposals and existing evidence is linked; this bonus does not assert that every proposed target or unresolved Task C item is complete.
