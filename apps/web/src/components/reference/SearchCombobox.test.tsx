// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchCombobox, type SearchComboboxProps } from './SearchCombobox';

/**
 * The search field the heroes and the course finder share. Its new choices
 * -- a phone's icon-only submit, suggestions that open their own page, and
 * a form that submits without script -- are opt-in, so every page that
 * does not ask for them draws and behaves exactly as it did.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: SearchComboboxProps = {
  label: 'Search courses',
  placeholder: 'Search courses',
  submitLabel: 'Find courses',
  value: 'data',
  onValueChange: () => {},
  onSubmit: () => {},
  endpoint: '/api/courses/suggestions',
  emptyMessage: 'None.',
  className: 'cresults__search',
};

/* The markup the field had before either choice existed, with React's
   generated id left as it renders. */
const BEFORE =
  '<form class="searchwrap cresults__search"><div class="bigsearch searchbar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667085" stroke-width="1.7" aria-hidden="true" class="ic"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input class="bigsearch__input" type="text" role="combobox" aria-label="Search courses" aria-autocomplete="list" aria-expanded="false" aria-controls="_R_0_" autoComplete="off" placeholder="Search courses" value="data"/><button type="submit" class="btn btn--sm">Find courses <span class="btn__arrow" aria-hidden="true">→</span></button></div></form>';

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mount(props: Partial<SearchComboboxProps>) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<SearchCombobox {...base} {...props} />));
  return host;
}

describe('the shared search field', () => {
  it('renders exactly as before with the default props', () => {
    expect(renderToStaticMarkup(<SearchCombobox {...base} />)).toBe(BEFORE);
  });

  it('marks the form and wraps the button’s words when asked for an icon submit', () => {
    const html = renderToStaticMarkup(<SearchCombobox {...base} iconSubmit />);
    expect(html).toContain('class="searchwrap cresults__search searchwrap--iconsubmit"');
    expect(html).toContain('<span class="searchwrap__label">Find courses</span>');
  });

  it('submits without script where it is told to, with the fields it is given', () => {
    const html = renderToStaticMarkup(
      <SearchCombobox {...base} action="/courses" name="q" maxLength={100}>
        <input type="hidden" name="level" value="PG" />
      </SearchCombobox>,
    );
    const form = new DOMParser().parseFromString(html, 'text/html').querySelector('form')!;
    expect(form.getAttribute('action')).toBe('/courses');
    expect(form.getAttribute('method')).toBe('get');
    const field = form.querySelector('input[role=combobox]')!;
    expect(field.getAttribute('name')).toBe('q');
    expect(field.getAttribute('maxlength')).toBe('100');
    expect(form.querySelector('input[type=hidden][name=level]')?.getAttribute('value')).toBe('PG');
  });

  it('adds the term to an endpoint that has a query of its own', async () => {
    vi.useFakeTimers();
    const fetched: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fetched.push(url);
        return new Response(JSON.stringify({ data: [] }));
      }),
    );
    mount({ value: 'warw', endpoint: '/api/courses/suggestions?with=programmes' });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(fetched).toEqual(['/api/courses/suggestions?with=programmes&q=warw']);
  });

  it('follows a suggestion that has its own page, and searches for one that does not', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [
                { name: 'BSc Computer Science' },
                {
                  name: 'University of Warwick',
                  kind: 'university',
                  href: '/courses?university=university-of-warwick',
                },
              ],
            }),
          ),
      ),
    );
    const onFollow = vi.fn();
    const onSubmit = vi.fn();
    const page = mount({ value: 'warw', onFollow, onSubmit });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    const options = [...page.querySelectorAll('[role=option]')];
    expect(options.map((option) => option.textContent)).toEqual([
      'BSc Computer Science',
      'University of Warwick University',
    ]);
    act(() => {
      options[1]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onFollow).toHaveBeenCalledWith('/courses?university=university-of-warwick');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('treats every suggestion as a search term when the caller follows none', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [{ name: 'University of Warwick', kind: 'university', href: '/x' }],
            }),
          ),
      ),
    );
    const onSubmit = vi.fn();
    const page = mount({ value: 'warw', onSubmit });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    const option = page.querySelector('[role=option]')!;
    expect(option.textContent).toBe('University of Warwick');
    act(() => {
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onSubmit).toHaveBeenCalledWith('University of Warwick');
  });
});
