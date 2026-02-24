import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { t } from '../index';
import ro from '../ro.json';

/**
 * **Validates: Requirements 7.5, 8.5**
 * Feature: geofencing-i18n-ro, Property 12: Funcția t() returnează cheia ca fallback
 *
 * For any translation key that does NOT exist in the translations file,
 * t(key) must return the original key as displayed text.
 */
describe('Feature: geofencing-i18n-ro, Property 12: Funcția t() returnează cheia ca fallback', () => {
  it('t() returns the key itself when the key does not exist in translations', () => {
    const existingKeys = new Set(Object.keys(ro));

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((key) => !existingKeys.has(key)),
        (key) => {
          expect(t(key)).toBe(key);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('t() returns the translation when the key exists', () => {
    const entries = Object.entries(ro);
    if (entries.length === 0) return;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: entries.length - 1 }),
        (index) => {
          const [key, value] = entries[index];
          expect(t(key)).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 13.5**
 * Feature: geofencing-i18n-ro, Property 13: Round-trip JSON traduceri
 *
 * For any valid JSON translations file, parsing followed by serialization
 * (JSON.stringify) and re-parsing (JSON.parse) must produce an identical object.
 */
describe('Feature: geofencing-i18n-ro, Property 13: Round-trip JSON traduceri', () => {
  it('round-trip JSON.stringify then JSON.parse produces identical object for random translations', () => {
    const translationArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
      fc.string({ minLength: 0, maxLength: 200 })
    );

    fc.assert(
      fc.property(translationArb, (translations) => {
        const serialized = JSON.stringify(translations);
        const deserialized = JSON.parse(serialized);
        expect(deserialized).toEqual(translations);
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip preserves the actual ro.json translations file', () => {
    const serialized = JSON.stringify(ro);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(ro);
  });
});
