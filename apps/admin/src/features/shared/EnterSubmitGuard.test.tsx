import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EnterSubmitGuard } from './EnterSubmitGuard';
import { UnifiedEditorActions } from './UnifiedEditorActions';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

/* Enter in a text field submits a form through its first submit button. In
   the editors that is "Move to draft" once a record is live, so a stray
   Enter took it off the site. The guard comes first and is disabled. */
function Editor({ onSubmit, guarded = true }: { onSubmit: (intent: string | undefined) => void; guarded?: boolean }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value);
      }}
    >
      {guarded ? <EnterSubmitGuard /> : null}
      <label>Name<input /></label>
      <UnifiedEditorActions cancelHref="/subjects" published />
    </form>
  );
}

describe('EnterSubmitGuard', () => {
  it('keeps Enter in a text field from saving, while both actions still save', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Editor onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Oceans{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Move to draft' }));
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onSubmit.mock.calls).toEqual([['draft'], ['publish']]);
  });

  it('is what stops it: without the guard, Enter moved a live record to draft', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Editor onSubmit={onSubmit} guarded={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('draft');
  });

  it('is invisible and out of the tab order', () => {
    const { container } = render(<form><EnterSubmitGuard /></form>);
    const guard = container.querySelector('button')!;
    expect(guard).toBeDisabled();
    expect(guard).not.toBeVisible();
    expect(guard).toHaveAttribute('tabindex', '-1');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
