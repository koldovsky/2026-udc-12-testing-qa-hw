# Червоні тести і дефекти

> Task B. Кожен червоний тест з `ai-runs/b1-run.txt` і `ai-runs/b2-run.txt` — рядок
> таблиці з класом і доказом. Оракул — лише `docs/spec/tariffs.md`.
>
> Класи: **дефект коду** (код розходиться зі специфікацією) · **хибний тест** (тест
> очікує те, чого специфікація не вимагає, або перевіряє неправильно) · **прогалина в
> специфікації** (специфікація не дає однозначної відповіді — це питання, а не дефект).
>
> Середовище всіх прогонів: Node v24.16.0 (`node --version`), Windows 11 Pro 10.0.26300,
> Git Bash; початковий код — коміт `5ab575c` (`app/src/` у ньому збігається з `main`:
> `git diff --stat main 5ab575c -- app/src` нічого не виводить).

## Класифікація червоних тестів

**Прогін «з коду»** (`ai-runs/b1-run.txt`): `ℹ tests 51`, `ℹ pass 51`, `ℹ fail 0` —
червоних тестів немає, класифікувати нічого.

**Прогін «зі специфікації»** (`ai-runs/b2-run.txt`): `ℹ tests 66`, `ℹ pass 53`,
`ℹ fail 13`. Усі 13 — дефекти коду; вони зводяться до 5 причин (BUG-1…BUG-5). Тест із
циклом по таблиці зупиняється на першому розбіжному рядку — у колонці «Доказ» названо саме
цей рядок; після виправлення відповідного дефекту весь тест зелений (колонка «Що зроблено»:
після цього коміту `npm test` показав тест зеленим).

Шляхи тестів — від кореня репо; «b2-run:N» — рядок у `ai-runs/b2-run.txt`. Рядки коду —
у початковому коді (`main`).

