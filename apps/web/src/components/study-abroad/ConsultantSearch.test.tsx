// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const address = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/study-abroad-consultants',
  useSearchParams: () => new URLSearchParams(address.search),
}));

import { ConsultantSearch } from './ConsultantSearch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const destinations = [
  { slug: 'germany', name: 'Germany' },
  { slug: 'japan', name: 'Japan' },
];
let host: HTMLDivElement;
let root: Root;
let pushed: string[];

beforeEach(() => {
  address.search = '';
  pushed = [];
  vi.spyOn(window.history, 'pushState').mockImplementation((_data, _unused, url) => {
    pushed.push(String(url));
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

async function mount() {
  await act(async () => root.render(<ConsultantSearch destinations={destinations} placeholder="Consultant, country, city or service" />));
  return {
    select: host.querySelector<HTMLSelectElement>('select[name="country"]')!,
    input: host.querySelector<HTMLInputElement>('input[name="q"]')!,
    form: host.querySelector<HTMLFormElement>('form')!,
  };
}

const setValue = async (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};
const submit = (form: HTMLFormElement) => act(async () => form.requestSubmit());

describe('the directory hero\'s search', () => {
  it('offers "Any destination" and each published destination, and works as a plain form without script', async () => {
    const { select, form, input } = await mount();
    expect([...select.options].map((option) => `${option.value}:${option.text}`)).toEqual([
      ':Any destination',
      'germany:Germany',
      'japan:Japan',
    ]);
    expect(form.getAttribute('action')).toBe('/study-abroad-consultants');
    expect(input.placeholder).toBe('Consultant, country, city or service');
  });

  it('writes the destination and the words into the address, keeping the other filters and starting again from the first page', async () => {
    address.search = 'city=pune&page=3';
    const { select, input, form } = await mount();
    await setValue(select, 'japan');
    await setValue(input, '  visa ');
    await submit(form);
    expect(pushed).toEqual(['/study-abroad-consultants?city=pune&q=visa&country=japan']);
  });

  it('shows the destination the address holds, and "Any destination" removes it', async () => {
    address.search = 'country=japan&q=visa';
    const { select, input, form } = await mount();
    expect(select.value).toBe('japan');
    expect(input.value).toBe('visa');
    await setValue(select, '');
    await submit(form);
    expect(pushed).toEqual(['/study-abroad-consultants?q=visa']);
  });

  it('leaves several destinations from the filters alone unless the select is changed', async () => {
    address.search = 'country=japan,germany';
    const { select, input, form } = await mount();
    expect(select.value).toBe('');
    await setValue(input, 'pune');
    await submit(form);
    expect(pushed).toEqual(['/study-abroad-consultants?country=japan%2Cgermany&q=pune']);
  });
});
