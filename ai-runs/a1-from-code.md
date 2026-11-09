- Tool and model: Codex desktop fresh subagent (fork_turns=none); inherited model, exact runtime model ID unavailable
- Date: 2026-11-09
- Session inputs: C:\Users\pc\AppData\Local\Temp/ws12-okedo-20261109/a1: only original-main app/src; extra parent follow-up: "Please keep the draft focused and finish once a useful rule/edge-case set is written; do not exhaustively enumerate implementation inputs. Preserve your first answer."
- Memory/global rules: fresh agent has no parent chat history; platform/system/developer instructions remain active; no participant rules were copied unless specified. Subagents have filesystem access, so isolation relies on explicit read scope plus separate directories, not OS access controls.
- Transport: parent specified temporary working directory and allowed files; Ukrainian experimental prompt below is verbatim.
- Prompt (verbatim):

> У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
> Читай лише файли в app/src/.
> Склади набір тест-кейсів для розрахунку вартості поїздки. Для кожного кейсу: ID; що
> перевіряє; вхідні дані (усе, від чого залежить результат); очікуваний результат у
> копійках; звідки взято це очікування.
> Запиши відповідь у файл ai-runs/a1-from-code.md. Нічого іншого не створюй і не змінюй.
> Уточнювальних питань не став; працюй з тим, що є.

---

# A1 — тест-кейси з коду

## Початковий запит (дослівно)

```text
У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
Читай лише файли в app/src/.
Склади набір тест-кейсів для розрахунку вартості поїздки. Для кожного кейсу: ID; що
перевіряє; вхідні дані (усе, від чого залежить результат); очікуваний результат у
копійках; звідки взято це очікування.
Запиши відповідь у файл ai-runs/a1-from-code.md. Нічого іншого не створюй і не змінюй.
Уточнювальних питань не став; працюй з тим, що є.
```

## Позначення

Очікування отримані виключно з реалізації `app/src/`, без читання специфікації чи тестів.

Базовий повний ввід: `ride={pickupAt:"2026-09-16T09:00:00Z",returnAt:"2026-09-16T09:10:00Z",bike:"classic",returnStation:"S01"}`, `rider={type:"standard"}`, `options={}`.
Кожен рядок незалежний; його зміни замінюють відповідні базові поля.
`d` задає фактичну тривалість: `returnAt=pickupAt+d*60000` мс, передану як ISO 8601 із Z.
Типові zones: S01–S08 — in, X01–X03 — out (`zones.js`); ledger відсутній.
TC = timeCharge; D = discounts; F = fees; Σ = total; усі суми — копійки, порядок елементів масивів значущий.
Коди у D/F нижче позначають об'єкти `{code,amount}`; порожній масив позначено `[]`.
Джерела у таблиці — функції/константи `tariff.js`, якщо не вказано інший файл.

