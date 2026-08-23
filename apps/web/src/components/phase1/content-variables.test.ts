import { describe, expect, it } from 'vitest';
import { resolveContentVariables } from '../../../../../packages/content-variables';
import { safeRichText } from './RichText';

describe('public content variables', () => {
  it('resolves only University tokens from the current University record', () => {
    expect(
      resolveContentVariables(
        'university',
        '<p>{universityName} in {countryName} {jobTitle}</p>',
        {
          name: 'Demo University',
          slug: 'demo-university',
          country: { name: 'Canada', slug: 'canada' },
        },
      ),
    ).toBe('<p>Demo University in Canada {jobTitle}</p>');
  });

  it('resolves Event values and keeps unknown tokens and unsafe HTML harmless', () => {
    const resolved = resolveContentVariables(
      'event',
      '<p>{eventTitle} · {eventDate} · {unknown}</p><script>alert(1)</script>',
      { title: 'Demo Open Day', slug: 'demo-open-day', startsAt: '2026-09-01T10:00:00.000Z' },
    );
    expect(safeRichText(resolved)).toBe(
      '<p>Demo Open Day · 2026-09-01 · {unknown}</p>',
    );
  });

  it('removes known University tokens with unavailable values without changing unknown tokens', () => {
    expect(
      resolveContentVariables(
        'university',
        '<p>Study at {universityName} in {countryName}: {totallyUnknownToken}</p>',
        { name: null, country: { name: undefined } },
      ),
    ).toBe('<p>Study at  in : {totallyUnknownToken}</p>');
  });

  it('resolves multiple Country variables and treats an absent source as empty', () => {
    expect(
      resolveContentVariables(
        'country',
        '{countryName} ({countrySlug}) — {countryName}',
        { name: 'Canada', slug: 'canada' },
      ),
    ).toBe('Canada (canada) — Canada');
    expect(
      resolveContentVariables('country', 'Study in {countryName}', undefined),
    ).toBe('Study in ');
  });
});
