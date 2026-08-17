import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CatalogDialog } from './CatalogDialog';

function ControlledDialogExample() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open continent editor
      </button>
      {open ? (
        <CatalogDialog
          title="Edit continent"
          description="Edit the continent fields."
          onClose={() => setOpen(false)}
        >
          <label>
            Name
            <input
              aria-label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="button">Save continent</button>
        </CatalogDialog>
      ) : null}
    </div>
  );
}

describe('CatalogDialog', () => {
  it('preserves controlled-input focus through typing and deletion', async () => {
    const user = userEvent.setup();
    render(<ControlledDialogExample />);

    await user.click(
      screen.getByRole('button', { name: 'Open continent editor' }),
    );

    const name = screen.getByRole('textbox', { name: 'Name' });
    const close = screen.getByRole('button', { name: 'Close dialog' });
    expect(name).toHaveFocus();

    await user.type(name, 'Europe');
    expect(name).toHaveValue('Europe');
    expect(name).toHaveFocus();
    expect(close).not.toHaveFocus();

    await user.keyboard('{Backspace}{Backspace}{Backspace}');
    expect(name).toHaveValue('Eur');
    expect(name).toHaveFocus();
    expect(close).not.toHaveFocus();
  });

  it('traps Tab navigation and restores focus after Escape closes', async () => {
    const user = userEvent.setup();
    render(<ControlledDialogExample />);

    const trigger = screen.getByRole('button', {
      name: 'Open continent editor',
    });
    await user.click(trigger);
    const name = screen.getByRole('textbox', { name: 'Name' });
    const save = screen.getByRole('button', { name: 'Save continent' });
    const close = screen.getByRole('button', { name: 'Close dialog' });

    await user.tab();
    expect(save).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(save).toHaveFocus();

    name.focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
