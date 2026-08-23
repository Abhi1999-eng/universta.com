import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditor, sanitizeEditorHtml } from './RichTextEditor';
import {
  COUNTRY_EDITORIAL_VARIABLES,
  type DynamicVariable,
  variablesForContext,
} from './variable-autocomplete';

vi.mock('@/features/catalog/editorial/MediaPickerDialog', () => ({
  MediaPickerDialog: ({
    onSelectMedia,
  }: {
    onSelectMedia?: (media: {
      id: string;
      url: string;
      alt: string;
      title: string;
    }) => void;
  }) => (
    <button
      type="button"
      aria-label="Insert image"
      onClick={() =>
        onSelectMedia?.({
          id: 'media-1',
          url: '/api/v1/media/editor-image.webp',
          alt: 'Editor image',
          title: 'Editor image',
        })
      }
    >
      Image
    </button>
  ),
}));

function EditorExample({
  value = '<p>Existing <strong>HTML</strong></p>',
  disabled = false,
  variables = COUNTRY_EDITORIAL_VARIABLES,
}: {
  value?: string;
  disabled?: boolean;
  variables?: readonly DynamicVariable[];
}) {
  const [current, setCurrent] = useState(value);
  return <><RichTextEditor label="Description" value={current} onChange={setCurrent} allowedVariables={variables} disabled={disabled} /><output>{current}</output></>;
}

