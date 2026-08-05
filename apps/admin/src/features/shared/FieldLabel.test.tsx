import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldLabel } from './FieldLabel';

describe('FieldLabel', () => {
  it('renders the label and required marker without an icon when no help resolves', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<FieldLabel label="Mystery field" required helpKey="not.a.real.key" />);
    expect(screen.getByText('Mystery field')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Information about/ })).not.toBeInTheDocument();
    warnSpy.mockRestore();
  });

  it('renders the icon when an inline help object is passed', () => {
    render(
      <FieldLabel
        label="Source URL"
        help={{ purpose: 'p', dataType: 'URL', required: 'Optional.' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Information about Source URL' })).toBeVisible();
  });

  it('renders the icon when a registry helpKey resolves', () => {
    render(<FieldLabel label="Slug" helpKey="universities.slug" />);
    expect(screen.getByRole('button', { name: 'Information about Slug' })).toBeVisible();
  });
});
