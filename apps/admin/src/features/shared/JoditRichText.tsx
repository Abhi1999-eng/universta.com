'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JoditEditor from 'jodit-react';
import { Jodit } from 'jodit';
import type { IJodit } from 'jodit/esm/types/jodit';
import { MediaPickerDialog } from '@/features/catalog/editorial/MediaPickerDialog';
import { sanitizeEditorHtml, type RichTextEditorProps } from './RichTextEditor';
import { suggestionHtml, type Suggestion } from './entity-autocomplete';
import {
  triggerAtCaret,
  useEntityAutocomplete,
} from './useEntityAutocomplete';

/**
 * The Admin WYSIWYG, wrapping Jodit's own editor and toolbar.
 *
 * Two hand-rolled editors preceded this one -- `document.execCommand`, then a
 * Tiptap toolbar we wired command by command -- and both spent their bugs in
 * the same place: selection handling. Applying a list to a selected paragraph
 * is exactly the sort of thing an editor library has already solved, so this
 * configures Jodit's ready-made toolbar rather than reimplementing it.
 *
 * Browser-only, so it is loaded through `RichTextEditor` with SSR disabled.
 */

export function JoditRichText({
  label,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  allowedVariables = [],
  enableImages = true,
  media = [],
  minHeight = 'min-h-36',
  ariaLabel,
  placeholder,
  hideLabel = false,
  entityContext,
}: RichTextEditorProps) {
  const isDisabled = disabled || readOnly;
  const editorRef = useRef<IJodit | null>(null);
  /* Whether Jodit has produced its editable element. Jodit is loaded on
   * demand, so it can finish initialising either side of the record being
   * edited; gating on this means the read-only state is applied once both are
   * there, in whichever order they arrive. A value read at first render went
   * stale in the "record first, editor second" order and left the field
   * permanently read-only, empty and impossible to type into. */
  const [ready, setReady] = useState(false);
  /* Read inside a Jodit command callback, which is created once and would
   * otherwise capture the first render's handler. */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /* Both of these have to keep a stable identity. jodit-react rebuilds the
   * editor whenever `config` or `editorRef` changes, and it subscribes to the
   * editor's `change` event only once -- so an inline callback here quietly
   * destroyed and recreated Jodit on every render, leaving that subscription
   * bound to a dead instance. Formatting applied in the editor and then never
   * reached the form. */
  /* Read inside the capture callback, which is created once for the same
   * reason as the handlers above. */
  const nameRef = useRef(ariaLabel ?? label);
  useEffect(() => {
    nameRef.current = ariaLabel ?? label;
    /* A field that is renamed while mounted -- a numbered paragraph or row
     * shifting position -- renames its editable with it. */
    const area = editorRef.current?.editor;
    if (area) area.setAttribute('aria-label', nameRef.current);
  }, [ariaLabel, label]);
  const captureEditor = useCallback((editor: IJodit) => {
    editorRef.current = editor;
    /* Jodit's editable area is a bare contenteditable div: no role, no name.
     * The field's name used to sit on the wrapper around it instead, which
     * reads to a screen reader as a labelled group containing one anonymous
     * control -- and left the actual control impossible to address by its
     * label, in assistive tech and in the browser tests alike. The name
     * belongs on the thing being typed into. */
    const area = editor.editor;
    if (!area) return;
    area.setAttribute('role', 'textbox');
    area.setAttribute('aria-multiline', 'true');
    area.setAttribute('aria-label', nameRef.current);
    /* Jodit's single insertion point for pasted and dropped content. Reducing
     * the markup to the stored subset here means what the author sees after a
     * paste is what will be saved -- and, unlike Jodit's own tag filter, an
     * unknown wrapper loses its tags rather than its text. */
    editor.e.on('beforePasteInsert', (html: unknown) =>
      typeof html === 'string' ? sanitizeEditorHtml(html) : html,
    );
    setReady(true);
  }, []);
  const handleChange = useCallback((next: string) => {
    onChangeRef.current(next);
  }, []);
  /* Trim the value to the stored subset when the operator leaves the field.
   * Doing it per keystroke would rewrite what the editor just emitted, and the
   * wrapper would then reset the document and move the caret. On blur there is
   * no caret to lose, and anything pasted in -- Word wrappers, a stray heading
   * level, a script tag -- is normalised before it can be saved. The API
   * sanitises every write path as well; this is tidiness, not the boundary. */
  const handleBlur = useCallback((next: string) => {
    onChangeRef.current(sanitizeEditorHtml(next));
  }, []);

  /** Applies or removes a list through Jodit's own style engine. See the
   * comment on `controls.ul` for why its default control cannot toggle off. */
  useEffect(() => {
    if (!ready) return;
    editorRef.current?.setReadOnly(isDisabled);
  }, [ready, isDisabled]);

  const listExec = useCallback(
    (element: 'ul' | 'ol') =>
      (jodit: IJodit, _: unknown, { control }: { control: { args?: unknown[] } }) => {
        const chosen = control.args?.[0];
        jodit.s.commitStyle(
          typeof chosen === 'string' && chosen !== 'default'
            ? { element, attributes: { style: { listStyleType: chosen } } }
            : { element },
        );
        /* Report once the unwrap has settled in the DOM, and report it
         * ourselves: Jodit records the post-toggle value internally before its
         * own `change` event would carry it, so the form heard about turning a
         * list on but never about turning it off. Jodit's async manager is used
         * so the callback is dropped if the editor is destroyed first. */
        jodit.async.setTimeout(() => {
          jodit.setEditorValue();
          onChangeRef.current(jodit.value);
        }, 0);
      },
    [],
  );

  /* `config` must keep a stable identity for the life of the field.
   *
   * jodit-react destroys and rebuilds the editor whenever this object changes,
   * and it subscribes to the editor's `change` event only once -- so a rebuild
   * leaves that subscription attached to a dead instance and every later edit
   * is silently dropped. `readonly` used to be read from here, and the Phase 1
   * editor turns its fields read-only while a record loads and back again once
   * it arrives: that single flip rebuilt the editor on every edit form, and an
   * author's rewritten description was quietly discarded on save. Read-only is
   * applied to the live instance instead, below. */
  const config = useMemo(
    () => ({
      /* Always built editable, then put into the right state against the live
       * instance below. Building it read-only and lifting that later leaves
       * the editable element without its `contenteditable` attribute, because
       * Jodit's own `setReadOnly` short-circuits when it thinks the state is
       * already what you asked for. One code path owns this instead. */
      readonly: false,
      placeholder: placeholder ?? '',
      /* Jodit's own toolbar. The paragraph dropdown is replaced rather than
       * extended -- `Jodit.atom` is what stops it merging with the default
       * list, which offers H1 and `pre`, neither of which survives the stored
       * tag set. Offering a format that is silently dropped on save is worse
       * than not offering it. */
      buttons: [
        'paragraph',
        '|',
        'bold',
        'italic',
        'underline',
        'strikethrough',
        '|',
        'ul',
        'ol',
        '|',
        'left',
        'center',
        'right',
        '|',
        'link',
        '|',
        'undo',
        'redo',
        '|',
        'eraser',
      ],
      controls: {
        /* Jodit's own list buttons always pass `listStyleType`, even when no
         * style was picked from their dropdown. Its style engine reads that as
         * "apply with different attributes" rather than "same style again", so
         * clicking Bullet List inside a list re-applied it instead of
         * unwrapping -- the list could be turned on but never off. Committing
         * without the attribute toggles correctly; an explicitly chosen style
         * still carries one. The engine, the dropdown and the button are all
         * still Jodit's. */
        ul: { exec: listExec('ul') },
        ol: { exec: listExec('ol') },
        paragraph: {
          list: Jodit.atom({
            p: 'Normal',
            h2: 'Heading 2',
            h3: 'Heading 3',
            h4: 'Heading 4',
            blockquote: 'Quote',
          }),
        },
      },
      /* Paste keeps its formatting -- that is the point of the field -- but
       * Word and Docs wrappers are cleaned, and nothing outside the stored tag
       * set survives. This is convenience, not security: the API sanitises
       * every rich-text write path regardless of what arrives. */
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,
      defaultActionOnPaste: 'insert_as_html' as const,
      processPasteHTML: true,
      cleanHTML: {
        /* `allowTags` is deliberately not set here.
         *
         * Jodit enforces it by DELETING any element outside the list, together
         * with everything inside it -- it does not unwrap. Every real paste
         * arrives wrapped in markup outside the stored subset (`div`, `span`,
         * `font`, a `meta` charset), so 300ms after pasting, Jodit's cleanup
         * pass removed the wrapper and took the author's text with it: the
         * content appeared, then vanished. Pasting markup that happened to be
         * inside the subset survived, which is why it looked intermittent.
         *
         * The subset is enforced on the way in instead, by the
         * `beforePasteInsert` handler, which drops unknown tags but keeps
         * their text. Jodit's own
         * defaults still remove scripts, iframes, objects, embeds and event
         * attributes, and the API sanitises every write path regardless. */
        cleanOnPaste: true,
        removeEmptyElements: false,
        fillEmptyParagraph: false,
      },
      /* Universta already has a Media Library. Jodit must not become a second
       * upload path, so base64 embedding and its own uploader are both off. */
      uploader: { insertImageAsBase64URI: false, url: '' },
      disablePlugins: ['image-processor', 'image-properties', 'file', 'video', 'media'],
      enableDragAndDropFileToEditor: false,
      showCharsCounter: false,
      showWordsCounter: false,
      showXPathInStatusbar: false,
      statusbar: false,
      toolbarAdaptive: false,
      minHeight: 180,
    }),
    [placeholder, listExec],
  );

  /* Jodit is loaded on demand, so it can finish initialising either side of
   * the record it is being edited with. Both orders have to end in the right
   * state: the effect covers "editor first, record second", and the capture
   * below reads this ref for "record first, editor second" -- which is where a
   * value fixed at first render went stale and left the field permanently
   * read-only, empty, and impossible to type into. */

  const insertHtml = useCallback((html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.selection.focus();
    editor.selection.insertHTML(html);
  }, []);

  const insertMedia = useCallback(
    (mediaId: string) => {
      const item = media.find((row) => row.id === mediaId);
      if (!item || !/^(https?:\/\/|\/)/i.test(item.url)) return;
      const alt = (item.alt || item.title || '').replace(/"/g, '&quot;');
      insertHtml(`<img src="${item.url}" alt="${alt}">`);
    },
    [insertHtml, media],
  );

  /* The inline `%` autocomplete replaces the "Insert variable [Choose…]"
   * dropdown that used to sit above every field. An author types where they
   * are already typing; nothing about picking a record belongs in a control
   * beside the editor. */
  const autocomplete = useEntityAutocomplete({
    variables: allowedVariables,
    context: entityContext,
    enabled: ready && !isDisabled,
  });
  const { close: closeMenu, open: menuOpen, setQuery: setMenuQuery } = autocomplete;
  /* The range the chosen suggestion replaces, captured with the query so the
   * insertion never has to re-derive it from a caret that may have moved. */
  const triggerRange = useRef<Range | null>(null);
  /* The token the author dismissed with Escape.
   *
   * Closing the menu is not enough on its own: the keyup that follows re-reads
   * the caret, finds the same `%token` still sitting there, and reopens it --
   * so Escape appeared to do nothing. The token stays dismissed until it
   * changes or the caret leaves it, which is also what makes Escape mean
   * "leave this one alone" rather than "close for one frame". */
  const dismissed = useRef<string | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const syncTrigger = useCallback(() => {
    const area = editorRef.current?.editor ?? null;
    const found = triggerAtCaret(area);
    if (!found) {
      triggerRange.current = null;
      dismissed.current = null;
      closeMenu();
      setAnchor(null);
      return;
    }
    if (dismissed.current === found.query) {
      triggerRange.current = null;
      return;
    }
    dismissed.current = null;
    triggerRange.current = found.range;
    setMenuQuery(found.query);
    /* Positioned against the editable's own box, so the menu travels with a
     * scrolled form instead of being pinned to the viewport.
     *
     * Only written when it actually moves. This runs on every keyup, and a
     * fresh object each time is a state change each time -- a stream of
     * renders, for a menu that is sitting still, competing with the arrow keys
     * that are trying to move the highlight inside it. */
    const host = area?.getBoundingClientRect();
    const next = host
      ? { top: found.rect.bottom - host.top + 4, left: found.rect.left - host.left }
      : null;
    setAnchor((current) =>
      current?.top === next?.top && current?.left === next?.left ? current : next,
    );
  }, [closeMenu, setMenuQuery]);

  const applySuggestion = useCallback(
    (suggestion: Suggestion) => {
      const editor = editorRef.current;
      const range = triggerRange.current;
      if (!editor || !range) return;
      /* Delete the `%token` first, then let Jodit insert at the collapsed
       * caret: its own insertion keeps undo history and the caret position
       * correct, which hand-built DOM surgery does not. */
      range.deleteContents();
      const selection = editor.editor?.ownerDocument.getSelection();
      if (selection) {
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      editor.selection.insertHTML(suggestionHtml(suggestion));
      triggerRange.current = null;
      dismissed.current = null;
      closeMenu();
      setAnchor(null);
      onChangeRef.current(editor.value);
    },
    [closeMenu],
  );

  /* Caret tracking. Bound once for the life of the field: these listeners only
   * ever re-read the caret, so nothing here goes stale. */
  useEffect(() => {
    const area = editorRef.current?.editor;
    if (!ready || !area) return;
    const onCaretMove = () => window.setTimeout(syncTrigger, 0);
    const onBlur = () => {
      /* Left open, a menu would hang over the next field. The mousedown that
       * picks a suggestion runs before this, so a click still lands. */
      window.setTimeout(() => {
        triggerRange.current = null;
        closeMenu();
        setAnchor(null);
      }, 120);
    };
    area.addEventListener('keyup', onCaretMove);
    area.addEventListener('mouseup', onCaretMove);
    area.addEventListener('blur', onBlur);
    return () => {
      area.removeEventListener('keyup', onCaretMove);
      area.removeEventListener('mouseup', onCaretMove);
      area.removeEventListener('blur', onBlur);
    };
  }, [closeMenu, ready, syncTrigger]);

  /* The menu's own keys, intercepted on Jodit's editable during the capture
   * phase -- otherwise Enter breaks the paragraph and the arrows move the caret
   * before the menu ever sees them.
   *
   * Rebound whenever the menu changes rather than reading through a ref: the
   * handler needs the current highlight and the current list, and re-attaching
   * one listener is cheaper than the bugs a stale closure causes here. It is
   * attached only while the menu is open, so ordinary typing is untouched. */
  const { active, setActive, suggestions } = autocomplete;
  useEffect(() => {
    const area = editorRef.current?.editor;
    if (!ready || !area || !menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key))
        return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        dismissed.current = autocomplete.query;
        triggerRange.current = null;
        closeMenu();
        setAnchor(null);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((current) => (current + step + suggestions.length) % suggestions.length);
        return;
      }
      const chosen = suggestions[active];
      if (chosen) applySuggestion(chosen);
    };
    area.addEventListener('keydown', onKeyDown, true);
    return () => area.removeEventListener('keydown', onKeyDown, true);
  }, [active, applySuggestion, autocomplete.query, closeMenu, menuOpen, ready, setActive, suggestions]);

  return (
    <div className={`text-sm font-semibold ${minHeight ? '' : ''}`}>
      {hideLabel ? null : <span className="mb-2 block">{label}</span>}
      {enableImages && media.length ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <MediaPickerDialog
            label="Insert image"
            value=""
            media={media}
            onChange={insertMedia}
          />
        </div>
      ) : null}
      {/* The name is set on Jodit's editable element itself, in
        * `captureEditor` -- not here, or the field would answer to its label
        * twice. */}
      <div data-rte={label} className="relative">
        <JoditEditor
          value={value ?? ''}
          config={config}
          onChange={handleChange}
          onBlur={handleBlur}
          editorRef={captureEditor}
        />
        {menuOpen && anchor ? (
          <ul
            role="listbox"
            aria-label={`Insert a record into ${label}`}
            className="absolute z-50 max-h-64 w-80 overflow-auto rounded-xl border border-[#D9E0EA] bg-white py-1 shadow-lg"
            style={{ top: anchor.top, left: anchor.left }}
          >
            {autocomplete.suggestions.map((suggestion, index) => (
              <li key={suggestion.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === autocomplete.active}
                  /* mousedown, not click: the editable blurs on mousedown
                   * and the blur handler closes the menu, so a click handler
                   * would never fire. */
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applySuggestion(suggestion);
                  }}
                  /* mousemove, not mouseenter. The menu opens under wherever
                   * the pointer already was, and `mouseenter` fires when an
                   * element appears beneath a cursor that never moved -- so the
                   * highlight jumped off the first result the moment the list
                   * rendered, and the arrow keys then counted from somewhere
                   * the author never chose. A hand resting on the mouse is not
                   * a choice; moving it is, and only that moves the highlight. */
                  onMouseMove={() => autocomplete.setActive(index)}
                  className={`block w-full px-3 py-2 text-left text-sm font-normal ${
                    index === autocomplete.active ? 'bg-[#EEF3FF]' : 'bg-white'
                  }`}
                >
                  <span className="block font-semibold text-[#101828]">
                    {suggestion.label}
                  </span>
                  {suggestion.detail ? (
                    <span className="block p-hint">
                      {suggestion.detail}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