| ID | Що перевіряє | Вхід: зміни до бази | Очікування | Джерело |
|---|---|---|---|---|
| A1-01 | Нульова тривалість | d=0 | minutes=0; TC=0; D=[]; F=[]; Σ=0 | rideMinutes; chargeFor |
| A1-02 | Безкоштовний початок | d=1 | minutes=1; TC=0; D=[]; F=[]; Σ=0 | chargeFor: minutes < 2 |
| A1-03 | Округлення перед межею | d=1+29/60 | minutes=1; TC=0; D=[]; F=[]; Σ=0 | rideMinutes: Math.round |
| A1-04 | Половина хвилини вгору | d=1.5 | minutes=2; TC=2500; D=[]; F=[]; Σ=2500 | rideMinutes; chargeFor |
| A1-05 | Рівно дві хвилини | d=2 | minutes=2; TC=2500; D=[]; F=[]; Σ=2500 | FREE_START_MINUTES; RATES |
| A1-06 | Кінець першого блоку | d=30 | minutes=30; TC=2500; D=[]; F=[]; Σ=2500 | blocks: ceil(minutes/30) |
| A1-07 | Початок другого блоку | d=31 | minutes=31; TC=5000; D=[]; F=[]; Σ=5000 | blocks; RATES.classic |
| A1-08 | Секунди на межі блоку | d=30+29/60 | minutes=30; TC=2500; D=[]; F=[]; Σ=2500 | rideMinutes; blocks |
| A1-09 | Секунди переходять у другий блок | d=30.5 | minutes=31; TC=5000; D=[]; F=[]; Σ=5000 | rideMinutes; blocks |
| A1-10 | Тариф ebike | bike=ebike; d=31 | minutes=31; TC=8000; D=[]; F=[]; Σ=8000 | RATES.ebike=4000 |
| A1-11 | Пільговий тариф | rider={type:"reduced"}; d=31 | minutes=31; TC=5000; D=[reduced:2500]; F=[]; Σ=2500 | cheaperPlan; REDUCED_PERCENT |
| A1-12 | Безкоштовні 45 хв абонемента | rider={type:"subscriber"}; d=45 | minutes=45; TC=5000; D=[subscription:5000]; F=[]; Σ=0 | subscriptionCharge |
| A1-13 | Перша платна хв абонемента | rider={type:"subscriber"}; d=46 | minutes=46; TC=5000; D=[subscription:2500]; F=[]; Σ=2500 | subscriptionCharge: blocks(minutes-45) |
| A1-14 | Кінець платного блоку абонемента | rider={type:"subscriber"}; d=75 | minutes=75; TC=7500; D=[subscription:5000]; F=[]; Σ=2500 | subscriptionCharge |
| A1-15 | Наступний блок абонемента | rider={type:"subscriber"}; d=76 | minutes=76; TC=7500; D=[subscription:2500]; F=[]; Σ=5000 | subscriptionCharge |
| A1-16 | Безкоштовний ebike абонемента | rider={type:"subscriber"}; bike=ebike; d=45 | minutes=45; TC=8000; D=[subscription:8000]; F=[]; Σ=0 | subscriptionCharge |
| A1-17 | 20% ebike після 45 хв | rider={type:"subscriber"}; bike=ebike; d=46 | minutes=46; TC=8000; D=[subscription:4800]; F=[]; Σ=3200 | SUBSCRIPTION_EBIKE_PERCENT |
| A1-18 | Абонемент вигідніший за пільгу | rider={type:"subscriber",concession:true}; d=45 | minutes=45; TC=5000; D=[subscription:5000]; F=[]; Σ=0 | cheaperPlan |
| A1-19 | Нічия тарифів залишає абонемент | rider={type:"subscriber",concession:true}; d=60; returnStation=X01 | minutes=60; TC=5000; D=[subscription:2500]; F=[out-of-zone:15000]; Σ=17500 | cheaperPlan: >; fees.map лише для reduced |
| A1-20 | Пільга вигідніша за абонемент | rider={type:"subscriber",concession:true}; d=120 | minutes=120; TC=10000; D=[reduced:5000]; F=[]; Σ=5000 | subscriptionCharge=7500; reduced залишає 5000 |
| A1-21 | concession перевіряється строго | rider={type:"subscriber",concession:"true"}; d=120 | minutes=120; TC=10000; D=[subscription:2500]; F=[]; Σ=7500 | concession === true |
| A1-22 | Ніч за Києвом | pickupAt=2026-09-16T05:59:00+03:00; returnAt=2026-09-16T06:09:00+03:00 | minutes=10; TC=2500; D=[night:750]; F=[]; Σ=1750 | kyiv-time.js; pickup.hour < 6 |
| A1-23 | О 06:00 знижки немає | pickupAt=2026-09-16T06:00:00+03:00; returnAt=2026-09-16T06:10:00+03:00 | minutes=10; TC=2500; D=[]; F=[]; Σ=2500 | NIGHT_UNTIL_HOUR |
| A1-24 | Ніч після пільги | rider={type:"reduced"}; pickupAt=2026-09-16T01:00:00+03:00; returnAt=2026-09-16T01:10:00+03:00 | minutes=10; TC=2500; D=[reduced:1250,night:375]; F=[]; Σ=875 | порядок дій quote |
| A1-25 | Ніч визначає лише початок | pickupAt=2026-09-15T23:59:00+03:00; returnAt=2026-09-16T00:09:00+03:00 | minutes=10; TC=2500; D=[]; F=[]; Σ=2500 | kyivTime(pickup) |
| A1-26 | Нульова плата без нічного рядка | rider={type:"subscriber"}; pickupAt=2026-09-16T01:00:00+03:00; returnAt=2026-09-16T01:10:00+03:00 | minutes=10; TC=2500; D=[subscription:2500]; F=[]; Σ=0 | quote: due > 0 |
| A1-27 | Ліміт навіть без ledger | d=361 | minutes=361; TC=32500; D=[day-cap:2500]; F=[]; Σ=30000 | allowance=DAY_CAP; day-cap.js |
| A1-28 | Рівність ліміту | d=360 | minutes=360; TC=30000; D=[]; F=[]; Σ=30000 | due > allowance |
| A1-29 | Ніч перед лімітом | pickupAt=2026-09-16T01:00:00+03:00; returnAt=2026-09-16T07:01:00+03:00 | minutes=361; TC=32500; D=[night:9750]; F=[]; Σ=22750 | порядок дій quote |
| A1-30 | Повернення поза зоною | returnStation=X02 | minutes=10; TC=2500; D=[]; F=[out-of-zone:15000]; Σ=17500 | zones.js; feesFor |
| A1-31 | Пільга на збір | returnStation=X03; rider={type:"reduced"} | minutes=10; TC=2500; D=[reduced:1250]; F=[out-of-zone:7500]; Σ=8750 | fees.map |
| A1-32 | За безкоштовного початку пільга на збір не діє | d=1; returnStation=X01; rider={type:"reduced"} | minutes=1; TC=0; D=[]; F=[out-of-zone:15000]; Σ=15000 | cheaperPlan залишає none за нульового amount |
| A1-33 | Збір понад ліміт | d=361; returnStation=X01 | minutes=361; TC=32500; D=[day-cap:2500]; F=[out-of-zone:15000]; Σ=45000 | fees додаються після ліміту |
| A1-34 | Рівно 24 години | d=1440 | minutes=1440; TC=120000; D=[day-cap:90000]; F=[]; Σ=30000 | feesFor: minutes > 1440 |
| A1-35 | Обидва збори | d=1441; returnStation=X01 | minutes=1441; TC=122500; D=[day-cap:92500]; F=[out-of-zone:15000,unreturned:200000]; Σ=245000 | feesFor; quote |
| A1-36 | Пільга на обидва збори | d=1441; returnStation=X01; rider={type:"reduced"} | minutes=1441; TC=122500; D=[reduced:61250,day-cap:31250]; F=[out-of-zone:7500,unreturned:100000]; Σ=137500 | cheaperPlan; fees.map |

