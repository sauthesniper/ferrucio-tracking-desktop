export interface UserDetails {
  id: number;
  username: string;
  role: string;
  phone: string;
  unique_code: string;
  id_number: string | null;
  email: string | null;
  login_code: string;
  alert_exit_zone: number; // 0 or 1
  alert_checkout: number; // 0 or 1
  work_hours_limit: number | null;
  screen_time_limit: number | null;
  stationary_limit: number | null;
  createdAt: string;
}

export interface AttendanceSession {
  id: number;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
  checkInType: string;
  checkOutType: string | null;
  checkInLeaderName: string | null;
  checkOutLeaderName: string | null;
  manualReason: string | null;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed: number | null;
  accel_x: number | null;
  accel_y: number | null;
  accel_z: number | null;
  gyro_x: number | null;
  gyro_y: number | null;
  gyro_z: number | null;
  screen_on: number | null;
  battery_level?: number | null;
}

export interface GpsPoint {
  latitude: number;
  longitude: number;
  speed: number | null;
  screen_on: number | null;
  battery_level: number | null;
  recorded_at: string;
}

export interface ZoneExit {
  id: number;
  type: string;
  details: { latitude?: number; longitude?: number } | null;
  created_at: string;
}

export interface EmployeeReport {
  employee: { id: number; username: string; phone: string; uniqueCode: string };
  sessions: AttendanceSession[];
  totalHours: number;
  screenTimeMinutes: number;
  gpsTrail: GpsPoint[];
  zoneExits: ZoneExit[];
}
