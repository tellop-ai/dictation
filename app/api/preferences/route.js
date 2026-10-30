import { DataError, readDictationPreferencesFor, saveDictationPreferencesFor } from '../../../lib/data/index.js';
import { OWNER_ID } from '../../../lib/owner.js';
export const dynamic = 'force-dynamic';
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
export async function GET() {
  try { return json({ preferences: await readDictationPreferencesFor(OWNER_ID) }); }
  catch { return json({ problem: 'error.storageUnreadable' }, 503); }
}
export async function POST(request) {
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== new URL(request.url).origin) return json({ problem: 'dictation.invalidPreferences' }, 403);
  try {
    // This screen sends two short choices, never recordings or target data.
    const text = await request.text();
    if (text.length > 256) return json({ problem: 'dictation.invalidPreferences' }, 400);
    let payload;
    try { payload = JSON.parse(text); }
    catch { return json({ problem: 'dictation.invalidPreferences' }, 400); }
    const preferences = await saveDictationPreferencesFor(OWNER_ID, payload);
    return json({ ok: true, preferences });
  } catch (error) {
    // The host refuses a Viewer's save and a Member's change of the shared row (`error.cannotChange`): its own words, 403.
    if (error instanceof DataError) return json({ problem: error.messageKey },
      error.messageKey === 'error.saveUnconfirmed' ? 503 : error.messageKey === 'error.cannotChange' ? 403 : 400);
    return json({ problem: 'error.saveFailed' }, 500);
  }
}
export function OPTIONS() { return new Response(null, { status: 405, headers: { allow: 'GET, POST' } }); }