## Реєстр денного ліміту

Кожен рядок створює окремий `L=createDayCap()` із `day-cap.js` та передає `options={dayCap:L}`; zones типові.
Підготовчі record є частиною вводу; rider та ride беруться з бази з наведеними змінами.

| ID | Що перевіряє | Вхід | Очікування | Джерело |
|---|---|---|---|---|
| A1-37 | Частково використаний ліміт | rider={type:"standard",id:"r1"}; L.record("r1","2026-09-16T08:00:00Z",29000) | minutes=10; TC=2500; D=[day-cap:1500]; F=[]; Σ=1000; L.chargedOn("r1","2026-09-16")=30000 | remaining; record; quote |
| A1-38 | Вичерпаний ліміт не прибирає збір | rider={type:"standard",id:"r1"}; returnStation=X01; L.record("r1","2026-09-16T08:00:00Z",30000) | minutes=10; TC=2500; D=[day-cap:2500]; F=[out-of-zone:15000]; Σ=15000; chargedOn("r1","2026-09-16")=30000 | ledger записує лише due |
| A1-39 | Незалежність користувачів | rider={type:"standard",id:"r2"}; L.record("r1","2026-09-16T08:00:00Z",30000) | minutes=10; TC=2500; D=[]; F=[]; Σ=2500 | keyOf містить riderId |
| A1-40 | Незалежність UTC-днів | rider={type:"standard",id:"r1"}; L.record("r1","2026-09-15T20:00:00Z",30000) | minutes=10; TC=2500; D=[]; F=[]; Σ=2500 | dayKey: toISOString().slice(0,10) |
| A1-41 | Київська північ не скидає UTC-ліміт | rider={type:"standard",id:"r1"}; pickupAt=2026-09-17T00:10:00+03:00; returnAt=2026-09-17T00:20:00+03:00; L.record("r1","2026-09-16T20:00:00Z",30000) | minutes=10; TC=2500; D=[night:750,day-cap:1750]; F=[]; Σ=0 | dayKey бере UTC 2026-09-16; ніч перед лімітом |
| A1-42 | Власний limit | rider={type:"standard",id:"r1"}; L=createDayCap({limit:1000}) | minutes=10; TC=2500; D=[day-cap:1500]; F=[]; Σ=1000 | createDayCap({limit}); remaining |

## Валідація та інші входи

За помилки сума в копійках відсутня, бо функція кидає QuoteError.

| ID | Що перевіряє | Вхід: зміни до бази | Очікування | Джерело |
|---|---|---|---|---|
| A1-43 | Поїздка обов'язкова | ride=null | QuoteError("ride is required"); суми немає | readRide |
| A1-44 | Від'ємна тривалість | returnAt=2026-09-16T08:59:59Z | QuoteError("returnAt is before pickupAt"); суми немає | readRide |
| A1-45 | Offset обов'язковий | pickupAt=2026-09-16T09:00:00 | QuoteError("pickupAt must be an ISO 8601 date-time with an offset"); суми немає | instant; ISO_DATE_TIME |
| A1-46 | Невалідний час | returnAt=2026-09-16T99:00:00Z | QuoteError("returnAt is not a valid date-time"); суми немає | instant; Date.parse |
| A1-47 | Невідомий велосипед | bike=cargo | QuoteError("unknown bike type: cargo"); суми немає | readRide |
| A1-48 | Невідома станція | returnStation=S99 | QuoteError("unknown station: S99"); суми немає | zoneOf; readRide |
| A1-49 | Невідомий тип користувача | rider={type:"guest"} | QuoteError("unknown rider type: guest"); суми немає | readRider |
| A1-50 | Ledger потребує id | options={dayCap:createDayCap()} | QuoteError("rider.id is required with a daily cap ledger"); суми немає | readRider |
| A1-51 | Ін'єкція зон | returnStation=P01; options={zones:createZones({P01:{name:"Test",zone:"out"}})} | minutes=10; TC=2500; D=[]; F=[out-of-zone:15000]; Σ=17500 | zones.js: createZones; feesFor |
| A1-52 | Еквівалентні offset | pickupAt=2026-09-16T12:00:00+03:00; returnAt=2026-09-16T09:10:00Z | minutes=10; TC=2500; D=[]; F=[]; Σ=2500 | instant переводить у epoch milliseconds |
| A1-53 | Копійчане округлення допоміжної функції | Окремий виклик discount(101,30); ride/rider/options не застосовуються | знижка 31; залишок 70 | discount: amount - floor(amount*(100-percent)/100) |

