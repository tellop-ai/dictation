import { AudioLines } from 'lucide-react';
import { readDictationPreferencesFor } from '../lib/data/index.js';
import { DEFAULT_PREFERENCES } from '../lib/dictation-preferences.js';
import { OWNER_ID } from '../lib/owner.js';
import { getLocale, t } from '../lib/i18n/index.js';
import { DictationSettings } from './dictation-settings.jsx';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const locale = getLocale();
  let preferences = DEFAULT_PREFERENCES;
  let problem = '';
  try { preferences = await readDictationPreferencesFor(OWNER_ID); }
  catch { problem = 'error.storageUnreadable'; }
  return (
    <main className="dictation-page" data-tellop-app-marker="ok">
      <header className="dictation-heading">
        <span className="dictation-mark"><AudioLines aria-hidden="true" /></span>
        <div><h1>{t('app.title', locale)}</h1><p className="tagline">{t('app.tagline', locale)}</p></div>
      </header>
      <DictationSettings locale={locale} initialPreferences={preferences} initialProblem={problem} />
    </main>
  );
}
