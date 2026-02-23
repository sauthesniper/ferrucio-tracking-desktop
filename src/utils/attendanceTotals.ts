import { AttendanceSession } from '../types/userProfile';

export function computeAttendanceTotals(sessions: AttendanceSession[]): {
  totalSessions: number;
  completedSessions: number;
  totalMinutes: number;
  avgSessionMinutes: number;
} {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.checkOutAt !== null).length;
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
  const avgSessionMinutes = completedSessions > 0 ? totalMinutes / completedSessions : 0;

  return { totalSessions, completedSessions, totalMinutes, avgSessionMinutes };
}
