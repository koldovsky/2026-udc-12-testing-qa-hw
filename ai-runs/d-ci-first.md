- Tool and model: Codex desktop fresh subagent (fork_turns=none); inherited model, exact runtime model ID unavailable
- Date: 2026-11-09
- Session inputs: C:\Users\pc\AppData\Local\Temp/ws12-okedo-20261109/d-ci: original main app and ci only; executed early in parallel with independent Task A/B experiments.
- Memory/global rules: fresh agent has no parent chat history; platform/system/developer instructions remain active; no participant rules were copied unless specified. Subagents have filesystem access, so isolation relies on explicit read scope plus separate directories, not OS access controls.
- Transport: parent specified temporary working directory and allowed files; Ukrainian experimental prompt below is verbatim.
- Prompt (verbatim):

> У цій теці: ci/ — логи чотирьох невдалих прогонів CI (ci/runs/), зміни, що їх запустили
> (ci/changes/), і опис пайплайна (ci/README.md); app/ — код застосунку і його тести.
> Для кожного прогону визнач, чому він упав, і клас падіння: дефект коду, дефект тесту,
> середовище або нестабільний тест. До кожного — докази (рядок логу, фрагмент diff або
> команда над файлами цієї теки та її вивід) і що виправити.
> Запиши відповідь у файл ai-runs/d-ci-first.md. Не змінюй файли в ci/.
> Уточнювальних питань не став; працюй з тим, що є.

---

# Первинний аналіз CI

| Прогін | Клас основного падіння | Причина |
|---|---|---|
| 1141 | Дефект тесту | Помилкове очікування тривалості через зміну UTC-offset. |
| 1144 | Нестабільний тест | Випадкові дані іноді потрапляють на межу, де помиляється oracle тесту. |
| 1147 | Середовище | Порт 3000 уже зайнятий іншим процесом. |
| 1152 | Дефект коду | Ранній return у feesFor губить другий одночасний збір. |

## 1141

- `ci/runs/run-1141.log:181–195`: упав `clock-change.test.js:11`, `actual: 180`, `expected: 120`; рядок 199 — завершення з кодом 1.
- `ci/changes/run-1141.diff:16–18`: тест передає `02:30+03:00` → `04:30+02:00`, але очікує 120 хвилин і `4 * 2500`.
- `app/src/tariff.js:71`: тривалість визначається різницею інстантів, а не показами станційного годинника.
- Перевірка в цій теці:

```powershell
node --input-type=module -e 'import {quote} from "./app/src/tariff.js"; const pickupAt="2026-10-25T02:30:00+03:00", returnAt="2026-10-25T04:30:00+02:00"; console.log(JSON.stringify({pickupUTC:new Date(pickupAt).toISOString(), returnUTC:new Date(returnAt).toISOString(), quote:quote({pickupAt,returnAt,bike:"classic",returnStation:"S02"},{type:"standard"})}));'
```

```text
{"pickupUTC":"2026-10-24T23:30:00.000Z","returnUTC":"2026-10-25T02:30:00.000Z","quote":{"minutes":180,"timeCharge":15000,"discounts":[{"code":"night","amount":4500}],"fees":[],"total":10500}}
```

- Виправити тест: очікувати 180 хвилин і 15000 копійок `timeCharge`, перейменувати його відповідно до фактичної тривалості.
- Специфікацію `docs/spec/tariffs.md`, на яку посилається код, у цій теці не надано; висновок спирається на явні offset та доступний контракт, а не на незалежну перевірку специфікації.

## 1144

- `ci/runs/run-1144.log:185–188`: упав receipt-тест на classic, 60 хвилин; отримано `50,00 грн`, очікувалося `75,00 грн`.
- `app/test/integration/receipt.test.js:15`: oracle використовує `(Math.floor(minutes / 30) + 1) * PRICE[ride.bike]`.
- `app/src/tariff.js:75`: кількість блоків визначає `Math.ceil(minutes / BLOCK_MINUTES)`; на точних межах 30 і 60 хвилин oracle додає зайвий блок.
- `app/test/helpers/factory.js:10–15`: незафіксований `Math.random()` генерує тривалість 5–89 хвилин, тому помилковий oracle спрацьовує лише на частині запусків.
- `ci/README.md`, таблиця прогонів: повтор того самого коміту успішний, що узгоджується з механізмом випадкового вибору.
- `ci/changes/run-1144.diff` змінює лише HTML/CSS підказки, а не розрахунок ціни чи receipt-тест.
- Виправити oracle на округлення вгору та замінити випадкові приклади детермінованою таблицею, явно включивши 29/30/31 та 59/60/61 хвилин з незалежно заданими очікуваннями.
- `ci/runs/run-1144.log:132–143`: DNS-помилка audit — окрема проблема середовища, але `continue-on-error` дозволив перейти до тестів; основне падіння на рядку 200 спричинив assertion.

## 1147

- `ci/runs/run-1147.log:168–175`: усі 20 тестів пройшли, `fail 0`.
- `ci/runs/run-1147.log:195–210`: `listen EADDRINUSE: address already in use :::3000`, `port: 3000`; застосунок не зміг почати слухати порт.
- `ci/runs/run-1147.log:214–219`: п'ять запитів health повернули 404, потім smoke завершився з кодом 1.
- `app/src/server.js:28–29`: застосунок має GET `/api/health` з відповіддю 200, тому 404 після невдалого bind узгоджується з відповіддю іншого процесу, а не зі зникненням маршруту.
- `ci/changes/run-1147.diff:9–13`: змінено парсинг PORT і повідомлення запуску; обидва варіанти без PORT обирають 3000, маршрут health не змінено.
- `ci/README.md`, таблиця прогонів: повтор також невдалий; це не доводить дефект коду за наявності прямого свідчення конфлікту порту.
- Виправити ізоляцію smoke: визначити власника порту, завершувати лише процеси свого запуску через cleanup/trap та використовувати виділений вільний порт і той самий порт у curl.
- Перевіряти PID запущеного сервера та його успішний bind, щоб чужий HTTP-сервіс не міг підмінити health-перевірку.
- Лог не визначає власника зайнятого порту; не можна назвати конкретний сервіс чи залишений процес.
- Окремо перевірити регресію `PORT=0` через `|| 3000`; лог не містить PORT=0, тому це не встановлена причина цього падіння.

## 1152

- `ci/runs/run-1152.log:185–201`: упав тест `a bike kept over a day and left outside the zone pays both fees`, `fees.length` дорівнює 1 замість 2.
- `app/test/unit/tariff.test.js:64–66`: fixture — 48 годин та станція `X03`; перевіряються одночасні збори.
- `ci/changes/run-1152.diff:15–17`:

```diff
+  if (zone === "out") return [fee("out-of-zone", OUT_OF_ZONE_FEE)];
+  if (minutes > UNRETURNED_AFTER_MINUTES) return [fee("unreturned", UNRETURNED_FEE)];
+  return [];
```

- Перший return перешкоджає перевірці прострочення, коли велосипед повернули поза зоною; попередні два незалежні if накопичували обидва збори.
- Виправити feesFor: накопичувати обидва застосовні збори та повертати масив після обох перевірок.
- Посилити регресійний тест перевіркою кодів і сум обох зборів, а також підсумкової ціни; одна довжина масиву не доводить правильність нарахувань.
- `ci/runs/run-1152.log:132–143`: audit завершився ETIMEDOUT, але `continue-on-error` пропустив запуск далі; основна причина завершення з кодом 1 на рядку 205 — дефект feesFor.

Файли `ci/` не змінювалися; наведені локальні команди не застосовували diff і перевіряли базовий код цієї теки.

