import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validPreferences, savePreferences } from '../lib/dictation-preferences.js';
const scratch = mkdtempSync(path.join(os.tmpdir(), 'dictation-check-'));
const originalFile = process.env.APP_DATA_FILE;
process.env.APP_DATA_FILE = path.join(scratch, 'app.db');
const { readDictationPreferencesFor, saveDictationPreferencesFor, closeStorage, modelAction } = await import('../lib/data/index.js');
const { GET, POST, OPTIONS } = await import('../app/api/preferences/route.js');
const { OWNER_ID } = await import('../lib/owner.js');
after(async () => {
  await closeStorage(); rmSync(scratch, { recursive: true, force: true });
  if (originalFile === undefined) delete process.env.APP_DATA_FILE; else process.env.APP_DATA_FILE = originalFile;
});
const defaults = { language: 'auto', recognitionMode: 'local' };
function post(value, headers = {}) {
  return POST(new Request('http://app.invalid/api/preferences', { method: 'POST', body: typeof value === 'string' ? value : JSON.stringify(value),
    headers: { 'content-type': 'application/json', ...headers } }));
}

test('reading defaults and opening the address never creates a preference row', async () => {
  assert.deepEqual(await readDictationPreferencesFor(OWNER_ID), defaults);
  const response = await GET(new Request('http://app.invalid/api/preferences?owner=someone-else'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(await response.json(), { preferences: defaults });
  assert.equal(await modelAction('DictationPreference', 'count', {}), 0);
});

test('each owner can save and replace exactly one row without changing another owner', async () => {
  const first = { language: 'tr', recognitionMode: 'local' };
  const second = { language: 'en', recognitionMode: 'online' };
  assert.deepEqual(await saveDictationPreferencesFor('one', first), first);
  await saveDictationPreferencesFor('two', second);
  assert.deepEqual(await readDictationPreferencesFor('one'), first);
  assert.deepEqual(await readDictationPreferencesFor('two'), second);
  await saveDictationPreferencesFor('one', second);
  assert.deepEqual(await readDictationPreferencesFor('one'), second);
  assert.deepEqual(await readDictationPreferencesFor('two'), second);
  assert.equal(await modelAction('DictationPreference', 'count', { where: { ownerId: 'one' } }), 1);
  await assert.rejects(readDictationPreferencesFor(''), /ownerMissing/);
  await assert.rejects(saveDictationPreferencesFor('', defaults), /ownerMissing/);
});

test('the address supplies the owner and refuses all extra or malformed choices', async () => {
  for (const body of ['{', null, [], 1, {}, { language: 'auto', recognitionMode: 'local', ownerId: 'two' },
    { language: 'de', recognitionMode: 'local' }, { language: 'en', recognitionMode: 'cloud' },
    { language: 'en' }]) {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { problem: 'dictation.invalidPreferences' });
  }
  const response = await post({ language: 'tr', recognitionMode: 'online' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, preferences: { language: 'tr', recognitionMode: 'online' } });
  assert.deepEqual(await readDictationPreferencesFor(OWNER_ID), { language: 'tr', recognitionMode: 'online' });
  assert.deepEqual(await readDictationPreferencesFor('two'), { language: 'en', recognitionMode: 'online' });
});

test('the request size boundary and cross-site refusal preserve saved choices', async () => {
  const text = JSON.stringify(defaults);
  for (const length of [255, 256, 257]) {
    const response = await post(text.padEnd(length, ' '));
    assert.equal(response.status, length <= 256 ? 200 : 400);
  }
  const response = await post({ language: 'tr', recognitionMode: 'online' }, { origin: 'https://other.invalid' });
  assert.equal(response.status, 403);
  assert.deepEqual(await readDictationPreferencesFor(OWNER_ID), defaults);
  assert.equal(OPTIONS().status, 405);
});

test('contained reads and upsert carry ownership inside their statements', async () => {
  const previous = process.env.TELLOP_INTERNAL_RECORDS;
  const symbol = Symbol.for('tellop.internalRecordsAction');
  const original = globalThis[symbol];
  const seen = [];
  process.env.TELLOP_INTERNAL_RECORDS = '1';
  globalThis[symbol] = async steps => { seen.push(...steps); return steps[0].action === 'findUnique' ? [null] : [defaults]; };
  try {
    await readDictationPreferencesFor('contained-owner');
    await saveDictationPreferencesFor('contained-owner', defaults);
    assert.equal(seen.length, 2);
    for (const step of seen) assert.deepEqual(step.args.where, { ownerId: 'contained-owner' });
    assert.equal(seen[1].action, 'upsert');
    assert.equal(seen[1].args.create.ownerId, 'contained-owner');
    // The private records codec deliberately revives rows without a prototype.
    // React server components require ordinary objects when passing preferences to the screen.
    globalThis[symbol] = async () => [Object.assign(Object.create(null), defaults)];
    const loaded = await readDictationPreferencesFor('contained-owner');
    assert.equal(Object.getPrototypeOf(loaded), Object.prototype);
    assert.deepEqual(loaded, defaults);
    globalThis[symbol] = async () => { throw new Error('records-delivery-uncertain'); };
    const uncertain = await post(defaults);
    assert.equal(uncertain.status, 503);
    assert.deepEqual(await uncertain.json(), { problem: 'error.saveUnconfirmed' });
  } finally {
    if (previous === undefined) delete process.env.TELLOP_INTERNAL_RECORDS; else process.env.TELLOP_INTERNAL_RECORDS = previous;
    if (original === undefined) delete globalThis[symbol]; else globalThis[symbol] = original;
  }
});

test('a save requires exact confirmation and never mutates the unsaved choices', async () => {
  const values = Object.freeze({ language: 'tr', recognitionMode: 'online' });
  let calls = 0;
  const send = async (_url, request) => {
    calls++; assert.deepEqual(JSON.parse(request.body), values);
    return new Response(JSON.stringify({ ok: true, preferences: values }), { status: 200 });
  };
  assert.deepEqual(await savePreferences(values, send), values);
  assert.equal(calls, 1);
  for (const answer of [{}, { ok: true }, { ok: true, preferences: defaults }, { ok: false, problem: 'error.saveFailed' }])
    await assert.rejects(savePreferences(values, async () => new Response(JSON.stringify(answer))));
  await assert.rejects(savePreferences(values, async () => { throw new Error('offline'); }));
  assert.deepEqual(values, { language: 'tr', recognitionMode: 'online' });
  for (const language of ['auto', 'en', 'tr']) for (const recognitionMode of ['local', 'online'])
    assert.equal(validPreferences({ language, recognitionMode }), true);
});
