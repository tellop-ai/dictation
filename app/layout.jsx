import { buttonVariants } from '@/components/ui/button';

import { BACK_TO_OWNER, currentPerson } from '../lib/data/person.js';
import { getLocale, t } from '../lib/i18n/index.js';

import './globals.css';

export function generateMetadata() {
  const locale = getLocale();
  return { title: t('app.title', locale) };
}

/** Whether the owner is looking at the app as a Member or a Viewer (kit rule 1). A host that cannot say draws no link. */
async function inPreview() {
  try { return (await currentPerson()).preview === true; }
  catch { return false; }
}

export default async function RootLayout({ children }) {
  const locale = getLocale();
  const preview = await inPreview();
  return (
    <html lang={locale}>
      <body>
        {preview ? <div className="flex justify-end px-4 pt-3">
          <a href={BACK_TO_OWNER} className={buttonVariants({ variant: 'link', size: 'sm' })}>{t('preview.back', locale)}</a>
        </div> : null}
        {children}
      </body>
    </html>
  );
}
