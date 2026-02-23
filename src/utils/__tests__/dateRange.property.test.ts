import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateDateRange } from '../dateRange';

/**
 * Property 2: Date range generation correctness
 * Validates: Requirements 6.1, 6.2, 6.3
 */
describe('generateDateRange - Property Tests', () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;

  it('should return an array of exactly `days` elements, all in YYYY-MM-DD format, ascending, with last date as today', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 365 }), (days) => {
        const result = generateDateRange(days);

        // Array length equals days
        expect(result).toHaveLength(days);

        // All dates match YYYY-MM-DD format
        for (const date of result) {
          expect(date).toMatch(dateFormatRegex);
        }

        // Dates are in ascending chronological order
        for (let i = 1; i < result.length; i++) {
          expect(result[i] > result[i - 1]).toBe(true);
        }

        // Last element is today
        expect(result[result.length - 1]).toBe(todayStr);

        // First element is days - 1 days ago
        const expected = new Date();
        expected.setDate(expected.getDate() - (days - 1));
        const expectedStr = expected.toISOString().split('T')[0];
        expect(result[0]).toBe(expectedStr);
      }),
      { numRuns: 100 }
    );
  });
});
