'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { NavNode, SiteChrome } from '@/lib/site-chrome';

/** The one public Header/Footer for the whole site.
 *
 * Everything rendered here comes from Admin (Website Builder > Global Header /
 * Global Footer / Navigation Menus). There is no hardcoded fallback link list:
 * if a menu is empty the nav simply renders nothing, which makes a
 * misconfiguration visible instead of silently masking it with stale links. */

function isActive(pathname: string, href: string | null) {
  if (!href || !href.startsWith('/')) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function branchActive(pathname: string, node: NavNode) {
  return (
    isActive(pathname, node.href) ||
    (node.children ?? []).some((child) => isActive(pathname, child.href))
  );
}

function externalProps(node: { openInNewTab: boolean; href: string | null }) {
  return node.openInNewTab && node.href?.startsWith('http')
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};
}

function NavDropdown({ node, pathname }: { node: NavNode; pathname: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLLIElement>(null);
  // Which pointer, if any, was pressed on the trigger immediately before the
  // click now firing. A real mouse click always fires pointerenter (opening
  // the panel below) before its own click, so a click that follows a mouse
  // pointerdown is the second half of an interaction hover already resolved
  // -- toggling here would instantly re-close what hover just opened. Cleared
  // after every click so a stale value never survives to the next one; a
  // keyboard Enter/Space activation never sets it, and a touch tap sets it to
  // 'touch', so both fall through to the toggle below.
  const lastPointerType = useRef<string | null>(null);
  const menuId = useId();
  const active = branchActive(pathname, node);

  // Pointer-outside and Escape both close the panel; Escape also returns focus
  // to the trigger so keyboard users are never stranded inside a closed menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      wrapRef.current?.querySelector('button')?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <li
      ref={wrapRef}
      className="usta-nav-item usta-has-menu"
      onPointerEnter={(event) => {
        // Filtered to a real mouse: touch devices can fire a synthetic hover
        // after a tap ("ghost hover"), which would otherwise leave the panel
        // stuck open with no un-hover to close it.
        if (event.pointerType === 'mouse') setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setOpen(false);
      }}
    >
      <button
        type="button"
        className={`usta-nav-link usta-nav-trigger${active ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={menuId}
        aria-current={active ? 'true' : undefined}
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType;
        }}
        onClick={() => {
          const pointerType = lastPointerType.current;
          lastPointerType.current = null;
          if (pointerType === 'mouse') return;
          setOpen((value) => !value);
        }}
      >
        {node.label}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="usta-caret">
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul id={menuId} className={`usta-dropdown${open ? ' is-open' : ''}`}>
        {(node.children ?? []).map((child) => (
          <li key={child.id}>
            <Link
              href={child.href ?? '/'}
              className={
                isActive(pathname, child.href) ? 'is-active' : undefined
              }
              aria-current={isActive(pathname, child.href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
              {...externalProps(child)}
            >
              {child.label}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function GlobalHeader({ chrome }: { chrome: SiteChrome }) {
  const pathname = usePathname() ?? '/';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { header, general } = chrome.settings;
  const drawerId = useId();

  // Navigating closes the drawer, otherwise it stays open over the new page.
  // Adjusted during render rather than in an effect so there is no extra
  // commit with the drawer still open on the new route.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

  // A page/template override refines the global settings; it never replaces
  // this component. `undefined` on an override field means "no opinion", so
  // the global value stands.
  const override = chrome.chrome?.header;
  const announcementAllowed =
    override?.announcementVisible ?? header.announcementVisible;
  const announcement =
    announcementAllowed && header.announcementText?.trim()
      ? header.announcementText.trim()
      : null;
  const ctaUrl = override?.ctaUrl?.trim() || header.ctaUrl?.trim();
  const ctaLabel =
    override?.ctaLabel?.trim() || header.ctaLabel || 'Book free counselling';
  const ctaVisible =
    (override?.ctaVisible ?? header.ctaVisible !== false) && ctaUrl;
  // Stays hidden until an admin configures a destination -- no student-account
  // feature is implied or implemented by this link.
  const accountVisible =
    header.accountCtaUrl?.trim() && header.accountCtaLabel?.trim();

  const variantClass =
    override?.mode === 'ALTERNATE_VARIANT' && override.variant
      ? ` usta-header-${override.variant}`
      : '';

  return (
    <>
      {announcement ? (
        <div className="usta-announce">
          {header.announcementUrl?.trim() ? (
            <Link href={header.announcementUrl.trim()}>{announcement}</Link>
          ) : (
            <span>{announcement}</span>
          )}
        </div>
      ) : null}
      <header
        className={`usta-header${header.sticky === false ? '' : ' is-sticky'}${variantClass}`}
      >
        <div className="usta-header-inner">
          <Link href="/" className="usta-logo">
            {general.siteName ?? 'Universta'}
            <span aria-hidden="true">.</span>
          </Link>

          <nav className="usta-nav" aria-label="Primary navigation">
            <ul className="usta-nav-list">
              {chrome.headerMenu.map((node) =>
                node.children?.length ? (
                  <NavDropdown key={node.id} node={node} pathname={pathname} />
                ) : (
                  <li key={node.id} className="usta-nav-item">
                    <Link
                      href={node.href ?? '/'}
                      className={`usta-nav-link${isActive(pathname, node.href) ? ' is-active' : ''}`}
                      aria-current={
                        isActive(pathname, node.href) ? 'page' : undefined
                      }
                      {...externalProps(node)}
                    >
                      {node.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div className="usta-header-actions">
            {accountVisible ? (
              <Link href={header.accountCtaUrl!.trim()} className="usta-ghost">
                {header.accountCtaLabel}
              </Link>
            ) : null}
            {ctaVisible ? (
              <Link href={ctaUrl!} className="usta-cta">
                {ctaLabel}
              </Link>
            ) : null}
            <button
              type="button"
              className="usta-burger"
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setDrawerOpen((value) => !value)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d={drawerOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile drawer. Dropdown parents become plain labelled groups here so
            every destination is reachable without a second tap. */}
        <div
          id={drawerId}
          className={`usta-drawer${drawerOpen ? ' is-open' : ''}`}
          hidden={!drawerOpen}
        >
          <nav aria-label="Mobile navigation">
            {chrome.headerMenu.map((node) => (
              <div className="usta-drawer-group" key={node.id}>
                {node.href ? (
                  <Link
                    href={node.href}
                    className={`usta-drawer-head${isActive(pathname, node.href) ? ' is-active' : ''}`}
                    aria-current={
                      isActive(pathname, node.href) ? 'page' : undefined
                    }
                    {...externalProps(node)}
                  >
                    {node.label}
                  </Link>
                ) : (
                  <p className="usta-drawer-head">{node.label}</p>
                )}
                {node.children?.length ? (
                  <ul>
                    {node.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.href ?? '/'}
                          className={
                            isActive(pathname, child.href)
                              ? 'is-active'
                              : undefined
                          }
                          aria-current={
                            isActive(pathname, child.href) ? 'page' : undefined
                          }
                          {...externalProps(child)}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}

export function GlobalFooter({ chrome }: { chrome: SiteChrome }) {
  const { footer, contact, social, general } = chrome.settings;
  const override = chrome.chrome?.footer;
  const counsellingVisible =
    override?.counsellingCtaVisible ?? footer.counsellingCtaVisible !== false;
  const variantClass =
    override?.mode === 'ALTERNATE_VARIANT' && override.variant
      ? ` usta-footer-${override.variant}`
      : '';
  const socialLinks = Object.entries(social ?? {}).filter(
    ([, value]) => typeof value === 'string' && value.trim(),
  );
  const legal = [
    footer.privacyUrl?.trim() ? { label: 'Privacy', href: footer.privacyUrl.trim() } : null,
    footer.termsUrl?.trim() ? { label: 'Terms', href: footer.termsUrl.trim() } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <footer className={`usta-footer${variantClass}`}>
      <div className="usta-footer-inner">
        <div className="usta-footer-brand">
          <Link href="/" className="usta-logo">
            {general.siteName ?? 'Universta'}
            <span aria-hidden="true">.</span>
          </Link>
          {footer.description ? <p>{footer.description}</p> : null}
          {counsellingVisible && footer.counsellingCtaUrl?.trim() ? (
            <Link href={footer.counsellingCtaUrl.trim()} className="usta-cta">
              {footer.counsellingCtaLabel ?? 'Book free counselling'}
            </Link>
          ) : null}
        </div>

        <div className="usta-footer-cols">
          {chrome.footerMenu.map((column) => (
            <nav key={column.id} aria-label={column.label}>
              <h2>{column.label}</h2>
              <ul>
                {(column.children ?? []).map((item) => (
                  <li key={item.id}>
                    <Link href={item.href ?? '/'} {...externalProps(item)}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {footer.showContact !== false &&
          (contact.email || contact.counsellingPhone || contact.address) ? (
            <div className="usta-footer-contact">
              <h2>Contact</h2>
              <ul>
                {contact.address ? <li>{contact.address}</li> : null}
                {contact.email ? (
                  <li>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </li>
                ) : null}
                {contact.counsellingPhone ? (
                  <li>
                    <a href={`tel:${contact.counsellingPhone.replace(/\s+/g, '')}`}>
                      {contact.counsellingPhone}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="usta-footer-bottom">
        <p>{footer.copyrightText ?? ''}</p>
        <div className="usta-footer-meta">
          {legal.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          {footer.showSocial !== false &&
            socialLinks.map(([name, url]) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="usta-social"
              >
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </a>
            ))}
        </div>
      </div>
    </footer>
  );
}