| # | Тест (файл › назва) | Прогін | Клас | Доказ (рядок специфікації, команда і вивід) | Що зроблено |
|---|---|---|---|---|---|
| 1 | `app/test/spec/tariff-t1-t3.test.js` › `T1: TC-01 to TC-04 — duration in full minutes, block pricing` | зі специфікації | дефект коду | `docs/spec/tariffs.md:46`: «Неповна хвилина рахується як повна: тривалість округлюється вгору». TC-04 (30 хв 1 с): b2-run:84–86 `TC-04: minutes` `30 !== 31`. Код: `app/src/tariff.js:71` `Math.round(...)` округлює до найближчої хвилини, а не вгору | BUG-1, зелений після `248bbdf` |
| 2 | `app/test/spec/tariff-t1-t3.test.js` › `T2: TC-08 TC-09 — rides over 2 min are charged 1 block` | зі специфікації | дефект коду | `docs/spec/tariffs.md:46`, `:54`. TC-08 (2 хв 1 с): b2-run:124–126 `TC-08: minutes` `2 !== 3` — 2 хв 1 с округлено вниз до 2 хв. Код: `app/src/tariff.js:71` | BUG-1, зелений після `248bbdf` |
| 3 | `app/test/spec/tariff-t4-t5.test.js` › `T4: TC-19 to TC-25 — classic subscriber: 45 free min, then full blocks` | зі специфікації | дефект коду | `docs/spec/tariffs.md:46`, `:74–75` (блоки з 46-ї хвилини). TC-22 (45 хв 1 с → 46 хв → 1 блок): b2-run:166–168 `TC-22` `0 !== 2500`. Код: `app/src/tariff.js:71` (45 хв 1 с → 45 хв) | BUG-1, зелений після `248bbdf` |
| 4 | `app/test/spec/tariff-t7-t8.test.js` › `T8: TC-60 to TC-62 — 24-hour boundary for unreturned-bike fee` | зі специфікації | дефект коду | `docs/spec/tariffs.md:46`, `:119` («понад 24 години»). TC-61 (24 год 1 с → 1 441 хв): b2-run:311–313 `TC-61` `30000 !== 230000` — збір 2 000 грн не нараховано. Код: `app/src/tariff.js:71` (24 год 1 с → 1 440 хв, а `:108` вимагає `> 1440`) | BUG-1, зелений після `248bbdf` |
| 5 | `app/test/spec/tariff-t1-t3.test.js` › `T2: TC-06 TC-07 TC-10 — rides not more than 2 min → zero time charge` | зі специфікації | дефект коду | `docs/spec/tariffs.md:54`: «тривалістю не більше 2 хвилин (за T1) — без погодинного нарахування». TC-07 (рівно 2 хв): b2-run:103–105 `TC-07` `2500 !== 0`. Код: `app/src/tariff.js:79` `minutes < FREE_START_MINUTES` — строга нерівність | BUG-2, зелений після `089ea6f` |
| 6 | `app/test/spec/tariff-t10.test.js` › `T10: TC-80 — false start at night: T2 applies first → zero charge` | зі специфікації | дефект коду | `docs/spec/tariffs.md:54`. Нічна поїздка рівно 2 хв: b2-run:145–147 `TC-80: false start overrides night discount` `1750 !== 0`. Код: `app/src/tariff.js:79` | BUG-2, зелений після `089ea6f` |
| 7 | `app/test/spec/tariff-t4-t5.test.js` › `T4: TC-26 to TC-29 — ebike subscriber: no free minutes, −20 % on time charge` | зі специфікації | дефект коду | `docs/spec/tariffs.md:76–77`: «Електровелосипед: знижка 20 %… Безкоштовних хвилин на електровелосипеді немає». TC-26 (10 хв): b2-run:185–187 `TC-26` `0 !== 3200`. Код: `app/src/tariff.js:84` віднімає 45 безкоштовних хвилин для будь-якого велосипеда | BUG-3, зелений після `4b294a8` |
| 8 | `app/test/spec/tariff-t4-t5.test.js` › `T5: TC-33 to TC-39 — subscriber+concession: cheaper of subscription vs reduced wins` | зі специфікації | дефект коду | `docs/spec/tariffs.md:76–77`, `:89–91`. TC-38 (ebike 30 хв, абонент з пільгою; абонемент 3 200 > пільга 2 000): b2-run:227–229 `TC-38` `0 !== 2000` — абонемент «дав» 0 через безкоштовні хвилини. Код: `app/src/tariff.js:84` | BUG-3, зелений після `4b294a8` |
| 9 | `app/test/spec/tariff-t4-t5.test.js` › `T5: TC-32 — reduced fare does not apply to out-of-zone fee` | зі специфікації | дефект коду | `docs/spec/tariffs.md:87`: «Пільга не поширюється на збори (T7, T8)». b2-run:206–208 `TC-32: total (1250 + 15000)` `8750 !== 16250` — збір 150 грн зменшено до 75 грн. Код: `app/src/tariff.js:63–65` знижує кожен збір на 50 %, коли обрано план `reduced` | BUG-4, зелений після `6f9bc58` |
| 10 | `app/test/spec/tariff-t4-t5.test.js` › `T5: TC-40 — reduced fare + T6 cap + T8 fee: fee not discounted` | зі специфікації | дефект коду | `docs/spec/tariffs.md:87`, `:120`. b2-run:248–250 `TC-40: total (30000 + 200000)` `130000 !== 230000` — збір 2 000 грн зменшено до 1 000 грн. Код: `app/src/tariff.js:63–65` | BUG-4, зелений після `6f9bc58` |
| 11 | `app/test/spec/tariff-t9.test.js` › `T9: TC-68 — receipt for reduced fare + out-of-zone: fee is 150,00 грн, total 162,50 грн` | зі специфікації | дефект коду | `docs/spec/tariffs.md:87`, `:134–135`. b2-run:332 `TC-68: out-of-zone fee 150,00 грн` (`actual: false`) — у чеку збір 75,00 грн. Причина та сама, що в рядку 9: `app/src/tariff.js:63–65`; `app/src/receipt.js` лише друкує суму з `quote` | BUG-4, зелений після `6f9bc58` |
| 12 | `app/test/spec/tariff-t6.test.js` › `T6: TC-45 — pickup at 00:00 Kyiv starts new day; fresh cap + night discount → 1750` | зі специфікації | дефект коду | `docs/spec/tariffs.md:34` («Доба — календарна дата за київським часом»), `:101–102` («доба, на яку припадає момент її взяття за київським часом»). Взяття `2026-09-16T21:00:00Z` = 00:00 17.09 за Києвом: b2-run:269–271 `TC-45: 2500 − 30 % night, fresh cap` `0 !== 1750`. Код: `app/src/day-cap.js:7` бере дату за UTC (`toISOString().slice(0, 10)`) | BUG-5, зелений після `63c2363` |
| 13 | `app/test/spec/tariff-t6.test.js` › `T6: TC-46 TC-47 — EET (UTC+2): Kyiv calendar day boundary at 22:00Z` | зі специфікації | дефект коду | `docs/spec/tariffs.md:34`, `:101–102`. TC-47: взяття `2026-10-27T22:00:00Z` = 00:00 28.10 за Києвом (EET): b2-run:290–292 `TC-47: new Kyiv day, 2500 − 30 %` `0 !== 1750`. Код: `app/src/day-cap.js:7` | BUG-5, зелений після `63c2363` |

