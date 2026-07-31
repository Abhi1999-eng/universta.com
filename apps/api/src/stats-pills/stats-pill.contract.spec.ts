import {
  parseStatsPillConfig,
  parseStatsPillEnvelope,
  STATS_PILL_DEFAULTS,
  StatsPillValidationError,
  statsPillEnvelope,
} from './stats-pill.contract';

describe('statistics pill contract', () => {
  it('registers exactly the seven audited page pills in Automatic mode', () => {
    expect(Object.keys(STATS_PILL_DEFAULTS)).toEqual([
      'home',
      'countries',
      'subjects-listing',
      'courses-listing',
      'universities-listing',
      'scholarships-listing',
      'consultants-listing',
    ]);
    expect(
      Object.values(STATS_PILL_DEFAULTS).flatMap((pill) =>
        pill.items.map((item) => item.sourceMode),
      ),
    ).toEqual(expect.not.arrayContaining(['MANUAL']));
  });

  it('keeps draft and published configurations independent', () => {
    const envelope = statsPillEnvelope(STATS_PILL_DEFAULTS.home);
    envelope.draft.items[0].label = 'places';
    expect(envelope.published.items[0].label).toBe('destinations');
    expect(parseStatsPillEnvelope(envelope)).toEqual(envelope);
  });

  it.each([
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    '12',
    'not-a-number',
    null,
  ])('rejects invalid manual value %s', (manualValue) => {
    const config = structuredClone(STATS_PILL_DEFAULTS.home);
    config.items[0] = {
      ...config.items[0],
      sourceMode: 'MANUAL',
      manualValue: manualValue as never,
    };
    expect(() => parseStatsPillConfig(config)).toThrow(
      StatsPillValidationError,
    );
  });

  it('accepts zero and a safe positive whole number in Manual mode', () => {
    for (const manualValue of [0, 942]) {
      const config = structuredClone(STATS_PILL_DEFAULTS.home);
      config.items[0] = {
        ...config.items[0],
        sourceMode: 'MANUAL',
        manualValue,
      };
      expect(parseStatsPillConfig(config).items[0].manualValue).toBe(
        manualValue,
      );
    }
  });

  it('rejects duplicate stable identifiers and unsupported sources', () => {
    const duplicate = structuredClone(STATS_PILL_DEFAULTS.home);
    duplicate.items[1].id = duplicate.items[0].id;
    expect(() => parseStatsPillConfig(duplicate)).toThrow(
      StatsPillValidationError,
    );
    const source = structuredClone(STATS_PILL_DEFAULTS.home) as never as {
      items: Array<{ automaticSource: string }>;
    };
    source.items[0].automaticSource = 'ARBITRARY_TABLE';
    expect(() => parseStatsPillConfig(source)).toThrow(
      StatsPillValidationError,
    );
  });
});