describe('RichTextEditor', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'execCommand', { value: vi.fn(), configurable: true });
    Object.defineProperty(document, 'queryCommandState', { value: vi.fn(() => false), configurable: true });
    Object.defineProperty(document, 'queryCommandEnabled', { value: vi.fn(() => false), configurable: true });
  });

  it('loads existing HTML, keeps focus while editing, and exposes the complete editorial toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorExample />);
    const editor = screen.getByRole('textbox', { name: 'Description' });
    expect(editor).toHaveTextContent('Existing HTML');
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Bulleted list', 'Numbered list', 'Blockquote', 'Add link', 'Remove link', 'Undo', 'Redo']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    await user.click(editor);
    await user.type(editor, ' text');
    expect(editor).toHaveFocus();
    await user.keyboard('{Backspace}{Delete} {Enter}{ArrowLeft}{Control>}b{/Control}{Control>}i{/Control}');
    expect(editor).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(document.execCommand).toHaveBeenCalledWith('bold', false, undefined);
    expect(editor).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'H2' }));
    await user.click(screen.getByRole('button', { name: 'Bulleted list' }));
    await user.click(screen.getByRole('button', { name: 'Align center' }));
    vi.spyOn(window, 'prompt').mockReturnValue('https://universta.example/resource');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'h2');
    expect(document.execCommand).toHaveBeenCalledWith('insertUnorderedList', false, undefined);
    expect(document.execCommand).toHaveBeenCalledWith('justifyCenter', false, undefined);
    expect(document.execCommand).toHaveBeenCalledWith('createLink', false, 'https://universta.example/resource');
    expect(editor).toHaveFocus();
  });

  it('reflects the current selection format in mutually exclusive and toggle toolbar controls', async () => {
    render(<EditorExample value={'<h2><strong><em><u>Heading</u></em></strong></h2><h3>Subheading</h3><h4>Small heading</h4><ul><li>Bullet</li></ul><ol><li>Number</li></ol><blockquote>Quote</blockquote><p style="text-align: left">Left</p><p style="text-align: center"><a href="/country">Link</a></p><p style="text-align: right">Right</p>'} />);
    const editor = screen.getByRole('textbox', { name: 'Description' });

    setCaret(editor.querySelector('h2')?.firstChild?.firstChild?.firstChild as Text);
    await waitFor(() => expect(screen.getByRole('button', { name: 'H2' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button', { name: 'Paragraph' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Underline' })).toHaveAttribute('aria-pressed', 'true');

    setCaret(editor.querySelector('h3')?.firstChild as Text);
    await waitFor(() => expect(screen.getByRole('button', { name: 'H3' })).toHaveAttribute('aria-pressed', 'true'));
    setCaret(editor.querySelector('h4')?.firstChild as Text);
    await waitFor(() => expect(screen.getByRole('button', { name: 'H4' })).toHaveAttribute('aria-pressed', 'true'));

    setCaret(editor.querySelector('ul li')?.firstChild as Text);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bulleted list' })).toHaveAttribute('aria-pressed', 'true'));
    setCaret(editor.querySelector('ol li')?.firstChild as Text);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Numbered list' })).toHaveAttribute('aria-pressed', 'true'));
    setCaret(editor.querySelector('blockquote')?.firstChild as Text);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Blockquote' })).toHaveAttribute('aria-pressed', 'true'));
    setCaret(editor.querySelector('a')?.firstChild as Text);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add link' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button', { name: 'Remove link' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Align center' })).toHaveAttribute('aria-pressed', 'true');

    setCaret(Array.from(editor.querySelectorAll('p')).at(0)?.firstChild as Text);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Align left' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button', { name: 'Remove link' })).toBeDisabled();
    setCaret(Array.from(editor.querySelectorAll('p')).at(2)?.firstChild as Text);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Align right' })).toHaveAttribute('aria-pressed', 'true'));
  });

  it('updates command state after toolbar actions and uses real disabled semantics', async () => {
    let bold = false;
    vi.mocked(document.queryCommandState).mockImplementation((command) => command === 'bold' && bold);
    vi.mocked(document.execCommand).mockImplementation((command) => {
      if (command === 'bold') bold = true;
      return true;
    });
    const user = userEvent.setup();
    render(<EditorExample value="<p>Text</p>" />);
    const editor = screen.getByRole('textbox', { name: 'Description' });
    setCaret(editor.querySelector('p')?.firstChild as Text);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove link' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove selected image' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(editor).toHaveFocus();
  });

  it('inserts scoped variables through %, supports keyboard navigation, click, and escape', async () => {
    const user = userEvent.setup();
    render(<EditorExample value="" />);
    const editor = screen.getByRole('textbox', { name: 'Description' });
    editor.focus();
    const text = document.createTextNode('%');
    editor.append(text);
    const range = document.createRange();
    range.setStart(text, 1);
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.input(editor);
    expect(await screen.findByRole('listbox')).toHaveTextContent('Country name');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(editor).toHaveTextContent('{countrySlug}');
    expect(editor).toHaveFocus();

    const second = document.createTextNode('%');
    editor.append(second);
    const secondRange = document.createRange();
    secondRange.setStart(second, 1);
    secondRange.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(secondRange);
    fireEvent.input(editor);
    await user.click(await screen.findByRole('option', { name: /Country name/ }));
    expect(editor).toHaveTextContent('{countrySlug}{countryName}');
    expect(editor).toHaveFocus();

    editor.append(document.createTextNode('%'));
    const last = editor.lastChild as Text;
    const lastRange = document.createRange();
    lastRange.setStart(last, 1);
    lastRange.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(lastRange);
    fireEvent.input(editor);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not expose variables when the editor context has no safe variables', () => {
    render(<EditorExample value="" variables={[]} />);
    const editor = screen.getByRole('textbox', { name: 'Description' });
    editor.replaceChildren(document.createTextNode('%'));
    const noScopeRange = document.createRange();
    noScopeRange.setStart(editor.firstChild as Text, 1);
    noScopeRange.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(noScopeRange);
    fireEvent.input(editor);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('uses entity-scoped suggestions for University and does not mix in Job tokens', async () => {
    const user = userEvent.setup();
    render(<EditorExample value="" variables={variablesForContext('university')} />);
    const editor = screen.getByRole('textbox', { name: 'Description' });
    editor.focus();
    const text = document.createTextNode('%');
    editor.append(text);
    const range = document.createRange();
    range.setStart(text, 1);
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.input(editor);

    expect(await screen.findByRole('listbox')).toHaveTextContent('University name');
    expect(screen.getByRole('listbox')).not.toHaveTextContent('Job title');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(editor).toHaveTextContent('{universitySlug}');
  });

  it('inserts an existing Media Library image at the current editor selection', async () => {
    const user = userEvent.setup();
    render(<EditorExample value="<p>Image here</p>" />);
    const editor = screen.getByRole('textbox', { name: 'Description' });
    const text = editor.firstChild?.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, text.length);
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.keyUp(editor, { key: 'ArrowRight' });

    await user.click(screen.getByRole('button', { name: 'Insert image' }));

    expect(document.execCommand).toHaveBeenCalledWith(
      'insertHTML',
      false,
      '<img src="/api/v1/media/editor-image.webp" alt="Editor image">',
    );
  });

  it('enables image removal only for an actual selected image', async () => {
    render(<EditorExample value={'<p>Before <img src="/api/v1/media/editor-image.webp" alt="Editor image"> after</p>'} />);
    const editor = screen.getByRole('textbox', { name: 'Description' });
    const image = editor.querySelector('img') as HTMLImageElement;
    const range = document.createRange();
    range.selectNode(image);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove selected image' })).toBeEnabled());
  });

  it('sanitizes unsafe HTML and leaves disabled editors non-editable', () => {
    expect(sanitizeEditorHtml('<script>alert(1)</script><a href="javascript:bad">Bad</a><img src="data:image/png;base64,x">')).not.toContain('script');
    expect(sanitizeEditorHtml('<script>alert(1)</script>')).not.toContain('alert(1)');
    expect(sanitizeEditorHtml('<p style="text-align: center; color: red">Aligned</p>')).toBe('<p style="text-align: center">Aligned</p>');
    render(<EditorExample disabled />);
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();
  });

  it('sanitizes pasted HTML before inserting it', () => {
    render(<EditorExample value="" />);
    const editor = screen.getByRole('textbox', { name: 'Description' });
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) =>
          type === 'text/html'
            ? '<p>Safe</p><script>danger()</script><img src="data:image/png;base64,nope">'
            : 'Safe',
      },
    });

    expect(document.execCommand).toHaveBeenCalledWith(
      'insertHTML',
      false,
      '<p>Safe</p>',
    );
  });
});

function setCaret(node: Text) {
  const range = document.createRange();
  range.setStart(node, 0);
  range.collapse(true);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}
