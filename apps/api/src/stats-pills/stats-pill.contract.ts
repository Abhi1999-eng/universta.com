export const STATS_PILL_SECTION_KEY = 'stats-pill';
export const STATS_PILL_SOURCES = [
  'PUBLISHED_COUNTRIES',
  'PUBLISHED_UNIVERSITIES',
  'PUBLISHED_SUBJECTS',
  'PUBLISHED_COURSES',
  'COURSE_DESTINATIONS',
  'PUBLISHED_SCHOLARSHIPS',
  'PUBLISHED_CONSULTANTS',
] as const;

export type StatsPillSource = (typeof STATS_PILL_SOURCES)[number];
export type StatsPillMode = 'AUTOMATIC' | 'MANUAL';
export type StatsPillVariant = 'pill' | 'badge';

export type StatsPillItem = {
  id: string;
  visible: boolean;
  label: string;
  singularLabel?: string;
  sourceMode: StatsPillMode;
  automaticSource: StatsPillSource;
  manualValue: number | null;
  displayOrder: number;
};

export type StatsPillConfig = {
  visible: boolean;
  variant: StatsPillVariant;
  icon: { visible: boolean; name: 'dot' | 'globe' | 'book' };
  items: StatsPillItem[];
};

export type StatsPillEnvelope = {
  schemaVersion: 1;
  draft: StatsPillConfig;
  published: StatsPillConfig;
};

export type ResolvedStatsPill = Omit<StatsPillConfig, 'items'> & {
  items: Array<
    Pick<StatsPillItem, 'id' | 'label' | 'displayOrder'> & { value: number }
  >;
};

export class StatsPillValidationError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super('Statistics pill configuration is invalid.');
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseStatsPillConfig(input: unknown): StatsPillConfig {
  const value = record(input);
  const fields: Record<string, string> = {};
  if (!value)
    throw new StatsPillValidationError({
      config: 'Configuration is required.',
    });
  const variant = value.variant;
  if (variant !== 'pill' && variant !== 'badge')
    fields.variant = 'Choose pill or badge.';
  const icon = record(value.icon);
  const iconName = icon?.name;
  if (!icon || typeof icon.visible !== 'boolean')
    fields['icon.visible'] = 'Choose whether to show the icon.';
  if (!['dot', 'globe', 'book'].includes(String(iconName)))
    fields['icon.name'] = 'Choose a supported icon.';
  if (typeof value.visible !== 'boolean')
    fields.visible = 'Choose whether to show the block.';
  if (
    !Array.isArray(value.items) ||
    value.items.length < 1 ||
    value.items.length > 4
  )
    fields.items = 'Add between one and four statistics.';

  const ids = new Set<string>();
  const items: StatsPillItem[] = [];
  if (Array.isArray(value.items)) {
    value.items.forEach((raw, index) => {
      const item = record(raw);
      const key = `items.${index}`;
      if (!item) {
        fields[key] = 'Statistic is required.';
        return;
      }
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (!/^[a-z][a-z0-9-]{0,49}$/.test(id))
        fields[`${key}.id`] = 'Use a stable lowercase identifier.';
      else if (ids.has(id))
        fields[`${key}.id`] = 'Statistic identifiers must be unique.';
      ids.add(id);
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      if (!label || label.length > 60)
        fields[`${key}.label`] = 'Enter a label of 1–60 characters.';
      const singularLabel =
        typeof item.singularLabel === 'string' ? item.singularLabel.trim() : '';
      if (singularLabel.length > 60)
        fields[`${key}.singularLabel`] = 'Use 60 characters or fewer.';
      if (typeof item.visible !== 'boolean')
        fields[`${key}.visible`] = 'Choose whether to show this statistic.';
      if (item.sourceMode !== 'AUTOMATIC' && item.sourceMode !== 'MANUAL')
        fields[`${key}.sourceMode`] = 'Choose Automatic or Manual override.';
      if (!STATS_PILL_SOURCES.includes(item.automaticSource as StatsPillSource))
        fields[`${key}.automaticSource`] =
          'Choose a supported automatic source.';
      const manualValue = item.manualValue;
      if (
        item.sourceMode === 'MANUAL' &&
        (typeof manualValue !== 'number' ||
          !Number.isSafeInteger(manualValue) ||
          manualValue < 0 ||
          manualValue > 999_999_999)
      )
        fields[`${key}.manualValue`] =
          'Enter a whole number from 0 to 999,999,999.';
      const displayOrder = item.displayOrder;
      if (
        typeof displayOrder !== 'number' ||
        !Number.isInteger(displayOrder) ||
        displayOrder < 0
      )
        fields[`${key}.displayOrder`] =
          'Display order must be a non-negative whole number.';
      items.push({
        id,
        visible: item.visible === true,
        label,
        ...(singularLabel ? { singularLabel } : {}),
        sourceMode: item.sourceMode as StatsPillMode,
        automaticSource: item.automaticSource as StatsPillSource,
        manualValue: typeof manualValue === 'number' ? manualValue : null,
        displayOrder: typeof displayOrder === 'number' ? displayOrder : index,
      });
    });
  }
  if (Object.keys(fields).length) throw new StatsPillValidationError(fields);
  return {
    visible: value.visible as boolean,
    variant: variant as StatsPillVariant,
    icon: {
      visible: icon!.visible as boolean,
      name: iconName as 'dot' | 'globe' | 'book',
    },
    items,
  };
}

