import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeAttendanceTotals } from '../attendanceTotals';
import { AttendanceSession } from '../../types/userProfile';

/**
 * Property 3: Attendance totals computation
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

const arbDateStr = fc
  .integer({ min: 1577836800000, max: 1893456000000 }) // 2020-01-01 to 2030-01-01 as timestamps
  .map((ts) => new Date(ts).toISOString());

const arbAttendanceSession: fc.Arbitrary<AttendanceSession> = fc.record({
  id: fc.integer({ min: 1 }),
  checkInAt: arbDateStr,
  checkOutAt: fc.oneof(fc.constant(null), arbDateStr),
  durationMinutes: fc.oneof(
    fc.constant(null),
    fc.float({ min: 0, max: 10000, noNaN: true })
  ),
  checkInType: fc.constantFrom('qr', 'manual', 'auto'),
  checkOutType: fc.oneof(fc.constant(null), fc.constantFrom('qr', 'manual', 'auto')),
  checkInLeaderName: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
  checkOutLeaderName: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
  manualReason: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 50 })),
});

describe('computeAttendanceTotals - Property Tests', () => {
  it('should satisfy all attendance totals properties for any session array', () => {
    fc.assert(
      fc.property(fc.array(arbAttendanceSession, { maxLength: 100 }), (sessions) => {
        const result = computeAttendanceTotals(sessions);

        // 1. totalSessions === sessions.length
        expect(result.totalSessions).toBe(sessions.length);

        // 2. completedSessions <= totalSessions
        expect(result.completedSessions).toBeLessThanOrEqual(result.totalSessions);

        // 3. completedSessions equals count of sessions with non-null checkOutAt
        const expectedCompleted = sessions.filter((s) => s.checkOutAt !== null).length;
        expect(result.completedSessions).toBe(expectedCompleted);

        // 4. totalMinutes >= 0
        expect(result.totalMinutes).toBeGreaterThanOrEqual(0);

        // 5. totalMinutes equals sum of durationMinutes (null → 0)
        const expectedMinutes = sessions.reduce(
          (sum, s) => sum + (s.durationMinutes ?? 0),
          0
        );
        expect(result.totalMinutes).toBeCloseTo(expectedMinutes, 5);

        // 6. When completedSessions > 0: avgSessionMinutes === totalMinutes / completedSessions
        if (result.completedSessions > 0) {
          expect(result.avgSessionMinutes).toBeCloseTo(
            result.totalMinutes / result.completedSessions,
            5
          );
        }

        // 7. When completedSessions === 0: avgSessionMinutes === 0
        if (result.completedSessions === 0) {
          expect(result.avgSessionMinutes).toBe(0);
        }
      }),
      { numRuns: 200 }
    );
  });
});
