'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLevelPage, listEditorialMedia, saveLevelPage } from './catalog-client';
import type { EditorialMedia, LevelPageDetail, LevelPageOwner } from './catalog.types';
import { catalogErrorText } from './catalog-errors';
import {
  FaqsCard,
  faqFromRecord,
  faqIssues,
  faqUsed,
  type FaqDraft,
} from './editorial/ContentBlocks';
import {
  LEVEL_PAGE_MAX_BYTES,
  LEVEL_PAGE_MAX_FAQS,
  levelPageBytes,
  levelPageFaqBlank,
  levelPageHasWords,
  levelPagePayload,
  levelPagesAnchor,
  levelPageTitle,
  ownerEditorHref,
  searchGap,
  type LevelPageContent,
} from './level-pages';
import { EditorSectionNav } from '@/features/shared/EditorSectionNav';
import { FlashBanner, queueFlash, type Flash } from '@/features/shared/Flash';
import { RichTextEditor } from '@/features/shared/RichTextEditor';
import { richTextOrEmpty } from '@/features/shared/rich-text-value';
import { UnifiedEditorActions } from '@/features/shared/UnifiedEditorActions';
import { EnterSubmitGuard } from '@/features/shared/EnterSubmitGuard';
import {
  blankUnifiedSeo,
  canonicalInputError,
  seoDraftFromRecord,
  unifiedSeoConfigured,
  UnifiedSeoFields,
  type UnifiedSeoDraft,
} from '@/features/shared/UnifiedSeoFields';
import { ViewOnSite } from '@/features/shared/records-ui';

type Intent = 'draft' | 'publish';

const blankContent: LevelPageContent = { intro: '', admissionNote: '', careersNote: '', industries: '', employers: '', lookingAhead: '' };

/** The editor's state for a page as the API returned it. A page not written
 * yet opens with one blank FAQ, as every FAQ card does. */
function draftFrom(detail: LevelPageDetail) {
  const page = detail.page;
  const faqs = (page?.faqs ?? []).map(faqFromRecord);
  return {
    content: {
      intro: page?.intro ?? '',
      admissionNote: page?.admissionNote ?? '',
      careersNote: page?.careersNote ?? '',
      industries: page?.industries ?? '',
      employers: page?.employers ?? '',
      lookingAhead: page?.lookingAhead ?? '',
    },
    faqs: faqs.length ? faqs : [levelPageFaqBlank()],
    seo: seoDraftFromRecord(page?.seo ?? null),
  };
}

/** An FAQ that will be shown: written in full and active. */
const shownFaq = (row: FaqDraft) => faqUsed(row) && row.status === 'ACTIVE' && Boolean(row.question.trim() && row.answer.trim());

/**
 * The page a subject or a specialization has at one study level, such as
 * /subjects/computing/masters, written on a page of its own like every full
 * record in the admin.
 *
 * The page lists its programmes, specializations and facts from the catalogue
 * whether or not anything is written here. What is written adds an overview,
 * an admission note, a careers note, the industries and employers it leads
 * to, a look ahead, FAQs and SEO of its own, and all of it is saved in one
 * request under one version: the FAQ list is replaced whole, and blank SEO
 * removes a stored record. Only the intro and the FAQs count towards search;
 * any written part is enough to publish.
 *
 * A page kept for a level that is no longer offered here is shown read-only:
 * it is off the site, and the card it came from can delete it.
 */
