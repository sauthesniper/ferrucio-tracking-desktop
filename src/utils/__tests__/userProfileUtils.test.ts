import { describe, it, expect } from 'vitest';
import { generateDateRange } from '../dateRange';
import { computeAttendanceTotals } from '../attendanceTotals';
import { AttendanceSession } from '../../types/userProfile';

/**
 * Unit tests for utility functions: generateDateRange and computeAttendanceTotals
 * Validates: Requirements 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5
 */

const todayStr = new Date().toISOString().split('T')[0];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function makeSession(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: 1,
    checkInAt: '2024-01-15T08:00:00.000Z',
    checkOutAt: '2024-01-15T17:00:00.000Z',
    durationMinutes: 540,
    checkInType: 'qr',
    checkOutType: 'qr',
    checkInLeaderName: null,
    checkOutLeaderName: null,
    manualReason: null,
    ...overrides,
  };
}

describe('generateDateRange', () => {
  it('days=1 returns array with just today', () => {
    const result = generateDateRange(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(todayStr);
  });

  it('days=30 returns 30 dates, first is 29 days ago, last is today', () => {
    const result = generateDateRange(30);
    expect(result).toHaveLength(30);
    expect(result[0]).toBe(daysAgo(29));
    expect(result[29]).toBe(todayStr);

    // Verify ascending order
    for (let i = 1; i < result.length; i++) {
      expect(result[i] > result[i - 1]).toBe(true);
    }
  });

  it('days=365 returns 365 dates with correct first and last', () => {
    const result = generateDateRange(365);
    expect(result).toHaveLength(365);
    expect(result[0]).toBe(daysAgo(364));
    expect(result[364]).toBe(todayStr);
  });
});

describe('computeAttendanceTotals', () => {
  it('empty array returns all zeros', () => {
    const result = computeAttendanceTotals([]);
    expect(result).toEqual({
      totalSessions: 0,
      completedSessions: 0,
      totalMinutes: 0,
      avgSessionMinutes: 0,
    });
  });

  it('all completed sessions returns correct counts and avg', () => {
    const sessions: AttendanceSession[] = [
      makeSession({ id: 1, durationMinutes: 60 }),
      makeSession({ id: 2, durationMinutes: 120 }),
      makeSession({ id: 3, durationMinutes: 180 }),
    ];

    const result = computeAttendanceTotals(sessions);
    expect(result.totalSessions).toBe(3);
    expect(result.completedSessions).toBe(3);
    expect(result.totalMinutes).toBe(360);
    expect(result.avgSessionMinutes).toBe(120);
  });

  it('some incomplete sessions counts completedSessions correctly', () => {
    const sessions: AttendanceSession[] = [
      makeSession({ id: 1, checkOutAt: '2024-01-15T17:00:00.000Z', durationMinutes: 480 }),
      makeSession({ id: 2, checkOutAt: null, durationMinutes: null }),
      makeSession({ id: 3, checkOutAt: '2024-01-15T12:00:00.000Z', durationMinutes: 240 }),
      makeSession({ id: 4, checkOutAt: null, durationMinutes: null }),
    ];

    const result = computeAttendanceTotals(sessions);
    expect(result.totalSessions).toBe(4);
    expect(result.completedSessions).toBe(2);
    expect(result.totalMinutes).toBe(720);
    expect(result.avgSessionMinutes).toBe(360);
  });

  it('all null durations returns totalMinutes 0 and avgSessionMinutes 0', () => {
    const sessions: AttendanceSession[] = [
      makeSession({ id: 1, checkOutAt: null, durationMinutes: null }),
      makeSession({ id: 2, checkOutAt: null, durationMinutes: null }),
    ];

    const result = computeAttendanceTotals(sessions);
    expect(result.totalSessions).toBe(2);
    expect(result.completedSessions).toBe(0);
    expect(result.totalMinutes).toBe(0);
    expect(result.avgSessionMinutes).toBe(0);
  });
});
