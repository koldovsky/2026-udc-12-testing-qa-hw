import test from 'node:test';
import assert from 'node:assert/strict';

test('tariff: модуль реалізації доступний для тестування', async () => {
  const module = await import('../../app/src/tariff.js');
  assert.ok(module);
});
