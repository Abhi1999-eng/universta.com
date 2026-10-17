import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnifiedEditorActions } from './UnifiedEditorActions';

const navigated = vi.hoisted(() => vi.fn());
/* Behaves as Next's link does: the click handler runs first, and a handler
   that prevents the default stops the navigation. */
vi.mock('next/link', () => ({
  default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void }) => (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) navigated(href);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

describe('UnifiedEditorActions', () => {
  it('can render in normal document flow for the Country editor without changing its actions', () => {
    const { container } = render(<UnifiedEditorActions cancelHref="/countries" sticky={false} />);

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/countries');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
    expect(container.firstChild).not.toHaveClass('sticky');
    expect(container.firstChild).not.toHaveClass('bottom-4');
  });

  it('lets an editor keep Cancel from leaving, and leaves as before without one', () => {
    const { unmount } = render(<UnifiedEditorActions cancelHref="/subjects/subject-1" onCancel={(event) => event.preventDefault()} />);
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(navigated).not.toHaveBeenCalled();
    unmount();

    render(<UnifiedEditorActions cancelHref="/subjects" />);
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(navigated).toHaveBeenCalledWith('/subjects');
  });
});
