import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_CAP, dayKey, createDayCap } from '../../app/src/day-cap.js';

// --- DAY_CAP constant ---

test('DAY_CAP equals 30000', () => {
  assert.equal(DAY_CAP, 30000);
});

// --- dayKey ---

test('dayKey extracts YYYY-MM-DD from a UTC timestamp', () => {
  assert.equal(dayKey(Date.parse('2026-11-05T12:00:00Z')), '2026-11-05');
});

test('dayKey at end of UTC day stays on that day', () => {
  assert.equal(dayKey(Date.parse('2026-11-05T23:59:59Z')), '2026-11-05');
});

test('dayKey advances at UTC midnight', () => {
  assert.equal(dayKey(Date.parse('2026-11-06T00:00:00Z')), '2026-11-06');
});

// --- createDayCap — initial state ---

test('remaining returns the full limit when nothing has been recorded', () => {
  const cap = createDayCap();
  const pickup = Date.parse('2026-11-05T10:00:00Z');
  assert.equal(cap.remaining('r1', pickup), 30000);
});

test('chargedOn returns 0 for a rider with no records', () => {
  const cap = createDayCap();
  assert.equal(cap.chargedOn('r1', '2026-11-05'), 0);
});

// --- record and remaining ---

test('remaining decreases by the recorded amount', () => {
  const cap = createDayCap();
  const pickup = Date.parse('2026-11-05T10:00:00Z');
  cap.record('r1', pickup, 10000);
  assert.equal(cap.remaining('r1', pickup), 20000);
});

test('remaining is zero when the full limit has been recorded', () => {
  const cap = createDayCap();
  const pickup = Date.parse('2026-11-05T10:00:00Z');
  cap.record('r1', pickup, 30000);
  assert.equal(cap.remaining('r1', pickup), 0);
});

test('remaining never goes below zero when recorded over the limit', () => {
  const cap = createDayCap();
  const pickup = Date.parse('2026-11-05T10:00:00Z');
  cap.record('r1', pickup, 30000);
  cap.record('r1', pickup, 5000);
  assert.equal(cap.remaining('r1', pickup), 0);
});

test('multiple records accumulate', () => {
  const cap = createDayCap();
  const pickup = Date.parse('2026-11-05T10:00:00Z');
  cap.record('r1', pickup, 5000);
  cap.record('r1', pickup, 7000);
  assert.equal(cap.chargedOn('r1', '2026-11-05'), 12000);
  assert.equal(cap.remaining('r1', pickup), 18000);
});

// --- isolation between days ---

test('records on different days do not affect each other', () => {
  const cap = createDayCap();
  const day1 = Date.parse('2026-11-05T10:00:00Z');
  const day2 = Date.parse('2026-11-06T10:00:00Z');
  cap.record('r1', day1, 25000);
  assert.equal(cap.remaining('r1', day2), 30000);
  assert.equal(cap.chargedOn('r1', '2026-11-05'), 25000);
  assert.equal(cap.chargedOn('r1', '2026-11-06'), 0);
});

// --- isolation between riders ---

test('records for one rider do not affect another rider on the same day', () => {
  const cap = createDayCap();
  const pickup = Date.parse('2026-11-05T10:00:00Z');
  cap.record('r1', pickup, 25000);
  assert.equal(cap.remaining('r2', pickup), 30000);
  assert.equal(cap.chargedOn('r2', '2026-11-05'), 0);
});

// --- custom limit ---

test('custom limit is used by remaining and stored on cap.limit', () => {
  const cap = createDayCap({ limit: 10000 });
  assert.equal(cap.limit, 10000);
  const pickup = Date.parse('2026-11-05T10:00:00Z');
  assert.equal(cap.remaining('r1', pickup), 10000);
  cap.record('r1', pickup, 10000);
  assert.equal(cap.remaining('r1', pickup), 0);
});
