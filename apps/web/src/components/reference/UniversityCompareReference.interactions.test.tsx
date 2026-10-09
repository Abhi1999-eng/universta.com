// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UniversityCompareReference, type CompareUniversity, type UniversityCompareReferenceProps } from './UniversityCompareReference';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
const transition = vi.hoisted(() => ({ pending: false }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useTransition: () => [transition.pending, (callback: () => void) => callback()] as const,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const universities: CompareUniversity[] = Array.from({ length: 6 }, (_, index) => ({
  slug: `university-${index + 1}`, name: `University ${index + 1}`, country: 'United Kingdom', countrySlug: 'uk',
  institutionType: 'PUBLIC', campuses: 1, offerings: 6, accreditations: [], verifiedAt: null, shortDescription: null,
}));
const options = universities.map(({ name, slug }) => ({ name, slug }));
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  navigation.push.mockClear();
  transition.pending = false;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(items: CompareUniversity[] = [], over: Partial<UniversityCompareReferenceProps> = {}) {
  await act(async () => root.render(<UniversityCompareReference items={items} options={options} selected={items.map((item) => item.slug)} invalid={[]} {...over} />));
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
const namedButton = (name: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === name)!;

describe('the university comparison controls', () => {
  it('adds directly from the ZIP picker to the shareable address', async () => {
    await render([universities[0]]);
    const picker = host.querySelector<HTMLSelectElement>('#compare-add-universities')!;
    expect(Array.from(picker.options).map((option) => option.value)).not.toContain(universities[0].slug);
    await act(async () => {
      picker.value = universities[1].slug;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(navigation.push).toHaveBeenLastCalledWith('/compare/universities?items=university-1,university-2');
  });

  it('keeps the search-and-pick draft flow until Compare selected is pressed', async () => {
    await render();
    await click(namedButton('Add University 1'));
    expect(namedButton('Compare selected').disabled).toBe(true);
    await click(namedButton('Add University 2'));
    expect(navigation.push).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Selected comparison items"]')?.textContent).toContain('University 1');
    await click(namedButton('Compare selected'));
    expect(navigation.push).toHaveBeenLastCalledWith('/compare/universities?items=university-1,university-2');
  });

  it('keeps rapid direct picks while the previous server navigation is still unanswered', async () => {
    await render([universities[0]]);
    const picker = host.querySelector<HTMLSelectElement>('#compare-add-universities')!;
    await act(async () => {
      picker.value = universities[1].slug;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      picker.value = universities[2].slug;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(navigation.push).toHaveBeenLastCalledWith('/compare/universities?items=university-1,university-2,university-3');
    expect(Array.from(picker.options).map((option) => option.value)).not.toContain(universities[1].slug);
    await click(host.querySelector<HTMLElement>('[data-testid="university-compare-clear"]')!);
    await act(async () => {
      picker.value = universities[3].slug;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(navigation.push).toHaveBeenLastCalledWith('/compare/universities?items=university-4');
  });

  it('locks selection controls while intermediate server props arrive, then adds to the completed selection', async () => {
    await render([universities[0]]);
    const picker = host.querySelector<HTMLSelectElement>('#compare-add-universities')!;
    await act(async () => {
      picker.value = universities[1].slug;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      picker.value = universities[2].slug;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(navigation.push).toHaveBeenLastCalledWith('/compare/universities?items=university-1,university-2,university-3');

    // The A+B response can arrive while the later A+B+C navigation is
    // still pending. A fourth pick must wait for the completed selection.
    transition.pending = true;
    await render(universities.slice(0, 2));
    const clear = host.querySelector<HTMLButtonElement>('[data-testid="university-compare-clear"]')!;
    const remove = host.querySelector<HTMLAnchorElement>('a[aria-label="Remove University 1 from the comparison"]')!;
    const draftRemove = host.querySelector<HTMLButtonElement>('button[aria-label="Remove University 1 from selection"]')!;
    const region = host.querySelector('[role="region"][aria-label="University comparison"]')!;
    expect(picker.disabled).toBe(true);
    expect(clear.disabled).toBe(true);
    expect(namedButton('Add University 4').disabled).toBe(true);
    expect(namedButton('Compare selected').disabled).toBe(true);
    expect(draftRemove.disabled).toBe(true);
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    expect(remove.tabIndex).toBe(-1);
    expect(region.getAttribute('aria-busy')).toBe('true');
    const callsBeforeBlockedActions = navigation.push.mock.calls.length;
    await click(clear);
    await click(namedButton('Compare selected'));
    const removalClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => { remove.dispatchEvent(removalClick); });
    expect(removalClick.defaultPrevented).toBe(true);
    expect(navigation.push).toHaveBeenCalledTimes(callsBeforeBlockedActions);

    transition.pending = false;
    await render(universities.slice(0, 3));
    expect(picker.disabled).toBe(false);
    expect(clear.disabled).toBe(false);
    expect(region.getAttribute('aria-busy')).toBe('false');
    await act(async () => {
      picker.value = universities[3].slug;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(navigation.push).toHaveBeenLastCalledWith('/compare/universities?items=university-1,university-2,university-3,university-4');
  });

  it('shows five real columns and prevents a sixth pick', async () => {
    await render(universities.slice(0, 5));
    expect(host.querySelectorAll('[data-testid="compare-table"] thead th')).toHaveLength(6);
    expect(host.querySelector<HTMLSelectElement>('#compare-add-universities')?.disabled).toBe(true);
    expect(namedButton('Add University 6').disabled).toBe(true);
    expect(host.querySelector('[role="region"][aria-label="University comparison"]')?.getAttribute('tabindex')).toBe('0');
  });

  it('removes a column with a real URL and clears both committed and draft selections', async () => {
    await render(universities.slice(0, 3));
    expect(host.querySelector('a[aria-label="Remove University 2 from the comparison"]')?.getAttribute('href')).toBe('/compare/universities?items=university-1,university-3');
    await click(namedButton('Add University 4'));
    await click(host.querySelector<HTMLElement>('[data-testid="university-compare-clear"]')!);
    expect(navigation.push).toHaveBeenLastCalledWith('/compare/universities');
    expect(host.querySelector('[aria-label="Selected comparison items"]')?.children).toHaveLength(0);
  });

  it('restores the draft when Back or a shared URL changes the requested items', async () => {
    await render(universities.slice(0, 2));
    await click(namedButton('Add University 3'));
    await render([universities[0]]);
    expect(host.querySelector('[aria-label="Selected comparison items"]')?.children).toHaveLength(1);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('1/5 selected');
  });

  it('does not resurrect a committed pick after Back restores an earlier selection', async () => {
    await render([universities[0]]);
    const picker = host.querySelector<HTMLSelectElement>('#compare-add-universities')!;
    await act(async () => {
      picker.value = universities[1].slug;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(navigation.push).toHaveBeenLastCalledWith('/compare/universities?items=university-1,university-2');
    await render(universities.slice(0, 2));
    await render([universities[0]]);
    expect(host.querySelector('[aria-label="Selected comparison items"]')?.children).toHaveLength(1);
    await act(async () => {
      picker.value = universities[2].slug;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(navigation.push).toHaveBeenLastCalledWith('/compare/universities?items=university-1,university-3');
  });

  it('keeps missing values and outages distinct from invented statistics or an empty comparison', async () => {
    await render([universities[0]], { invalid: ['not-published'] });
    expect(host.textContent).toContain('Not published, so left out of the comparison: not-published');
    expect(host.querySelector('table')?.textContent).toContain('QS rankingNot listed');
    expect(host.querySelector('table')?.textContent).toContain('Not listed at university level');
    expect(host.querySelector('table')?.textContent).toContain('Not verified');
    expect(host.textContent).not.toContain('admission odds');
    await render([], { unavailable: true });
    expect(host.textContent).toContain('could not be loaded');
    expect(host.querySelector('[data-testid="compare-empty"]')).toBeNull();
  });
});
