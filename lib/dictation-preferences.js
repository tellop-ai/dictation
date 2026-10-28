export const DEFAULT_PREFERENCES = Object.freeze({ language: 'auto', recognitionMode: 'local' });
export function validPreferences(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === 2 && Object.hasOwn(value, 'language') && Object.hasOwn(value, 'recognitionMode') &&
    ['auto', 'en', 'tr'].includes(value.language) && ['local', 'online'].includes(value.recognitionMode);
}

/** Never display a save acknowledgement until the server confirms these exact values. */
export async function savePreferences(values, send = fetch) {
  const response = await send('/api/preferences', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(values) });
  const answer = await response.json();
  if (!response.ok || answer?.ok !== true || !validPreferences(answer.preferences) ||
    answer.preferences.language !== values.language || answer.preferences.recognitionMode !== values.recognitionMode) {
    const allowed = ['dictation.invalidPreferences', 'error.saveFailed', 'error.saveUnconfirmed'];
    throw new Error(allowed.includes(answer?.problem) ? answer.problem : 'error.saveUnconfirmed');
  }
  return answer.preferences;
}
