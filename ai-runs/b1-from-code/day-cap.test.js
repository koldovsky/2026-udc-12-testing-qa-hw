import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DAY_CAP, createDayCap, dayKey } from "../../app/src/day-cap.js";

const NOON = "2026-01-15T10:00:00Z";
const EVENING = "2026-01-15T20:00:00Z";
const NEXT_DAY = "2026-01-16T10:00:00Z";

describe("DAY_CAP", () => {
  test("дорівнює 30000 копійок", () => {
    assert.equal(DAY_CAP, 30000);
  });
});

describe("dayKey", () => {
  test("повертає дату YYYY-MM-DD для рядка ISO", () => {
    assert.equal(dayKey(NOON), "2026-01-15");
  });

  test("приймає мілісекунди так само, як рядок", () => {
    assert.equal(dayKey(Date.parse(NOON)), "2026-01-15");
  });

  test("кидає RangeError на некоректну дату", () => {
    assert.throws(() => dayKey("не дата"), RangeError);
  });
});

describe("createDayCap", () => {
  test("типовий ліміт — DAY_CAP", () => {
    assert.equal(createDayCap().limit, 30000);
  });

  test("приймає власний ліміт", () => {
    const ledger = createDayCap({ limit: 5000 });
    assert.equal(ledger.limit, 5000);
    assert.equal(ledger.remaining("r1", NOON), 5000);
  });

  test("новий райдер має весь ліміт і нуль нарахувань", () => {
    const ledger = createDayCap();
    assert.equal(ledger.remaining("r1", NOON), 30000);
    assert.equal(ledger.chargedOn("r1", "2026-01-15"), 0);
  });

  test("record зменшує залишок і накопичує суму за день", () => {
    const ledger = createDayCap();
    ledger.record("r1", NOON, 2500);
    ledger.record("r1", EVENING, 4000);
    assert.equal(ledger.remaining("r1", NOON), 23500);
    assert.equal(ledger.chargedOn("r1", "2026-01-15"), 6500);
  });

  test("залишок дорівнює нулю, коли ліміт вичерпано рівно", () => {
    const ledger = createDayCap();
    ledger.record("r1", NOON, 30000);
    assert.equal(ledger.remaining("r1", NOON), 0);
  });

  test("залишок не стає від'ємним, коли ліміт перевищено", () => {
    const ledger = createDayCap();
    ledger.record("r1", NOON, 30001);
    assert.equal(ledger.remaining("r1", NOON), 0);
    assert.equal(ledger.chargedOn("r1", "2026-01-15"), 30001);
  });

  test("нарахування одного райдера не впливають на іншого", () => {
    const ledger = createDayCap();
    ledger.record("r1", NOON, 10000);
    assert.equal(ledger.remaining("r2", NOON), 30000);
    assert.equal(ledger.chargedOn("r2", "2026-01-15"), 0);
  });

  test("наступного дня ліміт доступний знову", () => {
    const ledger = createDayCap();
    ledger.record("r1", NOON, 30000);
    assert.equal(ledger.remaining("r1", NEXT_DAY), 30000);
    assert.equal(ledger.chargedOn("r1", "2026-01-16"), 0);
  });

  test("окремі журнали не мають спільного стану", () => {
    const first = createDayCap();
    const second = createDayCap();
    first.record("r1", NOON, 10000);
    assert.equal(second.remaining("r1", NOON), 30000);
  });

  test("нульовий запис не змінює залишок", () => {
    const ledger = createDayCap();
    ledger.record("r1", NOON, 0);
    assert.equal(ledger.remaining("r1", NOON), 30000);
  });
});

// Фіксує те, що код робить зараз. Чи так задумано, з app/src/ встановити не можна:
// сервіс має kyivTime(), а межа доби тут — північ UTC. Якщо специфікація вимагає
// київську добу, ці тести мають змінитися разом із виправленням коду.
describe("[не звірено зі специфікацією] межа доби в журналі — північ UTC", () => {
  test("00:30 за Києвом 16 січня потрапляє на 15 січня", () => {
    assert.equal(dayKey("2026-01-16T00:30:00+02:00"), "2026-01-15");
  });

  test("влітку 02:59 за Києвом ще належить попередній даті", () => {
    assert.equal(dayKey("2026-07-16T02:59:00+03:00"), "2026-07-15");
  });

  test("дві поїздки однієї київської доби мають окремі ліміти", () => {
    const ledger = createDayCap();
    ledger.record("r1", "2026-01-16T00:30:00+02:00", 30000);
    assert.equal(ledger.remaining("r1", "2026-01-16T12:00:00+02:00"), 30000);
  });

  test("поїздки двох різних київських діб ділять один ліміт", () => {
    const ledger = createDayCap();
    ledger.record("r1", "2026-01-15T12:00:00+02:00", 30000);
    assert.equal(ledger.remaining("r1", "2026-01-16T00:30:00+02:00"), 0);
  });
});