export function parseStatsPillEnvelope(input: unknown): StatsPillEnvelope {
  const value = record(input);
  if (!value || value.schemaVersion !== 1)
    throw new StatsPillValidationError({
      schemaVersion: 'Unsupported statistics pill schema.',
    });
  return {
    schemaVersion: 1,
    draft: parseStatsPillConfig(value.draft),
    published: parseStatsPillConfig(value.published),
  };
}

const automaticItem = (
  id: string,
  label: string,
  automaticSource: StatsPillSource,
  displayOrder: number,
  singularLabel?: string,
): StatsPillItem => ({
  id,
  visible: true,
  label,
  ...(singularLabel ? { singularLabel } : {}),
  sourceMode: 'AUTOMATIC',
  automaticSource,
  manualValue: null,
  displayOrder,
});

export const STATS_PILL_DEFAULTS: Record<string, StatsPillConfig> = {
  home: {
    visible: true,
    variant: 'pill',
    icon: { visible: true, name: 'dot' },
    items: [
      automaticItem(
        'destinations',
        'destinations',
        'PUBLISHED_COUNTRIES',
        0,
        'destination',
      ),
      automaticItem(
        'universities',
        'universities',
        'PUBLISHED_UNIVERSITIES',
        1,
        'university',
      ),
    ],
  },
  countries: {
    visible: true,
    variant: 'badge',
    icon: { visible: true, name: 'globe' },
    items: [
      automaticItem(
        'destinations',
        'destinations',
        'PUBLISHED_COUNTRIES',
        0,
        'destination',
      ),
      automaticItem(
        'universities',
        'universities',
        'PUBLISHED_UNIVERSITIES',
        1,
        'university',
      ),
    ],
  },
  'subjects-listing': {
    visible: true,
    variant: 'pill',
    icon: { visible: true, name: 'dot' },
    items: [
      automaticItem('subjects', 'subjects', 'PUBLISHED_SUBJECTS', 0, 'subject'),
      automaticItem('programs', 'programs', 'PUBLISHED_COURSES', 1, 'program'),
    ],
  },
  'courses-listing': {
    visible: true,
    variant: 'pill',
    icon: { visible: true, name: 'dot' },
    items: [
      automaticItem('programs', 'programs', 'PUBLISHED_COURSES', 0, 'program'),
      automaticItem(
        'destinations',
        'destinations',
        'COURSE_DESTINATIONS',
        1,
        'destination',
      ),
    ],
  },
  'universities-listing': {
    visible: true,
    variant: 'pill',
    icon: { visible: false, name: 'book' },
    items: [
      automaticItem(
        'published',
        'published universities',
        'PUBLISHED_UNIVERSITIES',
        0,
        'published university',
      ),
    ],
  },
  'scholarships-listing': {
    visible: true,
    variant: 'pill',
    icon: { visible: false, name: 'book' },
    items: [
      automaticItem(
        'published',
        'published scholarships',
        'PUBLISHED_SCHOLARSHIPS',
        0,
        'published scholarship',
      ),
    ],
  },
  'consultants-listing': {
    visible: true,
    variant: 'pill',
    icon: { visible: false, name: 'book' },
    items: [
      automaticItem(
        'published',
        'published consultants',
        'PUBLISHED_CONSULTANTS',
        0,
        'published consultant',
      ),
    ],
  },
};

export function statsPillEnvelope(config: StatsPillConfig): StatsPillEnvelope {
  return {
    schemaVersion: 1,
    draft: structuredClone(config),
    published: structuredClone(config),
  };
}
