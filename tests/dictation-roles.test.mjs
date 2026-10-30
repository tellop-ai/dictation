import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canChange } from '../lib/dictation-roles.js';

test('only the owner and a helper may change the shared preferences', () => {
  assert.equal(canChange('owner'), true);
  assert.equal(canChange('helper'), true);
  assert.equal(canChange('member'), false);
  assert.equal(canChange('viewer'), false);
});

test('an answer that is not a known role may change nothing', () => {
  for (const role of [undefined, null, '', 'Owner', ' owner', 'admin', 1, {}, ['owner']]) assert.equal(canChange(role), false);
});
