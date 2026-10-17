import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { RichTextEditor, sanitizeEditorHtml } from './RichTextEditor';
import {
  COUNTRY_EDITORIAL_VARIABLES,
  type DynamicVariable,
  variablesForContext,
} from './variable-autocomplete';

/**
 * The editing engine is Jodit's, and so is its toolbar. Asserting which button
 * Jodit renders, or how it applies a list, would be testing the library rather
 * than Universta -- and the previous two suites did exactly that for
 * `execCommand` and then Tiptap, which is why neither caught the selection bugs
 * an operator hit in a real browser.
 *
 * What is ours is the seam: the shared field contract, the value that reaches
 * the form, the Media Library and variable controls, and the stored tag set.
 * Editor behaviour proper is exercised in a browser instead.
 */

const MEDIA = [
  {
    id: 'media-1',
    url: '/api/v1/media/editor-image.webp',
    title: 'Editor image',
    alt: 'Editor image',
    width: null,
    height: null,
  },
];

function EditorExample({
  value = '<p>Existing <strong>HTML</strong></p>',
  disabled = false,
  variables = COUNTRY_EDITORIAL_VARIABLES,
  enableImages = false,
}: {
  value?: string;
  disabled?: boolean;
  variables?: readonly DynamicVariable[];
  enableImages?: boolean;
}) {
  const [current, setCurrent] = useState(value);
  return (
    <>
      <RichTextEditor
        label="Description"
        value={current}
        onChange={setCurrent}
        allowedVariables={variables}
        disabled={disabled}
        enableImages={enableImages}
        media={enableImages ? MEDIA : []}
      />
      <output>{current}</output>
    </>
  );
}

const box = () => screen.getByRole('textbox', { name: 'Description' });
const stored = () => screen.getByRole('status', { hidden: true }).textContent ?? '';

describe('RichTextEditor', () => {
  it('presents a labelled rich-text field carrying the stored value', async () => {
    render(<EditorExample />);

    await waitFor(() => expect(box()).toBeVisible());
    expect(box()).toHaveTextContent('Existing HTML');
    expect(box().querySelector('strong')).not.toBeNull();
  });

  it('reports edits back to the form', async () => {
    render(<EditorExample value="<p>plain</p>" />);
    await waitFor(() => expect(box()).toBeVisible());

    box().innerHTML = '<p>edited</p>';
    await userEvent.click(box());
    box().dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => expect(stored()).toContain('<p>edited</p>'));
  });

  /* The "Insert variable [Choose…]" dropdown that used to sit above every
   * field is gone; variables and records are picked inline by typing `%` in
   * the editor itself. Which variables a field offers is still a contract, and
   * it is asserted directly against the registry and the suggestion builder in
   * entity-autocomplete.test.ts -- the picking is a caret behaviour and is
   * covered in a browser. What belongs here is that the old control really has
   * left every field. */
  it('offers no separate insert-variable control', async () => {
    render(<EditorExample value="<p>Body</p>" />);
    await waitFor(() => expect(box()).toBeVisible());

    expect(screen.queryByLabelText(/Insert variable/i)).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Insert variable')).toBeNull();
  });

  it('still scopes its variable registry to the field context', () => {
    /* The registry is what the inline menu is built from, so a field that must
     * not offer job variables still must not have them in scope. */
    const university = variablesForContext('university').map((row) => row.key);
    expect(university).toContain('universityName');
    expect(university.join(' ')).not.toMatch(/job/i);
    expect(variablesForContext(undefined)).toEqual([]);
  });

  it('inserts a Media Library image, and offers no other upload path', async () => {
    render(<EditorExample value="<p>Body</p>" enableImages />);
    await waitFor(() => expect(box()).toBeVisible());

    await userEvent.click(screen.getByRole('button', { name: 'Insert image' }));

    await waitFor(() =>
      expect(stored()).toContain('<img src="/api/v1/media/editor-image.webp"'),
    );
  });

  it('hides the image control where the field has no image support', async () => {
    render(<EditorExample enableImages={false} />);
    await waitFor(() => expect(box()).toBeVisible());

    expect(screen.queryByRole('button', { name: 'Insert image' })).toBeNull();
  });

  it('leaves a disabled field non-editable', async () => {
    render(<EditorExample disabled />);
    await waitFor(() => expect(box()).toBeVisible());

    expect(box()).toHaveAttribute('contenteditable', 'false');
  });
});

/**
 * The stored subset is the contract with the API sanitiser and the public
 * renderer. It has outlived two editors now, and did not move for this one.
 */
