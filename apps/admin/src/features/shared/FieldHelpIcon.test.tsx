import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FieldHelpIcon } from './FieldHelpIcon';
import { FieldLabel } from './FieldLabel';
import type { FieldHelpContent } from '@/lib/field-help/types';

const help: FieldHelpContent = {
  purpose: 'The record’s display name.',
  input: 'A clear, specific name.',
  dataType: 'Text',
  required: 'Required.',
  example: 'Business & Management',
  frontendEffect: 'Shown as the page heading.',
};

describe('FieldHelpIcon', () => {
  it('is a real button with an accessible label, closed by default', () => {
    render(<FieldHelpIcon fieldLabel="Name" help={help} />);
    const button = screen.getByRole('button', { name: 'Information about Name' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on click and shows purpose/data type/required/example', async () => {
    const user = userEvent.setup();
    render(<FieldHelpIcon fieldLabel="Name" help={help} />);
    await user.click(screen.getByRole('button', { name: 'Information about Name' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeVisible();
    expect(dialog).toHaveTextContent(help.purpose!);
    expect(dialog).toHaveTextContent('Text');
    expect(dialog).toHaveTextContent('Required.');
    expect(dialog).toHaveTextContent('Business & Management');
  });

  it('opens on Enter and on Space', async () => {
    const user = userEvent.setup();
    render(<FieldHelpIcon fieldLabel="Name" help={help} />);
    const button = screen.getByRole('button', { name: 'Information about Name' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    button.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('closes on Escape and on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <FieldHelpIcon fieldLabel="Name" help={help} />
        <button type="button">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Information about Name' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Information about Name' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('only keeps one popover open at a time across sibling fields', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <FieldHelpIcon fieldLabel="Name" help={help} />
        <FieldHelpIcon fieldLabel="Slug" help={{ ...help, purpose: 'Slug purpose' }} />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Information about Name' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Information about Slug' }));
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveTextContent('Slug purpose');
  });

  it('never submits or affects the sibling form field on click', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <label htmlFor="name-input">
          <FieldLabel label="Name" htmlFor="name-input" help={help} />
        </label>
        <input id="name-input" defaultValue="original" />
        <button type="submit">Save</button>
      </form>,
    );
    const input = screen.getByDisplayValue('original');
    await user.click(screen.getByRole('button', { name: 'Information about Name' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(input).toHaveValue('original');
    expect(document.activeElement).not.toBe(input);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
