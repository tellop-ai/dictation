import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { practiceAvailability, practiceStatus, practice } from '../lib/dictation-practice.js';

const original = globalThis.window;
after(() => { if (original === undefined) delete globalThis.window; else globalThis.window = original; });

test('ordinary browsers and old hosts have no invented practice support', async () => {
  for (const value of [undefined, {}, { tellopDictation: { availability: async () => ({ ok: true, available: true, practiceAvailable: true }) } }]) {
    if (value === undefined) delete globalThis.window; else globalThis.window = value;
    for (const read of [practiceAvailability, practiceStatus, practice]) assert.deepEqual(await read(), { ok: false, reason: 'unavailable' });
  }
});

test('capability and status expose only explicit coarse flags and use the current bridge', async () => {
  let calls = 0;
  globalThis.window = { tellopDictation: {
    practice: async () => { calls++; return { ok: true }; },
    availability: async () => ({ ok: true, available: true, practiceAvailable: true, audio: 'private' }),
    status: async () => ({ ok: true, practice: true, text: 'private', practiceInputs: ['private'], target: 'private' }),
  } };
  assert.deepEqual(await practiceAvailability(), { ok: true, available: true });
  assert.deepEqual(await practiceStatus(), { ok: true, active: true });
  assert.equal(calls, 0);
  for (const value of [undefined, null, 'true', false]) {
    globalThis.window.tellopDictation.availability = async () => ({ ok: true, available: true, practiceAvailable: value });
    globalThis.window.tellopDictation.status = async () => ({ ok: true, practice: value });
    assert.deepEqual(await practiceAvailability(), { ok: true, available: false });
    assert.deepEqual(await practiceStatus(), { ok: true, active: false });
  }
  globalThis.window = {};
  assert.deepEqual(await practiceAvailability(), { ok: false, reason: 'unavailable' });
});

test('practice passes only exact language/mode choices and never returns private results', async () => {
  const seen = [];
  globalThis.window = { tellopDictation: { practice: async (...args) => {
    seen.push(args); return { ok: true, text: 'private', audio: 'private', target: 'private', practiceInputs: ['private'] };
  } } };
  for (const language of ['auto', 'en', 'tr']) for (const mode of ['local', 'online']) {
    assert.deepEqual(await practice({ language, mode }), { ok: true });
    assert.deepEqual(seen.at(-1), [{ language, mode }]);
  }
  assert.deepEqual(await practice(), { ok: true });
  assert.deepEqual(seen.at(-1), [{ language: 'auto', mode: 'local' }]);
  for (const value of [null, [], 'local', {}, { language: 'en' }, { language: 'de', mode: 'local' },
    { language: 'en', mode: 'automatic' }, { language: 'en', mode: 'local', inputId: 'private' },
    { language: 'en', mode: 'local', text: 'private' }, { language: 'en', mode: 'local', target: 'private' }])
    assert.deepEqual(await practice(value), { ok: false, reason: 'failed' });
  assert.equal(seen.length, 7);
});

test('malformed, failed and rejected replies never claim success or retry', async () => {
  let calls = 0;
  for (const answer of [undefined, null, [], 'ok', {}, { ok: 'true' }]) {
    globalThis.window = { tellopDictation: { practice: async () => { calls++; return answer; } } };
    assert.deepEqual(await practice(), { ok: false, reason: 'failed' });
  }
  assert.equal(calls, 6);
  for (const reason of ['unavailable', 'unsupported', 'permission', 'not-ready', 'busy', 'failed', 'accessibility']) {
    globalThis.window.tellopDictation.practice = async () => ({ ok: false, reason, text: 'private' });
    assert.deepEqual(await practice(), { ok: false, reason });
  }
  globalThis.window.tellopDictation.practice = async () => ({ ok: false, reason: 'private words' });
  assert.deepEqual(await practice(), { ok: false, reason: 'failed' });
  globalThis.window.tellopDictation.practice = async () => { throw new Error('private detail'); };
  assert.deepEqual(await practice(), { ok: false, reason: 'failed' });
});
