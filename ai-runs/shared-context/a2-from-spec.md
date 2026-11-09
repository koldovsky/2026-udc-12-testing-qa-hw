- Tool and model: Codex desktop, GPT-6 family (exact runtime model ID unavailable)
- Date: 2026-11-09
- Session scope: Specification-oriented draft using docs/spec/tariffs.md; shared-context fallback.
- Memory/global rules: system/developer instructions, user instructions, root AGENTS.md; shared chat history remains enabled.
- Deviation: this is a sequential same-chat first output, NOT a fresh isolated AI session. The chat had already read the walkthrough, code and specification. Temporary main copies exist, but do not remove prior context. Independence claims and causal model comparisons are therefore not valid. Participant review remains required.
- Requested prompt (verbatim from walkthrough; evaluated within shared context):

> У цій теці — специфікація тарифів велопрокату громади (docs/spec/tariffs.md).
> Читай лише цей файл.
> Склади набір тест-кейсів для розрахунку вартості поїздки. Для кожного кейсу: ID; що
> перевіряє; вхідні дані (усе, від чого залежить результат); очікуваний результат у
> копійках; звідки взято це очікування.
> Запиши відповідь у файл ai-runs/a2-from-spec.md. Нічого іншого не створюй і не змінюй.
> Уточнювальних питань не став; працюй з тим, що є.

---

# Specification-oriented first draft

All amounts are kopecks. Unless overridden: pickup=2026-09-16T07:00:00Z, classic, standard, S01, no accumulated daily charges; return is pickup plus exact duration.

| ID | Rule/check | Input | Expected | Source |
|---|---|---|---|---|
| A2-01 | T1 ceil | 30 min 20 s | minutes 31,total 5000 | lines 45-47,62-66 |
| A2-02 | T2 inclusive false start | 2 min | total 0 | lines 54-55 |
| A2-03 | T2 fees persist | 50 s,X01 | time 0,fee 15000,total 15000 | lines 54-55,111-112 |
| A2-04 | T3 block | 50 min | total 5000 | lines 62-69 |
| A2-05 | T4 classic | subscriber,40 min | total 0 | lines 74-75,81 |
| A2-06 | T4 electric | subscriber,ebike,40 min | time 8000,discount 1600,total 6400 | lines 76-77 |
| A2-07 | T5 fees excluded | reduced,40 min,X01 | time 2500,fee 15000,total 17500 | lines 86-87,111-112 |
| A2-08 | T5 cheaper plan | subscriber,concession=true,80 min | reduced 3750,total 3750 | lines 89-96 |
| A2-09 | T6 cap sequence | same rider r1; fresh ledger; ebike 80 min at 06:00Z,10:00Z,15:00Z on 2026-09-16 | totals 12000,12000,6000 | lines 100-106 |
| A2-10 | T6 Kyiv date | pickup 2026-09-16T21:10:00Z | ledger date 2026-09-17; no total asserted | lines 34,100-102 |
| A2-11 | T7 station | 20 min,X03 | fee 15000,total 17500 | lines 111-115,176 |
| A2-12 | T8 strict threshold | 24 h | capped time 30000,no unreturned fee,total 30000 | lines 119-120 |
| A2-13 | T7+T8 independent | 25 h,X03 | capped time 30000,fees 215000,total 245000 | lines 100-103,111-125 |
| A2-14 | T9 rounding | 1235 kopecks,30% discount | payable 864,discount 371 | lines 129-137 |
| A2-15 | T9 receipt | total 230000 | amount text 2 300,00 грн | lines 132-135 |
| A2-16 | T10 wholly night | pickup 2026-09-15T22:10:00Z,30 min | time 2500,night 750,total 1750 | lines 141-143 |
| A2-17 | validation | return earlier than pickup | reject with explanation | lines 147-149 |

Questions to product owner, not automated: (1) T10 crossing 00:00/06:00: pickup, whole interval or proration? (2) Composition/order of T10 with T4/T5 and rounding? (3) T8: actual or T1-rounded duration at 24 h plus a fractional minute? (4) T9: show zero-valued chosen discounts? (5) T9: required receipt padding? No answer is silently chosen.

