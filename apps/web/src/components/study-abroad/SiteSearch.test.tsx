// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteSearch } from './SiteSearch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items = Array.from({ length: 12 }, (_, index) => ({
  id: `computer-${index}`,
  label: `Computer course ${index + 1}`,
  href: `/courses/computer-course-${index + 1}`,
  meta: null,
}));
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    data: { groups: [
      { type: 'subject', label: 'Subjects', href: '/subjects?q=computer', items: items.slice(0, 2) },
      { type: 'course', label: 'Courses', href: '/courses?q=computer', items: items.slice(2) },
    ] },
  }))));
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function search() {
  await act(async () => root.render(<SiteSearch />));
  const input = host.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(input, 'computer');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { vi.advanceTimersByTime(200); });
  return input;
}

async function key(input: HTMLInputElement, value: string) {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  });
}

describe('site search suggestions', () => {
  it('scrolls the panel to keyboard-selected rows without moving focus or the page', async () => {
    const input = await search();
    const panel = host.querySelector<HTMLDivElement>('[role="listbox"]')!;
    const options = Array.from(panel.querySelectorAll<HTMLAnchorElement>('[role="option"]'));
    expect(options).toHaveLength(12);
    Object.defineProperty(panel, 'clientHeight', { value: 200 });
    panel.getBoundingClientRect = () => new DOMRect(0, 100, 400, 200);
    options.forEach((option, index) => {
      option.getBoundingClientRect = () => new DOMRect(0, 100 + index * 40 - panel.scrollTop, 400, 40);
    });
    input.focus();
    const pageScroll = window.scrollY;

    await key(input, 'ArrowUp');
    expect(panel.scrollTop).toBe(280);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[11].id);
    expect(options[11].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(input);
    expect(window.scrollY).toBe(pageScroll);

    await key(input, 'ArrowDown');
    expect(panel.scrollTop).toBe(0);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
    expect(document.activeElement).toBe(input);
  });

  it('keeps Enter following the selected link and Escape restoring plain search submission', async () => {
    const input = await search();
    const option = host.querySelector<HTMLAnchorElement>('[role="option"]')!;
    const followed: string[] = [];
    option.addEventListener('click', (event) => {
      event.preventDefault();
      followed.push(option.getAttribute('href')!);
    });
    await key(input, 'ArrowDown');
    await key(input, 'Enter');
    expect(followed).toEqual([items[0].href]);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);

    await act(async () => input.focus());
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await key(input, 'Escape');
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(host.querySelector('form')?.getAttribute('action')).toBe('/search');
    expect(host.querySelector('form')?.getAttribute('method')).toBe('get');
    expect(input.name).toBe('q');
  });
});
