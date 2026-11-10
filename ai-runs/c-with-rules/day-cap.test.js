import test from 'node:test';
import assert from 'node:assert/strict';

test('day-cap: модуль реалізації доступний для тестування', async () => {
  const module = await import('../../app/src/day-cap.js');
  assert.ok(module);
});
