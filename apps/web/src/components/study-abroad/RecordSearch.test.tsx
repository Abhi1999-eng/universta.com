// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { matches, RecordSearch, type SearchItem } from './RecordSearch';

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

const items: SearchItem[] = [
  { key: 'a', text: 'From Pune to Tokyo Aarti Nair The University of Tokyo visa', group: 'Counselling', node: <p className="card">Pune</p> },
  { key: 'b', text: 'Westmere to Zürich Kenji Sato', group: 'Content', node: <p className="card">Zurich</p> },
  { key: 'c', text: 'Northbridge to Clearwater', group: null, node: <p className="card">Clearwater</p> },
];

async function type(value: string) {
  const input = host.querySelector('input')!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('RecordSearch', () => {
  it('matches every word, ignoring case and accents', () => {
    expect(matches('Westmere to Zürich', 'zurich WEST')).toBe(true);
    expect(matches('Westmere to Zürich', 'zurich tokyo')).toBe(false);
  });

  it('narrows the stories as the reader types and says so when none match (SS-U3)', async () => {
    await act(async () =>
      root.render(<RecordSearch look="filters" label="Search stories" placeholder="" none="No stories match." items={items} />),
    );
    expect(host.querySelector('.h-filters label.h-filter.h-filter--q')?.textContent).toContain('Search stories');
    expect(host.querySelectorAll('.card')).toHaveLength(3);
    await type('aarti');
    expect([...host.querySelectorAll('.card')].map((node) => node.textContent)).toEqual(['Pune']);
    await type('nobody');
    expect(host.querySelectorAll('.card')).toHaveLength(0);
    expect(host.querySelector('.h-empty')?.textContent).toContain('No stories match.');
  });

  it('groups the roles under their department in the directory look (JOB-G3)', async () => {
    await act(async () =>
      root.render(
        <RecordSearch look="directory" label="Search roles" placeholder="" none="No role matches that." ungrouped="Other roles" items={items} />,
      ),
    );
    expect(host.querySelector('.dir__search input.dir__input')).not.toBeNull();
    expect([...host.querySelectorAll('.dir__groupname')].map((node) => node.textContent)).toEqual(['Counselling', 'Content', 'Other roles']);
    /* No count beside a group's name. */
    expect(host.querySelector('.dir__groupn')).toBeNull();
    await type('zurich');
    expect([...host.querySelectorAll('.dir__groupname')].map((node) => node.textContent)).toEqual(['Content']);
    await type('qqq');
    expect(host.querySelector('.dir__none')?.textContent).toBe('No role matches that.');
  });
});
