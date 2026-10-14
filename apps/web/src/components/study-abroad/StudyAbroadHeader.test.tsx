// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION_GROUPS, PRIMARY, StudyAbroadHeader } from './StudyAbroadChrome';
import { StudyAbroadShell } from './StudyAbroadShell';
import { StudentSessionProvider } from '@/components/student/StudentSession';

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

async function pointer(element: HTMLElement, type: 'pointerenter' | 'pointerleave', pointerType = 'mouse') {
  await act(async () => {
    /* React derives enter and leave from over and out against the related
       target; jsdom has no PointerEvent, and the handler reads only pointerType. */
    const event = new MouseEvent(type === 'pointerenter' ? 'pointerover' : 'pointerout', {
      bubbles: true,
      relatedTarget: document.body,
    });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    element.dispatchEvent(event);
  });
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

  it('opens a menu when a mouse rests on it, and closes it when the mouse leaves', async () => {
    vi.useFakeTimers();
    try {
      await renderHeader();
      const items = host.querySelectorAll<HTMLElement>('.mega__item');
      const buttons = host.querySelectorAll<HTMLButtonElement>('.mega__btn');
      await pointer(items[3], 'pointerenter');
      expect(buttons[3].getAttribute('aria-expanded')).toBe('false');
      await act(async () => vi.advanceTimersByTime(150));
      expect(buttons[3].getAttribute('aria-expanded')).toBe('true');
      /* A click on the button a hover opened keeps it open. */
      await click(buttons[3]);
      expect(buttons[3].getAttribute('aria-expanded')).toBe('true');
      /* Leaving for the panel's gap and coming back within the grace keeps it open. */
      await pointer(items[3], 'pointerleave');
      await act(async () => vi.advanceTimersByTime(100));
      await pointer(items[3], 'pointerenter');
      await act(async () => vi.advanceTimersByTime(300));
      expect(buttons[3].getAttribute('aria-expanded')).toBe('true');
      /* Resting on a neighbour switches; leaving for good closes. */
      await pointer(items[3], 'pointerleave');
      await pointer(items[4], 'pointerenter');
      await act(async () => vi.advanceTimersByTime(150));
      expect(buttons[3].getAttribute('aria-expanded')).toBe('false');
      expect(buttons[4].getAttribute('aria-expanded')).toBe('true');
      await pointer(items[4], 'pointerleave');
      await act(async () => vi.advanceTimersByTime(300));
      expect(buttons[4].getAttribute('aria-expanded')).toBe('false');
      /* A finger resting does nothing: touch still taps. */
      await pointer(items[0], 'pointerenter', 'touch');
      await act(async () => vi.advanceTimersByTime(300));
      expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    } finally {
      vi.useRealTimers();
    }
  });

  it('names the dashboard for a signed-in student, and the login otherwise', async () => {
    const session = { authenticated: true, accessToken: 'test-token', user: { id: 's1', firstName: 'Asha', email: 'asha@example.test', emailVerified: true } };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new Response(JSON.stringify({ data: String(input).endsWith('/api/student/auth/session') ? session : { authenticated: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    try {
      await act(async () =>
        root.render(
          <StudentSessionProvider>
            <StudyAbroadHeader />
          </StudentSessionProvider>,
        ),
      );
      /* The session is probed on mount; until it answers the link is the login. */
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      const account = host.querySelector<HTMLAnchorElement>('.nav__account');
      expect(account?.getAttribute('href')).toBe('/student');
      expect(account?.textContent).toBe('My Dashboard');
    } finally {
      fetchSpy.mockRestore();
    }
    /* Outside any session, as the static markup is rendered, it is the login. */
    const html = renderToStaticMarkup(<StudyAbroadHeader />);
    expect(html).toContain('href="/student/login"');
    expect(html).toContain('Log in');
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