export function LevelPageForm({ owner, ownerId, levelId }: { owner: LevelPageOwner; ownerId: string; levelId: string }) {
  const router = useRouter();
  const [contentEl, setContentEl] = useState<HTMLFieldSetElement | null>(null);
  const [detail, setDetail] = useState<LevelPageDetail | null>(null);
  const [content, setContent] = useState<LevelPageContent>(blankContent);
  const [faqs, setFaqs] = useState<FaqDraft[]>(() => [levelPageFaqBlank()]);
  const [seo, setSeo] = useState<UnifiedSeoDraft>(blankUnifiedSeo);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState<Intent | null>(null);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Flash | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    let active = true;
    /* The media list only feeds the SEO image pickers; it failing leaves them
       empty, not the editor. */
    Promise.all([
      getLevelPage(owner, ownerId, levelId),
      listEditorialMedia({ limit: 50 }).catch(() => ({ data: [] as EditorialMedia[], meta: null })),
    ])
      .then(([detailResult, mediaResult]) => {
        if (!active) return;
        const next = draftFrom(detailResult.data);
        setDetail(detailResult.data);
        setContent(next.content);
        setFaqs(next.faqs);
        setSeo(next.seo);
        setMedia(mediaResult.data);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(catalogErrorText(cause, 'Unable to load level page'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [owner, ownerId, levelId]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const back = `${ownerEditorHref(owner, ownerId)}#${levelPagesAnchor(owner)}`;
  /* Client-side navigation skips the browser's leave-page warning, so the
     back link and Cancel ask before unsaved writing is dropped. */
  const confirmLeave = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (dirty && !window.confirm('Leave this level page without saving your changes?')) event.preventDefault();
  };

  if (loading) return <section className="mx-auto w-full max-w-[980px] rounded-2xl border border-[#E8ECF3] bg-white p-8"><p className="p-sub">Loading level page…</p></section>;
  if (!detail) {
    return (
      <section className="mx-auto w-full max-w-[1040px]">
        <Link href={ownerEditorHref(owner, ownerId)} className="p-link">← Back to the {owner}</Link>
        <p role="alert" className="mt-8 p-alert p-alert--error">{loadError || 'Unable to load level page'}</p>
      </section>
    );
  }

  const readOnly = !detail.offered;
  const fieldName = detail.specialization?.name ?? detail.subject.name;
  const ownerLive = detail.subject.status === 'PUBLISHED' && (!detail.specialization || detail.specialization.status === 'PUBLISHED');
  const status = detail.page?.status ?? 'NOT WRITTEN';
  const description = detail.level.description?.trim();

  /* Live, from what is on screen: the API decides on save, but the editor is
     told while writing what the page still lacks to be indexed on its own. */
  const gap = searchGap(Boolean(richTextOrEmpty(content.intro)), faqs.filter(shownFaq).length);
  const readiness = gap.length
    ? `For search engines to index this page on its own words, it still needs ${gap.join(' and ')}. Until then it is indexed once it lists 3 programmes.`
    : detail.page?.status === 'PUBLISHED' && !dirty
      ? 'Search-ready: its own words let search engines index it before it lists any programmes.'
      : 'Search-ready once published: its own words will let search engines index it before it lists any programmes.';

  /* An editor that reports the value it was given is not an edit. */
  const edit = (key: keyof LevelPageContent) => (value: string) => {
    if (content[key] === value) return;
    setContent((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setIssues([]);
  };
  const updateFaq = (index: number, patch: Partial<FaqDraft>) => { setFaqs((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row))); setDirty(true); setIssues([]); };
  /* The save replaces the whole list, so a removed FAQ is simply left out. */
  const removeFaq = (index: number) => { setFaqs((rows) => { const next = rows.filter((_, i) => i !== index); return next.length ? next : [levelPageFaqBlank()]; }); setDirty(true); };

  function validate(intent: Intent, payload: ReturnType<typeof levelPagePayload>) {
    const next: string[] = [...faqIssues(faqs, { blankOrder: true })];
    /* Robots alone is a record of its own: unticking "Robots index" with
       nothing written keeps the page out of search engines, and the title
       and description fall back as if there were no record. It used to be
       refused here until a title and a description were written too. */
    if (unifiedSeoConfigured(seo) && (!seo.seoTitle.trim() || !seo.metaDescription.trim())) next.push('SEO title and meta description are both required when SEO is configured.');
    if (canonicalInputError(seo.canonicalUrl)) next.push('Canonical URL: use a site path beginning with / or an absolute HTTP(S) URL.');
    if (intent === 'publish' && !levelPageHasWords(payload))
      next.push('Write an intro, a note or an FAQ before publishing this level page.');
    if (payload.faqs.length > LEVEL_PAGE_MAX_FAQS) next.push(`A level page holds at most ${LEVEL_PAGE_MAX_FAQS} FAQs; this one has ${payload.faqs.length}.`);
    if (levelPageBytes(payload) > LEVEL_PAGE_MAX_BYTES) next.push('This page is too long to save in one go. Shorten the intro, the notes or the longest answers.');
    setIssues(next);
    return next.length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !detail || readOnly) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent: Intent = submitter?.value === 'publish' ? 'publish' : 'draft';
    const payload = levelPagePayload({ content, faqs, seo, intent, page: detail.page });
    if (!validate(intent, payload)) return;
    const wasPublished = detail.page?.status === 'PUBLISHED';
    setSaving(true); setSavingIntent(intent); setError(''); setNotice(null);
    try {
      const saved = (await saveLevelPage(owner, ownerId, levelId, payload)).data;
      /* Everything is read back from what the API kept, the new version
         included, so the next save is checked against this one. */
      const next = draftFrom(saved);
      setDetail(saved);
      setContent(next.content);
      setFaqs(next.faqs);
      setSeo(next.seo);
      setDirty(false);
      /* Publish ends the editing session: back to the owner's Level pages
         card, with the green confirmation there. */
      if (intent === 'publish') {
        queueFlash({ tone: 'success', message: `${levelPageTitle(saved)} published successfully.` });
        router.push(back);
        return;
      }
      setNotice({ tone: 'neutral', message: wasPublished ? 'Moved to draft.' : 'Draft saved. It stays off the site until you publish it.' });
    } catch (cause: unknown) {
      setError(catalogErrorText(cause, 'Unable to save level page'));
    } finally { setSaving(false); setSavingIntent(null); }
  }

  return (
    <section className="mx-auto w-full max-w-[1040px]" aria-labelledby="level-page-form-heading">
      <Link href={back} className="p-link" onClick={confirmLeave}>← {fieldName}</Link>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="level-page-form-heading" className="p-h1">{levelPageTitle(detail)}</h2>
          <p className="p-sub">
            This page lists its programmes, specializations, destinations and facts from the catalogue on its own. What you write here adds an overview, admission, careers, industries, employers and looking-ahead sections, FAQs and SEO of its own. Everything on this page saves together.
            {ownerLive && detail.offered ? <> <ViewOnSite path={detail.path} /></> : null}
          </p>
          <p className="p-hint mt-2">{readiness}</p>
        </div>
        <span className="p-chip">{status}</span>
      </div>
      {readOnly ? (
        <p role="alert" className="p-alert">
          {detail.level.name} is not offered for {fieldName} now, so this page is not on the site. Tick the level and save to show it again, or delete this content from the Level pages card.
        </p>
      ) : null}
      <FlashBanner flash={notice} onDismiss={dismissNotice} />
      {error ? <p role="alert" className="p-alert p-alert--error">{error}</p> : null}
      {issues.length ? <div role="alert" className="p-alert p-alert--error"><p className="font-semibold">Fix these fields before saving:</p><ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}

      <EditorSectionNav root={contentEl} />
      <form onSubmit={submit} className="mt-8">
        {/* Enter in a text field would otherwise click Save draft / Move to
            draft and take a published page off the site. */}
        <EnterSubmitGuard />
        {/* One wrapper, so a page that is not offered is read-only as a whole. */}
        <fieldset ref={setContentEl} disabled={readOnly} className="min-w-0 space-y-6">
          <fieldset className="p-panel">
            <legend className="sr-only">Page content</legend>
            <p className="p-eyebrow">Words of its own</p>
            <h3 className="mt-2 text-xl font-semibold">Page content</h3>
            <p className="p-sub">Each part shows as its own section on the page, and is hidden while it is empty.</p>
            <div className="mt-6 space-y-5">
              <div>
                <RichTextEditor label="Intro" value={content.intro} onChange={edit('intro')} enableImages={false} readOnly={readOnly} minHeight="min-h-40" />
                <p className="p-hint mt-1">
                  The page&apos;s opening section, “Why study …?”, right under its heading and the level&apos;s standard line{description ? <>: “{description}” (from Admin &gt; Study levels)</> : null}.
                </p>
              </div>
              <div>
                <RichTextEditor label="Admission note" value={content.admissionNote} onChange={edit('admissionNote')} enableImages={false} readOnly={readOnly} minHeight="min-h-28" />
                <p className="p-hint mt-1">What admission at this level asks for in this field. Shows as “Getting into {levelPageTitle(detail)}”.</p>
              </div>
              <div>
                <RichTextEditor label="Careers note" value={content.careersNote} onChange={edit('careersNote')} enableImages={false} readOnly={readOnly} minHeight="min-h-28" />
                <p className="p-hint mt-1">Where this level in this field tends to lead. Shows as “Career pathways”.</p>
              </div>
              <div>
                <RichTextEditor label="Industries" value={content.industries} onChange={edit('industries')} enableImages={false} readOnly={readOnly} minHeight="min-h-28" />
                <p className="p-hint mt-1">The sectors these graduates go into. Shows as “Industries”, after Career pathways.</p>
              </div>
              <div>
                <RichTextEditor label="Employers" value={content.employers} onChange={edit('employers')} enableImages={false} readOnly={readOnly} minHeight="min-h-28" />
                <p className="p-hint mt-1">Organisations that hire these graduates. Shows as “Employers”, always followed by: “Named for illustration only; not a ranking, endorsement or partnership.”</p>
              </div>
              <div>
                <RichTextEditor label="Looking ahead" value={content.lookingAhead} onChange={edit('lookingAhead')} enableImages={false} readOnly={readOnly} minHeight="min-h-28" />
                <p className="p-hint mt-1">How the field and demand for it are changing. Shows as “Looking ahead”.</p>
              </div>
            </div>
          </fieldset>

          <FaqsCard idPrefix="level-page" rows={faqs} onChange={updateFaq} onAdd={() => { setFaqs((rows) => [...rows, levelPageFaqBlank()]); setDirty(true); }} onRemove={removeFaq} />

          <UnifiedSeoFields
            value={seo}
            onChange={(next) => { setSeo(next); setDirty(true); setIssues([]); }}
            media={media}
            note="Leave blank to use the Study level pages template under SEO management > Bulk SEO."
            noun="level page"
          />
        </fieldset>
        {readOnly ? null : <UnifiedEditorActions cancelHref={back} onCancel={confirmLeave} busy={saving} savingIntent={savingIntent} published={detail.page?.status === 'PUBLISHED'} />}
      </form>
    </section>
  );
}
