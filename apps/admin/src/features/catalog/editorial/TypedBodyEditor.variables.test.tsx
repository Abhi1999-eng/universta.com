import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { COUNTRY_EDITORIAL_VARIABLES } from '@/features/shared/variable-autocomplete';
import { TypedBodyEditor } from './TypedBodyEditor';

function CountryContentEditor() {
  const [value, setValue] = useState({ paragraphs: [''] });
  return <TypedBodyEditor type="RICH_TEXT" value={value} onChange={setValue} variables={COUNTRY_EDITORIAL_VARIABLES} />;
}

describe('TypedBodyEditor country variables', () => {
  it('offers scoped variables from % and preserves input focus through keyboard, click, and escape', async () => {
    const user = userEvent.setup();
    render(<CountryContentEditor />);
    const paragraph = screen.getByLabelText('Paragraph 1');

    await user.click(paragraph);
    await user.type(paragraph, '%');
    expect(await screen.findByRole('listbox')).toHaveTextContent('Country name');
    expect(screen.getByRole('listbox')).toHaveTextContent('Country slug');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(paragraph).toHaveTextContent('{countrySlug}');
    expect(paragraph).toHaveFocus();

    await user.type(paragraph, ' guide %');
    await user.click(await screen.findByRole('option', { name: /Country name/ }));
    expect(paragraph).toHaveTextContent('{countrySlug} guide {countryName}');
    expect(paragraph).toHaveFocus();

    await user.type(paragraph, '%');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape} text');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(paragraph).toHaveTextContent('{countrySlug} guide {countryName}% text');
    expect(paragraph).toHaveFocus();
  });
});
