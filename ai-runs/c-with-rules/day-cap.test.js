// Unit-тести для app/src/day-cap.js.
//
// УВАГА: специфікація docs/spec/tariffs.md у цьому завданні недоступна. Кожне очікування —
// контракт коду, не правило специфікації. Межа за замовчуванням 300 грн = 30000 коп. взята з
// коду і записана числом, а не через DAY_CAP.
//
// Яка доба рахується для денної межі (за UTC чи за Києвом), — відкрите питання: dayKey зараз
// бере дату за UTC. Тому всі моменти тут — удень, коли дата за UTC і за Києвом однакова;
// випадок 21:30Z (інша доба за Києвом) винесено у звіт як питання.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createDayCap, dayKey } from "../../app/src/day-cap.js";

const MORNING = "2026-07-10T09:00:00+03:00"; // 06:00Z
const EVENING = "2026-07-10T18:00:00+03:00"; // 15:00Z, та сама доба і за UTC, і за Києвом
const NEXT_DAY = "2026-07-11T12:00:00+03:00"; // 09:00Z

test("контракт коду: межа за замовчуванням — 30000 коп. (300 грн)", () => {
  const cap = createDayCap();
  assert.equal(cap.limit, 30000);
  assert.equal(cap.remaining("r1", MORNING), 30000);
});

test("контракт коду: власна межа з параметра limit", () => {
  const cap = createDayCap({ limit: 12345 });
  assert.equal(cap.limit, 12345);
  assert.equal(cap.remaining("r1", MORNING), 12345);
});

test("контракт коду: після запису 120 грн залишок 180 грн", () => {
  const cap = createDayCap();
  cap.record("r1", MORNING, 12000);
  assert.equal(cap.remaining("r1", EVENING), 18000); // 300 − 120 грн
});

test("контракт коду: записи за одну добу підсумовуються", () => {
  const cap = createDayCap();
  cap.record("r1", MORNING, 12000);
  cap.record("r1", EVENING, 5000);
  assert.equal(cap.chargedOn("r1", "2026-07-10"), 17000); // 120 + 50 грн
  assert.equal(cap.remaining("r1", EVENING), 13000); // 300 − 170 грн
});

test("контракт коду: рівно 300 грн записано — залишок 0", () => {
  const cap = createDayCap();
  cap.record("r1", MORNING, 30000);
  assert.equal(cap.remaining("r1", EVENING), 0);
});

test("контракт коду: записано понад межу — залишок 0, не від'ємний", () => {
  const cap = createDayCap();
  cap.record("r1", MORNING, 30100); // 301 грн
  assert.equal(cap.remaining("r1", EVENING), 0);
  assert.equal(cap.chargedOn("r1", "2026-07-10"), 30100);
});

test("контракт коду: інший райдер тієї ж доби не зачеплений", () => {
  const cap = createDayCap();
  cap.record("r1", MORNING, 30000);
  assert.equal(cap.remaining("r2", MORNING), 30000);
  assert.equal(cap.chargedOn("r2", "2026-07-10"), 0);
});

test("контракт коду: наступна доба має повну межу", () => {
  const cap = createDayCap();
  cap.record("r1", MORNING, 30000);
  assert.equal(cap.remaining("r1", NEXT_DAY), 30000);
  assert.equal(cap.chargedOn("r1", "2026-07-11"), 0);
});

test("контракт коду: chargedOn для доби без записів — 0", () => {
  const cap = createDayCap();
  assert.equal(cap.chargedOn("r1", "2026-07-10"), 0);
});

test("контракт коду: момент як рядок із зсувом і як мілісекунди — та сама доба", () => {
  // quote передає в журнал мілісекунди (Date.parse), тож обидві форми мають давати один ключ.
  const cap = createDayCap();
  cap.record("r1", MORNING, 10000);
  assert.equal(cap.remaining("r1", Date.parse(EVENING)), 20000); // 300 − 100 грн
});

test("контракт коду: той самий момент з різними зсувами — та сама доба", () => {
  // 18:00+03:00 і 15:00Z — один момент.
  const cap = createDayCap();
  cap.record("r1", "2026-07-10T18:00:00+03:00", 10000);
  assert.equal(cap.remaining("r1", "2026-07-10T15:00:00Z"), 20000); // 300 − 100 грн
});

test("контракт коду: dayKey удень — дата YYYY-MM-DD", () => {
  // 12:00 за Києвом = 09:00Z: дата однакова за будь-якого тлумачення доби.
  assert.equal(dayKey("2026-07-10T12:00:00+03:00"), "2026-07-10");
});
