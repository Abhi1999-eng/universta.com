import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorFields } from './EditorFields';
import { RichTextEditor } from './RichTextEditor';

/* A rich-text box is not a form control, so a disabled fieldset alone left it
   editable while the rest of the editor was locked for a save. */
describe('editor fields', () => {
  const fields = (locked: boolean) => (
    <EditorFields locked={locked}>
      <input aria-label="Name" />
      <RichTextEditor label="Overview" value="" onChange={() => undefined} />
    </EditorFields>
  );

  it('locks plain controls and rich text alike, and frees both again', async () => {
    const { rerender } = render(fields(true));
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(await screen.findByRole('textbox', { name: 'Overview' })).toHaveAttribute('contenteditable', 'false');

    rerender(fields(false));
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Overview' })).toHaveAttribute('contenteditable', 'true');
  });

  it('keeps a rich-text box that is read-only of its own read-only when unlocked', async () => {
    render(
      <EditorFields locked={false}>
        <RichTextEditor label="Intro" value="" onChange={() => undefined} readOnly />
      </EditorFields>,
    );
    expect(await screen.findByRole('textbox', { name: 'Intro' })).toHaveAttribute('contenteditable', 'false');
  });
});
