/**
 * App-owned microphone practice entry for compatible Tellop hosts.
 * Only practice() is an action, called directly from the person's press.
 * Tellop owns recording, recognition and its private practice result.
 * These reads return only capability/session flags, never audio or words.
 */
const LANGUAGES = new Set(['auto', 'en', 'tr']);
const MODES = new Set(['local', 'online']);
const REASONS = new Set(['unavailable', 'unsupported', 'permission', 'not-ready', 'busy', 'failed', 'accessibility']);
const refused = (reason = 'unavailable') => ({ ok: false, reason });

async function call(method, options) {
  try {
    const bridge = typeof window === 'undefined' ? undefined : window.tellopDictation;
    if (typeof bridge?.practice !== 'function' || typeof bridge?.[method] !== 'function') return refused();
    const answer = await (options === undefined ? bridge[method]() : bridge[method](options));
    if (answer === null || typeof answer !== 'object' || Array.isArray(answer) || typeof answer.ok !== 'boolean') return refused('failed');
    if (!answer.ok) return refused(REASONS.has(answer.reason) ? answer.reason : 'failed');
    if (method === 'availability') return { ok: true, available: answer.available === true && answer.practiceAvailable === true };
    if (method === 'status') return { ok: true, active: answer.practice === true };
    return { ok: true };
  } catch { return refused('failed'); }
}

export async function practiceAvailability() { return await call('availability'); }
export async function practiceStatus() { return await call('status'); }
export async function practice(options = { language: 'auto', mode: 'local' }) {
  if (options === null || typeof options !== 'object' || Array.isArray(options) ||
    Object.keys(options).length !== 2 || !Object.hasOwn(options, 'language') || !Object.hasOwn(options, 'mode') ||
    !LANGUAGES.has(options.language) || !MODES.has(options.mode)) return refused('failed');
  return await call('practice', { language: options.language, mode: options.mode });
}
