- Tool and model: Codex desktop, GPT-6 family (exact runtime model ID unavailable)
- Date: 2026-11-09
- Session scope: Code-oriented draft against original main app/src; shared-context fallback.
- Memory/global rules: system/developer instructions, user instructions, root AGENTS.md; shared chat history remains enabled.
- Deviation: this is a sequential same-chat first output, NOT a fresh isolated AI session. The chat had already read the walkthrough, code and specification. Temporary main copies exist, but do not remove prior context. Independence claims and causal model comparisons are therefore not valid. Participant review remains required.
- Requested prompt (verbatim from walkthrough; evaluated within shared context):

> У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
> Читай лише файли в app/src/.
> Склади набір тест-кейсів для розрахунку вартості поїздки. Для кожного кейсу: ID; що
> перевіряє; вхідні дані (усе, від чого залежить результат); очікуваний результат у
> копійках; звідки взято це очікування.
> Запиши відповідь у файл ai-runs/a1-from-code.md. Нічого іншого не створюй і не змінюй.
> Уточнювальних питань не став; працюй з тим, що є.

---

# Code-oriented first draft

Inputs: every ride below starts 2026-09-16T07:00:00Z, returns after the stated duration, uses classic/S01/standard unless overridden; no ledger unless specified. Amounts are kopecks. Expectations describe the implementation, not approved behavior.

| ID | Check | Input overrides | Expected | Source |
|---|---|---|---|---|
| A1-01 | rounded duration | 30 min 20 s | minutes 30; total 2500 | tariff.js rideMinutes Math.round |
| A1-02 | free-start threshold | 2 min | total 2500 | chargeFor uses <2 |
| A1-03 | normal blocks | 50 min | timeCharge=total=5000 | chargeFor/blocks |
| A1-04 | classic subscription | subscriber,40 min | total 0 | subscriptionCharge subtracts 45 |
| A1-05 | electric subscription | subscriber,ebike,40 min | total 0 | same subtraction before 20% |
| A1-06 | concession fees | reduced,40 min,X01 | timeCharge 5000; reduced 2500; fee 7500; total 10000 | quote maps fees through reduced discount |
| A1-07 | choose cheaper plan | subscriber,concession=true,80 min | reduced 3750; total 3750 | cheaperPlan |
| A1-08 | daily cap | ebike,80 min at 06:00Z,10:00Z,15:00Z; same rider id=r1; shared fresh ledger | totals 12000,12000,6000 | createDayCap + quote |
| A1-09 | outside zone | 20 min,X01 | fee 15000; total 17500 | feesFor |
| A1-10 | both fees | 25 h,X03 | time 30000; fees 15000,200000; total 245000 | feesFor + cap |
| A1-11 | fractional kopeck | discount(1235,30) | discount 371, payable 864 | discount uses floor |
| A1-12 | night | pickup 2026-09-15T22:10:00Z,30 min | total 1750 | Kyiv hour<6 |
| A1-13 | ledger date | dayKey(2026-09-16T21:10:00Z) | 2026-09-16 | UTC ISO slice |
| A1-14 | invalid station | 20 min,S99 | QuoteError with explanation | readRide |

No questions were identified in this implementation-oriented draft. The code chooses pickup-based night eligibility; that choice requires product validation.

