import { describe, expect, it } from 'vitest';
import { fieldHelpRegistry, getFieldHelp } from './registry';
import { GROUP_FIELDS } from '@/features/settings/SettingsManager';

/** Covers the field-help keys that are *built at runtime*, not written as a
 * literal `helpKey="..."` string — `coverage.test.ts`'s source-text scan
 * cannot see these, so they get their own manifest here.
 *
 * Three real sources of computed keys exist in the admin:
 *  1. SettingsManager's `GroupForm` builds `settings.<group>.<field.key>`
 *     for every entry in `GROUP_FIELDS` — read directly from the exported
 *     source of truth, so this list can never drift out of date.
 *  2. Phase1StructuredEditor's `Core` builds `<resource>.<entity>`,
 *     `<resource>.slug`, and `<resource>.<summaryKey>` from its `resource`/
 *     `entity`/`summaryKey` props.
 *  3. Phase1StructuredEditor's `Repeater` builds `<helpPrefix>.<field>` for
 *     each field in its `fields` array, from its `helpPrefix` prop.
 *
 * (2) and (3) are plain call-site data, not exported from the component, so
 * they're mirrored here by hand — keep this list in sync with the `<Core
 * resource=… entity=… summaryKey=…>` and `<Repeater helpPrefix=… fields=…>`
 * call sites in Phase1StructuredEditor.tsx if either changes. */

const CORE_CALL_SITES: Array<{ resource: string; entity: 'name' | 'title'; summaryKey?: string }> = [
  { resource: 'universities', entity: 'name', summaryKey: 'shortDescription' },
  { resource: 'offerings', entity: 'name', summaryKey: 'shortDescription' },
  { resource: 'scholarships', entity: 'title', summaryKey: 'summary' },
  { resource: 'consultants', entity: 'name', summaryKey: 'shortDescription' },
  { resource: 'jobs', entity: 'title', summaryKey: 'summary' },
  { resource: 'events', entity: 'title', summaryKey: 'summary' },
  { resource: 'success-stories', entity: 'title' },
];

const REPEATER_CALL_SITES: Array<{ helpPrefix: string; fields: string[] }> = [
  { helpPrefix: 'campuses', fields: ['name', 'city', 'state', 'address'] },
  { helpPrefix: 'accreditations', fields: ['name', 'accreditor', 'referenceUrl'] },
  { helpPrefix: 'requirements', fields: ['category', 'title', 'description', 'minimumScore'] },
];

function settingsKeys(): string[] {
  const keys: string[] = [];
  for (const [group, config] of Object.entries(GROUP_FIELDS)) {
    for (const field of config.fields) keys.push(`settings.${group}.${field.key}`);
  }
  return keys;
}

function coreKeys(): string[] {
  const keys: string[] = [];
  for (const { resource, entity, summaryKey } of CORE_CALL_SITES) {
    keys.push(`${resource}.${entity}`, `${resource}.slug`);
    if (summaryKey) keys.push(`${resource}.${summaryKey}`);
  }
  return keys;
}

function repeaterKeys(): string[] {
  const keys: string[] = [];
  for (const { helpPrefix, fields } of REPEATER_CALL_SITES) {
    for (const field of fields) keys.push(`${helpPrefix}.${field}`);
  }
  return keys;
}

describe('dynamic field-help coverage', () => {
  it('has a registry entry for every settings.<group>.<key> GroupForm can build', () => {
    const keys = settingsKeys();
    expect(keys.length).toBeGreaterThan(20);
    const missing = keys.filter((key) => !(key in fieldHelpRegistry));
    expect(missing, `Missing settings registry entries: ${missing.join(', ')}`).toEqual([]);
  });

  it('has a registry entry for every <resource>.<entity/slug/summaryKey> Core can build', () => {
    const keys = coreKeys();
    const missing = keys.filter((key) => !(key in fieldHelpRegistry));
    expect(missing, `Missing Core-derived registry entries: ${missing.join(', ')}`).toEqual([]);
  });

  it('has a registry entry for every <helpPrefix>.<field> Repeater can build', () => {
    const keys = repeaterKeys();
    const missing = keys.filter((key) => !(key in fieldHelpRegistry));
    expect(missing, `Missing Repeater-derived registry entries: ${missing.join(', ')}`).toEqual([]);
  });

  it('resolves every dynamic key through getFieldHelp without a dev-warning miss', () => {
    for (const key of [...settingsKeys(), ...coreKeys(), ...repeaterKeys()]) {
      expect(getFieldHelp(key), `getFieldHelp missed "${key}"`).toBeDefined();
    }
  });
});
