'use client';

import { useEffect, useRef, useState } from 'react';

type Section = { id: string; label: string };

const slug = (value: string) =>
  value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The label a section goes by: its visible heading, else its legend or summary. */
function labelOf(section: HTMLElement): string | null {
  const heading = section.querySelector<HTMLElement>('h2, h3, h4');
  const text =
    heading?.innerText ||
    section.querySelector<HTMLElement>(':scope > summary')?.innerText ||
    section.querySelector<HTMLElement>(':scope > legend')?.textContent ||
    '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean || null;
}

/**
 * A bar of the sections in a long editor, kept in view while the page
 * scrolls, so an editor can jump to "SEO" or "FAQs" instead of scrolling
 * through everything above it. The sections are the editor's own top-level
 * fieldsets, <section>s and folded <details>, read off the page, so a form needs no
 * changes to take part; the one in view is marked.
 */
export function EditorSectionNav({ root, label = 'Sections on this page' }: { root: HTMLElement | null; label?: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState<string | null>(null);
  /* While a jump is scrolling, the section jumped to stays marked. */
  const jumpedAt = useRef(0);

  /* `root` is the editor's form, handed over through a callback ref, so the
     bar picks it up whenever it appears -- editors show "Loading…" first. */
  useEffect(() => {
    if (!root) return undefined;
    const collect = () => {
      const found: Section[] = [];
      const seen = new Set<string>();
      const BLOCK = 'fieldset, details, section';
      /* Top level within the scope only: the page around the form is itself
         a <section>, so ancestors are checked up to the scope and no further. */
      const topLevel = (scope: HTMLElement) =>
        [...scope.querySelectorAll<HTMLElement>(BLOCK)].filter((element) => {
          for (let parent = element.parentElement; parent && parent !== scope; parent = parent.parentElement) {
            if (parent.matches(BLOCK)) return false;
          }
          return true;
        });
      /* A form that wraps everything in one unnamed fieldset (to disable it
         while loading) has its sections one level further in. */
      let scope: HTMLElement = root;
      let blocks = topLevel(scope);
      for (let depth = 0; depth < 3 && blocks.length === 1 && !labelOf(blocks[0]); depth++) {
        scope = blocks[0];
        blocks = topLevel(scope);
      }
      for (const block of blocks) {
        const text = labelOf(block);
        if (!text) continue;
        let id = block.id;
        if (!id) {
          let candidate = `section-${slug(text)}`;
          let n = 2;
          while (seen.has(candidate) || document.getElementById(candidate)) candidate = `section-${slug(text)}-${n++}`;
          id = candidate;
          block.id = id;
        }
        block.style.scrollMarginTop = 'calc(var(--top, 64px) + 64px)';
        seen.add(id);
        found.push({ id, label: text });
      }
      setSections((current) =>
        current.length === found.length && current.every((s, i) => s.id === found[i].id && s.label === found[i].label) ? current : found,
      );
    };
    /* A timer, not an animation frame: frames do not arrive while the page
       is in a hidden tab or pane, and the bar would never be built. */
    let timer = window.setTimeout(collect, 0);
    if (typeof MutationObserver === 'undefined') return () => window.clearTimeout(timer);
    /* Editors load parts of themselves after the record arrives -- a block
       can appear, or gain its heading, well after the first read -- so the
       form is watched throughout, and re-read once it settles. */
    const watcher = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(collect, 200);
    });
    watcher.observe(root, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      watcher.disconnect();
    };
  }, [root]);

  useEffect(() => {
    if (sections.length < 3) return undefined;
    /* The active section is the last one whose top has passed just under the
       bar: what the reader is in, not merely what is on screen. */
    let frame = 0;
    const update = () => {
      if (Date.now() - jumpedAt.current < 900) return;
      const line = 64 + 72;
      let current: string | null = sections[0]?.id ?? null;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= line) current = section.id;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = sections[sections.length - 1]?.id ?? current;
      setActive(current);
    };
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    const first = window.setTimeout(update, 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(first);
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [sections]);

  if (sections.length < 3) return null;
  return (
    <nav aria-label={label} className="editor-sections">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={`editor-sections__link${active === section.id ? ' is-active' : ''}`}
          aria-current={active === section.id ? 'location' : undefined}
          onClick={(event) => {
            event.preventDefault();
            const element = document.getElementById(section.id);
            if (element instanceof HTMLDetailsElement) element.open = true;
            jumpedAt.current = Date.now();
            element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActive(section.id);
          }}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
