// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NAVIGATION_GROUPS, PRIMARY, StudyAbroadHeader } from './StudyAbroadChrome';
import { StudyAbroadShell } from './StudyAbroadShell';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function renderHeader() {
  await act(async () => root.render(<StudyAbroadHeader />));
}

async function click(element: HTMLElement) {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
}

async function key(element: HTMLElement, value: string) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

describe('the final ZIP navigation', () => {
  it('keeps every previous primary destination available in the grouped navigation', () => {
    const links = NAVIGATION_GROUPS.flatMap((group) => group.items);
    for (const previous of PRIMARY) {
      expect(links.some((link) => link.href === previous.href && link.label === previous.label)).toBe(true);
    }
    expect(NAVIGATION_GROUPS.map((group) => group.label)).toEqual([
      'Study Abroad', 'Tools', 'Resources', 'For Institutions', 'About',
    ]);
  });

  it('provides separate catalogue search, country selector, account and assessment controls', () => {
    const html = renderToStaticMarkup(<StudyAbroadHeader />);
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('a[aria-label="Search Universta"]')?.getAttribute('href')).toBe('/search');
    expect(document.querySelector('button[data-open-selector]')?.getAttribute('aria-label')).toBe('Explore countries');
    expect(document.querySelector('.nav__account')?.getAttribute('href')).toBe('/student/login');
    expect(document.querySelector('button[data-open-assessment]')?.textContent).toContain('Start My Journey');
    expect(document.querySelector('a[data-open-selector]')).toBeNull();
    expect(html).not.toContain('/eligibility-checker');
    expect(html).not.toContain('/for-universities');
  });

  it('opens one menu at a time and closes when the user clicks outside', async () => {
    await renderHeader();
    const buttons = host.querySelectorAll<HTMLButtonElement>('.mega__btn');
    await click(buttons[0]);
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector<HTMLElement>('#sa-mega-panel-0')?.hidden).toBe(false);
    await click(buttons[1]);
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
    await click(document.body);
    expect(buttons[1].getAttribute('aria-expanded')).toBe('false');
  });

  it('opens with the keyboard, cycles links and restores focus with Escape', async () => {
    await renderHeader();
    const button = host.querySelector<HTMLButtonElement>('#sa-mega-button-0')!;
    button.focus();
    await key(button, 'ArrowDown');
    const links = host.querySelectorAll<HTMLAnchorElement>('#sa-mega-panel-0 a');
    expect(document.activeElement).toBe(links[0]);
    await key(links[0], 'ArrowUp');
    expect(document.activeElement).toBe(links[links.length - 1]);
    await key(links[links.length - 1], 'ArrowDown');
    expect(document.activeElement).toBe(links[0]);
    await key(links[0], 'Escape');
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes a disclosure after focus leaves the navigation', async () => {
    await renderHeader();
    const button = host.querySelector<HTMLButtonElement>('#sa-mega-button-0')!;
    await act(async () => button.focus());
    await click(button);
    await act(async () => host.querySelector<HTMLAnchorElement>('.nav__search')?.focus());
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('the grouped mobile drawer and existing dialogs', () => {
  async function renderShell() {
    await act(async () => root.render(
      <div className="sa"><StudyAbroadShell destinations={null}><main id="main">Page</main></StudyAbroadShell></div>,
    ));
  }

  it('keeps the original destinations in mobile groups and closes on Escape', async () => {
    await renderShell();
    const burger = host.querySelector<HTMLButtonElement>('[data-toggle-drawer]')!;
    await act(async () => burger.focus());
    await click(burger);
    const drawer = host.querySelector<HTMLElement>('#sa-drawer')!;
    expect(drawer.getAttribute('data-open')).toBe('true');
    expect(drawer.querySelectorAll('details')).toHaveLength(5);
    for (const previous of PRIMARY) {
      expect(Array.from(drawer.querySelectorAll('a')).some(
        (link) => link.getAttribute('href') === previous.href && link.textContent === previous.label,
      )).toBe(true);
    }
    expect(document.activeElement).toBe(drawer.querySelector('.drawer__search'));
    await key(drawer, 'Escape');
    expect(drawer.getAttribute('data-open')).toBe('false');
    expect(burger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(burger);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('opens the country selector from the globe and preserves the assessment control', async () => {
    await renderShell();
    const globe = host.querySelector<HTMLButtonElement>('[data-open-selector]')!;
    await act(async () => globe.focus());
    await click(globe);
    const selector = host.querySelector<HTMLElement>('[data-selector]')!;
    expect(selector.getAttribute('data-open')).toBe('true');
    expect(globe.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(selector.querySelector('input'));
    await click(selector.querySelector<HTMLButtonElement>('.cs__close')!);
    expect(selector.getAttribute('data-open')).toBe('false');
    expect(document.activeElement).toBe(globe);
    await click(host.querySelector<HTMLButtonElement>('.nav__cta')!);
    expect(host.querySelector('[role="dialog"][aria-labelledby="assessment-title"]')).not.toBeNull();
  });
});
