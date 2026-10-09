'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';

export type NavigationGroup = {
  label: string;
  description: string;
  items: readonly { label: string; href: string; description: string }[];
};

/** The export's disclosure menus, including its keyboard route through links. */
export function StudyAbroadMegaMenu({ groups }: { groups: readonly NavigationGroup[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open === null) return;
    const closeOutside = (event: globalThis.MouseEvent) => {
      if (!navigation.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('click', closeOutside);
    return () => document.removeEventListener('click', closeOutside);
  }, [open]);

  function focusLink(index: number, last = false) {
    // Focus after React reveals the panel, so a hidden link never receives it.
    requestAnimationFrame(() => {
      const links = navigation.current?.querySelectorAll<HTMLAnchorElement>(`#sa-mega-panel-${index} a`);
      (last ? links?.[links.length - 1] : links?.[0])?.focus();
    });
  }

  function toggle(index: number, event: MouseEvent<HTMLButtonElement>) {
    if (open === index) setOpen(null);
    else {
      setOpen(index);
      if (event.detail === 0) focusLink(index);
    }
  }

  function move(index: number, event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setOpen(null);
      navigation.current?.querySelector<HTMLButtonElement>(`#sa-mega-button-${index}`)?.focus();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (open !== index) {
      setOpen(index);
      focusLink(index, event.key === 'ArrowUp');
      return;
    }
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('.mega__link'));
    const position = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === 'ArrowDown'
      ? (position + 1) % links.length
      : (position < 0 ? links.length - 1 : (position + links.length - 1) % links.length);
    links[next]?.focus();
  }

  return (
    <nav
      className="nav__links mega"
      aria-label="Primary"
      ref={navigation}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null);
      }}
    >
      {groups.map((group, index) => (
        <div className="mega__item" key={group.label} onKeyDown={(event) => move(index, event)}>
          <button
            className="mega__btn"
            type="button"
            id={`sa-mega-button-${index}`}
            aria-controls={`sa-mega-panel-${index}`}
            aria-expanded={open === index}
            onClick={(event) => toggle(index, event)}
          >
            {group.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div className="mega__panel" id={`sa-mega-panel-${index}`} hidden={open !== index}>
            <p className="mega__desc">{group.description}</p>
            <ul className="mega__grid">
              {group.items.map((item) => (
                <li key={`${item.href}:${item.label}`}>
                  <Link className="mega__link" href={item.href} onClick={() => setOpen(null)}>
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </nav>
  );
}
