import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  CountryTaxonomyPicker,
  type TaxonomyRow,
} from './CountryTaxonomyPicker';

/**
 * A subject is the container its specializations live in, so the two have to
 * move together. Unticking a subject changed only the subject list: the
 * country stopped listing Law and went on claiming all twelve of its Law
 * specializations, and re-ticking the subject handed them back without
 * saying so.
 */

const ROWS: TaxonomyRow[] = [
  {
    id: 'law',
    label: 'Law',
    usage: 5,
    children: [
      { id: 'law-intl', label: 'International Law' },
      { id: 'law-ip', label: 'Intellectual Property Law' },
    ],
  },
  {
    id: 'cs',
    label: 'Computer Science',
    usage: 12,
    children: [
      { id: 'cs-ai', label: 'Artificial Intelligence' },
      { id: 'cs-ml', label: 'Machine Learning' },
    ],
  },
];

const ALL_CHILDREN = ['law-intl', 'law-ip', 'cs-ai', 'cs-ml'];

function Harness({
  subjects = ROWS.map((row) => row.id),
  children = ALL_CHILDREN,
}: {
  subjects?: string[];
  children?: string[];
}) {
  const [selected, setSelected] = useState(subjects);
  const [childSelection, setChildSelection] = useState(children);
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <CountryTaxonomyPicker
        title="Subjects"
        singular="Subject"
        testId="subjects"
        rows={ROWS}
        selected={selected}
        onChange={setSelected}
        childTitle="specializations"
        selectedChildren={childSelection}
        onChildrenChange={setChildSelection}
        onCreate={async (name) => ({
          kind: 'created',
          id: `new-${name}`,
          label: name,
        })}
      />
      <output data-testid="subjects-out">{[...selected].sort().join(',')}</output>
      <output data-testid="children-out">
        {[...childSelection].sort().join(',')}
      </output>
    </form>
  );
}

const subjects = () => screen.getByTestId('subjects-out').textContent;
const children = () => screen.getByTestId('children-out').textContent;

describe('unticking a subject', () => {
  it('takes its specializations with it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(children()).toBe('cs-ai,cs-ml,law-intl,law-ip');

    await user.click(screen.getByRole('checkbox', { name: /^Law/ }));

    expect(subjects()).toBe('cs');
    // Law's own specializations are gone; Computer Science's are untouched.
    expect(children()).toBe('cs-ai,cs-ml');
  });

  it('brings the whole set back when the subject is ticked again', async () => {
    const user = userEvent.setup();
    render(<Harness subjects={['cs']} children={['cs-ai']} />);

    await user.click(screen.getByRole('checkbox', { name: /^Law/ }));

    expect(subjects()).toBe('cs,law');
    /* A country covers the whole of a subject until its author narrows it --
       the same rule a new country starts under. */
    expect(children()).toBe('cs-ai,law-intl,law-ip');
  });

  it('leaves a subject with no specializations alone', async () => {
    const user = userEvent.setup();
    render(<Harness subjects={['law']} children={['law-intl', 'law-ip']} />);

    await user.click(screen.getByRole('checkbox', { name: /^Computer Science/ }));

    expect(subjects()).toBe('cs,law');
    expect(children()).toBe('cs-ai,cs-ml,law-intl,law-ip');
  });
});
