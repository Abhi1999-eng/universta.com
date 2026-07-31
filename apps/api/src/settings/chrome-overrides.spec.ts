import {
  parseChromeConfig,
  pageSlugForPath,
  resolveChrome,
  templateKeyForPath,
  normalisePath,
} from './chrome-overrides';

/** The precedence rule is the whole feature: Page beats Template beats Global.
 * Getting it wrong would silently apply the wrong chrome to real pages, so it
 * is pinned here rather than only exercised through the browser. */

const pageHide = { header: { mode: 'HIDE' as const } };
const templateVariant = {
  header: { mode: 'ALTERNATE_VARIANT' as const, variant: 'compact' },
};

describe('chrome override precedence', () => {
  it('falls back to Global when neither layer has an opinion', () => {
    const resolved = resolveChrome(null, null);
    expect(resolved.header).toMatchObject({
      mode: 'USE_GLOBAL',
      source: 'global',
    });
    expect(resolved.footer).toMatchObject({
      mode: 'USE_GLOBAL',
      source: 'global',
    });
  });

  it('uses the Template override when the Page has none', () => {
    const resolved = resolveChrome(null, templateVariant);
    expect(resolved.header).toMatchObject({
      mode: 'ALTERNATE_VARIANT',
      variant: 'compact',
      source: 'template',
    });
  });

  it('lets the Page override win over the Template override', () => {
    const resolved = resolveChrome(pageHide, templateVariant);
    expect(resolved.header).toMatchObject({ mode: 'HIDE', source: 'page' });
  });

  it('treats an explicit USE_GLOBAL on the Page as no opinion, not as a veto', () => {
    // A page that has been set back to "Use Global" must not shadow a template
    // override -- otherwise resetting one page would silently opt it out of
    // the template's chrome forever.
    const resolved = resolveChrome(
      { header: { mode: 'USE_GLOBAL' } },
      templateVariant,
    );
    expect(resolved.header).toMatchObject({
      mode: 'ALTERNATE_VARIANT',
      source: 'template',
    });
  });

  it('resolves header and footer independently', () => {
    const resolved = resolveChrome(
      { header: { mode: 'HIDE' } },
      { footer: { mode: 'ALTERNATE_VARIANT', variant: 'minimal' } },
    );
    expect(resolved.header.source).toBe('page');
    expect(resolved.footer).toMatchObject({
      variant: 'minimal',
      source: 'template',
    });
  });
});

describe('chrome override parsing', () => {
  it('returns null for anything that is not an override object', () => {
    expect(parseChromeConfig(null)).toBeNull();
    expect(parseChromeConfig('HIDE')).toBeNull();
    expect(parseChromeConfig([])).toBeNull();
    expect(parseChromeConfig({})).toBeNull();
  });

  it('drops an unknown mode rather than trusting it', () => {
    expect(
      parseChromeConfig({ header: { mode: 'DELETE_EVERYTHING' } }),
    ).toBeNull();
  });

  it('drops an unknown variant but keeps the valid mode', () => {
    const parsed = parseChromeConfig({
      header: { mode: 'ALTERNATE_VARIANT', variant: 'not-a-variant' },
    });
    expect(parsed?.header).toMatchObject({ mode: 'ALTERNATE_VARIANT' });
    expect(parsed?.header?.variant).toBeUndefined();
  });

  it('keeps the structured header and footer fields it does recognise', () => {
    const parsed = parseChromeConfig({
      header: {
        mode: 'ALTERNATE_VARIANT',
        variant: 'compact',
        navigationMenuKey: 'header-secondary',
        announcementVisible: false,
        ctaVisible: true,
        ctaLabel: 'Talk to us',
        ctaUrl: '/counselling',
      },
      footer: { mode: 'HIDE', counsellingCtaVisible: false },
    });
    expect(parsed?.header).toEqual({
      mode: 'ALTERNATE_VARIANT',
      variant: 'compact',
      navigationMenuKey: 'header-secondary',
      announcementVisible: false,
      ctaVisible: true,
      ctaLabel: 'Talk to us',
      ctaUrl: '/counselling',
    });
    expect(parsed?.footer).toMatchObject({
      mode: 'HIDE',
      counsellingCtaVisible: false,
    });
  });
});

describe('public path resolution', () => {
  it('maps static routes to their CMS page', () => {
    expect(pageSlugForPath('/')).toBe('home');
    expect(pageSlugForPath('/about')).toBe('about');
    expect(pageSlugForPath('/about/')).toBe('about');
    expect(pageSlugForPath('/about?x=1')).toBe('about');
    expect(pageSlugForPath('/universities')).toBeNull();
  });

  it('maps dynamic detail routes to the template that renders them', () => {
    expect(templateKeyForPath('/universities/oxford')).toBe(
      'university-detail',
    );
    expect(templateKeyForPath('/universities/oxford/courses')).toBe(
      'university-courses',
    );
    expect(templateKeyForPath('/universities/oxford/courses/msc-cs')).toBe(
      'university-course-offering',
    );
    expect(
      templateKeyForPath('/study-abroad-consultants/locations/delhi'),
    ).toBe('consultant-location');
    expect(templateKeyForPath('/study-abroad-consultants/acme')).toBe(
      'consultant-detail',
    );
    // A listing route is not a detail route and must not pick up a template.
    expect(templateKeyForPath('/universities')).toBeNull();
    expect(templateKeyForPath('/scholarships')).toBeNull();
  });

  it('normalises query strings, fragments and trailing slashes', () => {
    expect(normalisePath('/universities/oxford/')).toBe('/universities/oxford');
    expect(normalisePath('/universities?page=2')).toBe('/universities');
    expect(normalisePath('/faq#top')).toBe('/faq');
    expect(normalisePath('')).toBe('/');
  });
});