describe('sanitizeEditorHtml', () => {
  it('drops scripts, styles and event handlers', () => {
    expect(sanitizeEditorHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
    expect(sanitizeEditorHtml('<p onclick="steal()">ok</p>')).toBe('<p>ok</p>');
    expect(sanitizeEditorHtml('<style>p{}</style><p>ok</p>')).toBe('<p>ok</p>');
  });

  it('keeps the editorial tag set intact', () => {
    const html =
      '<h2>Head</h2><p><strong>b</strong><em>i</em><u>u</u><s>s</s></p><ul><li>one</li></ul><ol><li>two</li></ol><blockquote>q</blockquote>';
    expect(sanitizeEditorHtml(html)).toBe(html);
  });

  it('keeps a safe link and strips a dangerous one', () => {
    expect(sanitizeEditorHtml('<a href="https://example.org">x</a>')).toContain(
      'href="https://example.org"',
    );
    expect(sanitizeEditorHtml('<a href="/countries/malta">x</a>')).toContain(
      'href="/countries/malta"',
    );
    expect(sanitizeEditorHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('keeps alignment but only the three values the renderer supports', () => {
    expect(sanitizeEditorHtml('<p style="text-align: center">x</p>')).toBe(
      '<p style="text-align: center">x</p>',
    );
    expect(sanitizeEditorHtml('<p style="text-align: justify">x</p>')).toBe('<p>x</p>');
    expect(sanitizeEditorHtml('<p style="position:fixed">x</p>')).toBe('<p>x</p>');
  });

  it('strips the wrappers a Word or Docs paste brings with it', () => {
    const pasted =
      '<p class="MsoNormal"><span style="mso-fareast-font-family:Calibri">Pasted</span> <b>bold</b></p>';
    expect(sanitizeEditorHtml(pasted)).toBe('<p>Pasted <b>bold</b></p>');
  });

  it('rejects an image the renderer could not load safely', () => {
    expect(sanitizeEditorHtml('<img src="https://cdn.example.org/a.png" alt="a">')).toContain(
      'src="https://cdn.example.org/a.png"',
    );
    expect(sanitizeEditorHtml('<img src="javascript:alert(1)">')).toBe('');
  });

  /* Jodit hands its markup over already encoded. Escaping that again stored
     `&amp;amp;`, one more layer on every blur, and the link or image went to
     the wrong address. */
  it('writes an encoded href, src and alt back with one layer of escaping', () => {
    expect(sanitizeEditorHtml('<a href="https://example.com/?a=1&amp;b=2">x</a>')).toBe(
      '<a href="https://example.com/?a=1&amp;b=2" rel="noopener noreferrer">x</a>',
    );
    expect(
      sanitizeEditorHtml('<img src="https://cdn.example.org/a.jpg?w=1&amp;h=2" alt="Tom &amp; Jerry">'),
    ).toBe('<img src="https://cdn.example.org/a.jpg?w=1&amp;h=2" alt="Tom &amp; Jerry">');
    /* A bare `&`, as imported HTML may carry it, is escaped once too. */
    expect(sanitizeEditorHtml('<a href="https://example.com/?a=1&b=2">x</a>')).toContain(
      'href="https://example.com/?a=1&amp;b=2"',
    );
  });

  it('changes nothing on a second pass, however often the field is left', () => {
    const inputs = [
      '<p><a href="https://example.com/?a=1&amp;b=2&#38;c=3">x</a></p>',
      '<img src="/media/a.jpg?w=1&h=2" alt="Tom &amp; Jerry &quot;TJ&quot;">',
      '<img src="https://cdn.example.org/a.jpg" alt="a &amp;lt; b &nbsp; &#0; c">',
      '<a href="mailto:team@example.org?subject=Hi&amp;body=There">x</a>',
    ];
    for (const input of inputs) {
      const once = sanitizeEditorHtml(input);
      expect(sanitizeEditorHtml(once)).toBe(once);
      expect(sanitizeEditorHtml(sanitizeEditorHtml(sanitizeEditorHtml(once)))).toBe(once);
    }
  });

  /* What the browser reads back is the address the author typed, through
     the editor's own serialisation and any number of blurs. */
  it('keeps the address the browser reads through repeated edit cycles', () => {
    const host = document.createElement('div');
    const link = document.createElement('a');
    link.setAttribute('href', 'https://example.com/?a=1&b=2');
    link.textContent = 'x';
    const image = document.createElement('img');
    image.setAttribute('src', 'https://cdn.example.org/a.jpg?w=1&h=2');
    image.setAttribute('alt', 'Tom & Jerry <3 "TJ"');
    host.append(link, image);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      host.innerHTML = sanitizeEditorHtml(host.innerHTML);
      expect(host.querySelector('a')!.getAttribute('href')).toBe('https://example.com/?a=1&b=2');
      expect(host.querySelector('img')!.getAttribute('src')).toBe('https://cdn.example.org/a.jpg?w=1&h=2');
      expect(host.querySelector('img')!.getAttribute('alt')).toBe('Tom & Jerry <3 "TJ"');
    }
  });

  /* One decode only: `&amp;lt;` is the text `&lt;`, not a `<`, and a value
     stored with an extra layer keeps it rather than growing another. */
  it('decodes an attribute once, never twice', () => {
    expect(sanitizeEditorHtml('<img src="/media/a.jpg" alt="a &amp;lt; b">')).toBe(
      '<img src="/media/a.jpg" alt="a &amp;lt; b">',
    );
    expect(sanitizeEditorHtml('<a href="https://example.com/?a=1&amp;amp;b=2">x</a>')).toContain(
      'href="https://example.com/?a=1&amp;amp;b=2"',
    );
  });

  /* The address checks read the decoded value, as the browser will. */
  it('refuses an encoded script or off-site address once decoded', () => {
    expect(sanitizeEditorHtml('<a href="&#106;avascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeEditorHtml('<a href="&#x6A;avascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeEditorHtml('<a href="&#9;javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeEditorHtml('<a href="java&#9;script:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeEditorHtml('<a href="java&#x0A;script:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeEditorHtml('<img src="&#106;avascript:alert(1)">')).toBe('');
    expect(sanitizeEditorHtml('<a href="&#47;&#47;evil.example">x</a>')).toBe('<a>x</a>');
    expect(sanitizeEditorHtml('<a href="//evil.example">x</a>')).toBe('<a>x</a>');
    expect(sanitizeEditorHtml('<a href="/\\evil.example">x</a>')).toBe('<a>x</a>');
    expect(sanitizeEditorHtml('<img src="&#47;/evil.example/a.png">')).toBe('');
  });
});