**Підсумок класифікації:** дефект коду — 13 тестів (5 дефектів); хибний тест — 0;
прогалина в специфікації — 0 (кейси з розділу «Питання до специфікації» в
`docs/test-cases.md` не автоматизовано, тож червоних тестів-питань немає).

**Нестабільний тест** `app/test/integration/receipt.test.js` › `every receipt of a week
of rides ends with the amount due` — у `ai-runs/b2-run.txt` зелений (рядок 5), але
червоніє то так, то ні без жодних змін у коді (тест бере випадкові поїздки з
`randomRides`). 15 прогонів `node --test test/integration/receipt.test.js` з `app/`: на
копії початкового коду (`main`) — 4 червоні з 15, на виправленому коді (`63c2363`) — теж
4 з 15. Приклад падіння:

```text
AssertionError [ERR_ASSERTION]: ebike, 60 min from 2026-09-21T13:11:00.000Z: got "До сплати .......................... 80,00 грн", expected 120,00 грн
```

У Task B тест не змінювався. У Task D причину знайдено і виправлено в самому тесті (хибний оракул `floor + 1` на межах 30/60 хв + невизначені випадкові дані) — коміт `4784296`, 0 падінь з 50 (`ai-runs/d-repeat-after.txt`); деталі — `docs/triage.md`, розділ 1. Тепер тест називається `T1 T3 T9: the receipt shows the amount due for rides at the 30 and 60 min block boundaries`.

Після всіх виправлень (коміт `63c2363`; прогін, у якому нестабільний тест випав зеленим):

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

```text
ℹ tests 66
ℹ pass 66
ℹ fail 0
```

## Дефекти

| ID | Правило | Коротко | Знайшов прогін з коду? | Знайшов прогін зі специфікації? | Коміт виправлення |
|---|---|---|---|---|---|
| [BUG-1](BUG-1.md) | T1 (і межі T2, T4, T8) | тривалість округлюється до найближчої хвилини замість вгору | ні | так (4 тести) | `248bbdf` |
| [BUG-2](BUG-2.md) | T2 | поїздка рівно 2 хв оплачується, хоча це хибний старт | ні | так (2 тести) | `089ea6f` |
| [BUG-3](BUG-3.md) | T4 | абонент на електровелосипеді має 45 безкоштовних хвилин | ні | так (2 тести) | `4b294a8` |
| [BUG-4](BUG-4.md) | T5 | пільга знижує збори T7 і T8 на 50 % | ні | так (3 тести) | `6f9bc58` |
| [BUG-5](BUG-5.md) | T6 | доба денного ліміту рахується за UTC, а не за київським часом | ні | так (2 тести) | `63c2363` |

