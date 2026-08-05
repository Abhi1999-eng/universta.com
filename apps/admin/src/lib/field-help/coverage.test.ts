import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldHelpRegistry } from './registry';

/** Completeness check: every literal `helpKey="..."` written anywhere in the
 * admin source is required to resolve in the shared registry. This catches
 * the common mistake of wiring a `<FieldLabel helpKey="resource.field" />`
 * (or `<Field helpKey=... />`, `<Select helpKey=... />`, etc.) without ever
 * adding the matching registry entry — the kind of gap a dev-only console
 * warning can be missed, but a failing test cannot.
 *
 * This only sees *literal* string keys (e.g. `helpKey="universities.name"`).
 * Computed keys built at runtime (Settings' `settings.<group>.<field>`,
 * `Core`'s `${resource}.${entity}`, `Repeater`'s `${helpPrefix}.${field}`)
 * are intentionally out of scope here — those are covered live by
 * `getFieldHelp`'s dev-mode missing-key warning instead, since the set of
 * keys they can produce isn't visible from a source-text scan. */
// __dirname is src/lib/field-help — two levels up is the src/ root.
const SRC_ROOT = join(__dirname, '..', '..');

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      collectFiles(full, out);
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function literalHelpKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of collectFiles(SRC_ROOT)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/helpKey=["']([a-zA-Z0-9_.-]+)["']/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

describe('field-help coverage', () => {
  it('has a registry entry for every literal helpKey used in the admin source', () => {
    const used = literalHelpKeys();
    const missing = [...used].filter((key) => !(key in fieldHelpRegistry)).sort();
    expect(missing, `Missing field-help registry entries for: ${missing.join(', ')}`).toEqual([]);
  });

  it('found a non-trivial number of wired keys (guards against the scan silently finding nothing)', () => {
    expect(literalHelpKeys().size).toBeGreaterThan(50);
  });
});
