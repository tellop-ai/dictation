"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Cloud, Laptop, Mic, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { availability, status, show, hide, openAccessibilitySettings } from '../lib/dictation.js';
import { savePreferences } from '../lib/dictation-preferences.js';
import { t } from '../lib/i18n/index.js';

/** The words a save may answer with; anything else reads as an unconfirmed save. */
const SAVE_PROBLEMS = ['error.saveFailed', 'error.saveUnconfirmed', 'error.cannotChange', 'error.saveRefused', 'dictation.invalidPreferences'];

/** `canChange` comes from the page (`lib/dictation-roles.js`): without it the saved choices show with no Save. */
export function DictationSettings({ locale, initialPreferences, initialProblem, canChange }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saved, setSaved] = useState(initialPreferences);
  const [saveMessage, setSaveMessage] = useState(initialProblem);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const [host, setHost] = useState(null);
  const [session, setSession] = useState(null);
  const [action, setAction] = useState('');
  const [actionProblem, setActionProblem] = useState('');
  const mounted = useRef(false);
  const refreshNumber = useRef(0);
  const refresh = useCallback(async () => {
    const turn = ++refreshNumber.current;
    setChecking(true);
    const [available, current] = await Promise.all([availability(), status()]);
    if (mounted.current && turn === refreshNumber.current) { setHost(available); setSession(current); setChecking(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => { mounted.current = false; ++refreshNumber.current; window.removeEventListener('focus', focus); };
  }, [refresh]);
  function change(values) {
    setPreferences(current => ({ ...current, ...values }));
    setSaveMessage('');
    setActionProblem('');
  }
  async function save(event) {
    event.preventDefault();
    setSaveMessage(''); setSaving(true);
    try {
      const confirmed = await savePreferences(preferences);
      if (mounted.current) { setSaved(confirmed); setSaveMessage('dictation.saved'); }
    } catch (error) {
      if (mounted.current) setSaveMessage(SAVE_PROBLEMS.includes(error.message) ? error.message : 'error.saveFailed');
    } finally { if (mounted.current) setSaving(false); }
  }
  async function microphone(kind) {
    setAction(kind); setActionProblem('');
    // Call immediately from this press. No save, read or other await before show.
    const answer = await (kind === 'settings' ? openAccessibilitySettings() :
      kind === 'show' ? show({ language: preferences.language, mode: preferences.recognitionMode }) : hide());
    if (!mounted.current) return;
    if (!answer.ok) setActionProblem(`dictation.${answer.reason ?? 'failed'}`);
    setAction('');
    await refresh();
  }
  const dirty = preferences.language !== saved.language || preferences.recognitionMode !== saved.recognitionMode;
  const compatible = host?.ok === true && host.available === true && session?.ok === true;
  const access = compatible ? session.accessibility : undefined;
  const working = action !== '';
  const mode = preferences.recognitionMode;
  const canShow = compatible && access === 'granted';
  const ready = compatible && access === 'granted' && (mode === 'online' || session.readiness === 'ready');
  const reason = session?.reason ?? host?.reason;
  const title = checking ? 'checking' : ready ? 'setupReady' : compatible ? 'setupNeeded' : 'setupUnavailable';
  const statusKey = actionProblem || (reason ? `dictation.${reason}` :
    canShow && mode === 'local' && session.readiness !== 'ready' ? 'dictation.offlineSetupDetail' :
    session?.visible ? `dictation.${session.state}` : ready ? 'dictation.readyDetail' : 'dictation.setupDetail');
  return (
    <>
      <section className="dictation-setup" aria-labelledby="dictation-setup-title" aria-busy={checking} data-ready={ready && !checking}>
        <div className="dictation-setup-heading">
          <span className="dictation-setup-icon">{ready && !checking ? <Check aria-hidden="true" /> : <Mic aria-hidden="true" />}</span>
          <div><h2 id="dictation-setup-title">{t(`dictation.${title}`, locale)}</h2>
            <p role="status" aria-live="polite">{t(statusKey, locale)}</p></div>
        </div>
        {compatible ? <div className="dictation-permissions">
          <div className="dictation-permission-row">
            <div><strong>{t('dictation.accessibilityLabel', locale)}</strong><p>{t('dictation.accessibilityDetail', locale)}</p></div>
            <span className="dictation-permission-value">{t(`dictation.access.${checking ? 'checking' : access ?? 'unavailable'}`, locale)}</span>
          </div>
          {mode === 'local' ? <div className="dictation-download" role="status">
            <Laptop aria-hidden="true" /><span>{t(`dictation.readiness.${session.readiness ?? 'absent'}`, locale)}
            {session.readiness === 'downloading' && typeof session.progress === 'number' ?
              ` ${t('dictation.progress', locale, { percent: String(Math.floor(session.progress * 100)) })}` : null}</span>
          </div> : null}
        </div> : null}
        <div className="dictation-actions">
          {compatible && access !== 'granted' ? <Button type="button" disabled={working || checking} onClick={() => void microphone('settings')}>
            {t('dictation.openAccessibility', locale)}<ArrowUpRight aria-hidden="true" />
          </Button> : <Button type="button" disabled={working || checking || !canShow} onClick={() => void microphone('show')}>
            <Mic aria-hidden="true" />{t(action === 'show' ? 'dictation.showing' : canShow && !ready ? 'dictation.prepareOffline' : 'dictation.show', locale)}
          </Button>}
          {session?.visible === true ? <Button type="button" variant="outline" disabled={working} onClick={() => void microphone('hide')}>
            <X aria-hidden="true" />{t(action === 'hide' ? 'dictation.hiding' : 'dictation.hide', locale)}
          </Button> : null}
          <Button type="button" variant="ghost" disabled={working || checking} onClick={() => { setActionProblem(''); void refresh(); }}>
            <RefreshCw aria-hidden="true" />{t('dictation.refresh', locale)}
          </Button>
        </div>
        {compatible ? <p className="dictation-setup-note">{t(access === 'granted' ? 'dictation.microphoneNote' : 'dictation.settingsNote', locale)}</p> : null}
      </section>
      {canChange ? <form onSubmit={save} className="dictation-form">
        <div className="dictation-section-heading"><h2>{t('dictation.preferences', locale)}</h2>
          <Button type="submit" variant="ghost" size="sm" disabled={saving || !dirty}>{t(saving ? 'dictation.saving' : 'dictation.save', locale)}</Button>
        </div>
        <fieldset disabled={saving} className="dictation-fieldset">
          <legend className="dictation-label">{t('dictation.recognition', locale)}</legend>
          <div className="dictation-modes" role="group" aria-label={t('dictation.recognition', locale)}>
            {['local', 'online'].map(value => {
              const Icon = value === 'local' ? Laptop : Cloud;
              return <Button key={value} type="button" variant="outline" className="dictation-mode"
                aria-pressed={mode === value} onClick={() => change({ recognitionMode: value })}>
                <Icon aria-hidden="true" />{t(`dictation.${value}`, locale)}
                {mode === value ? <Check aria-hidden="true" className="dictation-mode-check" /> : null}
              </Button>;
            })}
          </div>
          <p className="dictation-mode-detail">{t(`dictation.${mode}Detail`, locale)}</p>
          <div className="dictation-language">
            <Label htmlFor="dictation-language">{t('dictation.language', locale)}</Label>
            <Select value={preferences.language} onValueChange={value => change({ language: value })}>
              <SelectTrigger id="dictation-language" aria-label={t('dictation.language', locale)}>
                <SelectValue>{t(`dictation.${preferences.language}`, locale)}</SelectValue>
              </SelectTrigger>
              <SelectContent>{['auto', 'en', 'tr'].map(value =>
                <SelectItem key={value} value={value}>{t(`dictation.${value}`, locale)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </fieldset>
        <p className="dictation-save-feedback" role="status" aria-live="polite">
          {saveMessage ? t(saveMessage, locale) : dirty ? t('dictation.unsaved', locale) : null}
        </p>
      </form> : <section className="dictation-form" aria-labelledby="dictation-preferences-title">
        <div className="dictation-section-heading"><h2 id="dictation-preferences-title">{t('dictation.preferences', locale)}</h2></div>
        {/* Neutral words only: the owner's form speaks to the person who records ("my speech", "your allowance"). */}
        <dl>
          <div className="dictation-language"><dt className="text-[0.8rem]">{t('dictation.view.mode', locale)}</dt>
            <dd className="text-[0.8rem] font-medium">{t(mode === 'local' ? 'dictation.view.local' : 'dictation.online', locale)}</dd></div>
          <div className="dictation-language"><dt className="text-[0.8rem]">{t('dictation.view.language', locale)}</dt>
            <dd className="text-[0.8rem] font-medium">{t(`dictation.${preferences.language}`, locale)}</dd></div>
        </dl>
        <p className="dictation-save-feedback mb-5" role="status" aria-live="polite">{t(saveMessage || 'dictation.readOnly', locale)}</p>
      </section>}
      {canChange ? <p className="dictation-privacy"><ShieldCheck aria-hidden="true" /><span>{t(`dictation.${mode}Privacy`, locale)}</span></p> : null}
      <Accordion className="dictation-how">
        <AccordionItem value="help"><AccordionTrigger>{t('dictation.howTitle', locale)}</AccordionTrigger>
          <AccordionContent><p>{t('dictation.how', locale)}</p><p>{t('dictation.permissionsHelp', locale)}</p><p>{t('dictation.copyHelp', locale)}</p></AccordionContent>
        </AccordionItem>
        <AccordionItem value="privacy"><AccordionTrigger>{t('dictation.privacyTitle', locale)}</AccordionTrigger>
          <AccordionContent><p>{t(`dictation.${mode}Privacy`, locale)}</p><p>{t('dictation.clipboardHelp', locale)}</p></AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}