Звіт про кожен дефект — у `docs/bugs/BUG-<N>.md`.

## Наявні тести, що почервоніли після виправлення

Усі три — в `app/test/unit/tariff.test.js`; кожен оновлено в тому ж коміті, що й
виправлення. Тести не видалено і перевірку не послаблено: точні значення лишилися точними,
змінилися лише очікування (за специфікацією) і назва, що описувала хибну поведінку.

Доказ, що старі версії тестів червоні на виправленому коді (копія `HEAD` поруч із репо, у
неї підкладено `app/test/unit/tariff.test.js` з `main`):

```bash
rm -rf /c/ws12-runs/check && mkdir -p /c/ws12-runs/check && git archive HEAD app | tar -x -C /c/ws12-runs/check
git show main:app/test/unit/tariff.test.js > /c/ws12-runs/check/app/test/unit/tariff.test.js
cd /c/ws12-runs/check/app && node --test test/unit/tariff.test.js 2>&1 | grep -E "^✖|^ℹ (pass|fail)" | sort -u; cd -
```

```text
ℹ fail 3
ℹ pass 8
✖ a ride of 30 min 20 s is billed as one block (0.8057ms)
✖ failing tests:
✖ reduced fare for a ride returned outside the zone (0.2089ms)
✖ subscribers ride the first 45 minutes free (0.301ms)
```

