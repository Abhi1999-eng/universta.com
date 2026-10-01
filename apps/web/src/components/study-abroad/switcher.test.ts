import { describe, expect, it } from 'vitest';
import { SWITCHER_COLUMNS, switcherClass } from './switcher';

/**
 * "Where you can study X" lays its destination chips into three equal
 * tracks. That reads well at 186 chips and badly at one: the single chip was
 * stretched across a third of the band with two empty columns beside it, so
 * the section looked like something that had failed to load rather than a
 * destination list with one entry in it.
 */

describe('the destination chip grid', () => {
  it('packs one chip to the start instead of stretching it', () => {
    expect(switcherClass(1)).toBe('switcher switcher--few');
  });

  it('does the same for two', () => {
    expect(switcherClass(2)).toBe('switcher switcher--few');
  });

  it('fills the tracks once there are enough of them to fill', () => {
    expect(switcherClass(SWITCHER_COLUMNS)).toBe('switcher');
    expect(switcherClass(186)).toBe('switcher');
  });

  it('is harmless at zero, where the section does not render at all', () => {
    expect(switcherClass(0)).toBe('switcher switcher--few');
  });
});