| Тест (файл › назва) | Що стверджував | Що каже специфікація (рядок) | Що змінили |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` → тепер `a ride of 30 min 20 s is 31 min and billed as two blocks (T1: round up)` | 30 хв 20 с = 30 хв, 1 блок, 2 500 коп | `docs/spec/tariffs.md:46`: неповна хвилина — повна, округлення вгору → 31 хв → 2 блоки (`:62`) → 5 000 коп | `minutes` 30 → 31, `timeCharge` 2500 → 5000, назва; коміт `248bbdf` (BUG-1) |
| `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` → тепер `subscribers ride the first 45 minutes free on a classic bike; an e-bike has no free minutes, 20 % off (T4)`; за рев'ю розділено на `subscribers ride the first 45 minutes free on a classic bike (T4)` і `subscribers get 20 % off on an e-bike, with no free minutes (T4)` (`docs/test-quality.md`, «Зміни тестів за рев'ю») | абонент, 40 хв: 0 і на класичному, і на електровелосипеді | `docs/spec/tariffs.md:74–77`: 45 безкоштовних хвилин — лише класичний; електровелосипед — −20 %, безкоштовних хвилин немає → 40 хв = 2 блоки 8 000 − 20 % = 6 400 | таблиця `{ bike, total }`: classic → 0 (як було), ebike → 6400; назва; коміт `4b294a8` (BUG-3) |
| `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` → тепер `reduced fare for a ride returned outside the zone: the fee is not discounted (T5)` | пільговий, 40 хв, X01: збір 7 500, разом 10 000 | `docs/spec/tariffs.md:87`: пільга не поширюється на збори → збір 15 000 (`:112`); 2 блоки 5 000 − 50 % = 2 500; разом 17 500 | `fees[0].amount` 7500 → 15000, `total` 10000 → 17500, назва; коміт `6f9bc58` (BUG-4) |

### Інші зміни в `app/test/unit/`

`app/test/unit/day-cap.test.js` після виправлення BUG-5 (`63c2363`) не почервонів: його
єдиний момент `2026-09-16T08:00:00Z` має однакову дату в UTC і за Києвом, тож тест проходив
і з дефектом, і без нього. Його змінено пізніше. Жоден тест не видалено, і жодне очікування
не послаблено: лише додано випадки і новий тест.

| Тест (файл › назва) | Що змінили | Чому (специфікація) | Коли |
|---|---|---|---|
| `app/test/unit/day-cap.test.js` › `the day of a ride is the date of its pickup` | до випадку `08:00Z` → `2026-09-16` додано `2026-09-16T21:00:00Z` → `2026-09-17` (літній час EEST) і `2026-10-27T22:00:00Z` → `2026-10-28` (зимовий час EET) | доба для денного ліміту — календарна дата за київським часом (`docs/spec/tariffs.md:34`), а поїздка належить до доби, коли її взяли (`:101–102`). Старі дані не розрізняли дату за UTC і за Києвом, тож не ловили BUG-5. На коді з `main` оновлений тест червоний: `dayKey("2026-09-16T21:00:00Z")` повертає `2026-09-16` замість `2026-09-17` | рев'ю, коміт `deef265` (`docs/test-quality.md`: розділ 2, запах 10; розділ 3, «Зміни тестів за рев'ю») |
| `app/test/unit/day-cap.test.js` › `chargedOn returns 0 for a rider with no charges on that day` (новий) | новий тест: користувачу без поїздок за добу нараховано 0 | денний ліміт рахується від суми нарахувань за добу (T6, `docs/spec/tariffs.md:100`): без поїздок сума — 0, тож ліміт лишається повним | Task C, коміт `6b50650` (`docs/test-quality.md`, розділ 3, «Що агент видалив, пропустив або послабив», рядок 7) |

У Task B тести в `app/test/spec/` не змінювалися: усі 13 червоних були правими за специфікацією.
Пізніші зміни цих тестів (Task C і рев'ю) — з причинами в `docs/test-quality.md`, розділ 3
(«Що агент видалив, пропустив або послабив» і «Зміни тестів за рев'ю»).

## Тести з коду після виправлення (`ai-runs/b1-rerun.txt`)

`node --test "ai-runs/b1-from-code/*.test.js" > ai-runs/b1-rerun.txt` на виправленому коді
(коміт `63c2363`): `ℹ tests 51`, `ℹ pass 48`, `ℹ fail 3`. Усі три були зелені в
`ai-runs/b1-run.txt` на початковому коді.

| Тест (файл › назва) | Що стверджував | Який дефект зафіксував |
|---|---|---|
| `ai-runs/b1-from-code/day-cap.test.js` › `dayKey at end of UTC day stays on that day` | `dayKey(2026-11-05T23:59:59Z)` = `2026-11-05` — доба за UTC; за Києвом це вже 01:59 06.11 (`docs/spec/tariffs.md:34`, `:101–102`). У b1-rerun: `+ '2026-11-06'` / `- '2026-11-05'` | BUG-5 |
| `ai-runs/b1-from-code/tariff.test.js` › `subscriber 90-min ebike: extra 20% ebike discount on billed portion → 6400` | абонент, ebike, 90 хв: спершу 45 безкоштовних хвилин, потім −20 % → знижка 5 600, до сплати 6 400; за `docs/spec/tariffs.md:76–77` — 3 блоки 12 000 − 20 % = 9 600, знижка 2 400. У b1-rerun: `+ amount: 2400` / `- amount: 5600` | BUG-3 |
| `ai-runs/b1-from-code/tariff.test.js` › `reduced rider gets 50% off the out-of-zone fee` | пільговий: збір поза зоною 7 500 замість 15 000 (`docs/spec/tariffs.md:87`). У b1-rerun: `+ amount: 15000` / `- amount: 7500` | BUG-4 |

## Числа

- Дефектів, які знайшли тести з коду: **X = 0** (у `ai-runs/b1-run.txt` 51 з 51 зелені; у таблиці «Дефекти» колонка «Знайшов прогін з коду?» — усюди «ні»)
- Дефектів, які знайшли тести зі специфікації: **Y = 5** (BUG-1…BUG-5; 13 червоних тестів у `ai-runs/b2-run.txt`)
- Тестів з коду, що зафіксували дефект: **Z = 3** (таблиця «Тести з коду після виправлення»: по одному на BUG-3, BUG-4, BUG-5)
