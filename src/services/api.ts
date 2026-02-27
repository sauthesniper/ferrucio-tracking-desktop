import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3050',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Sessions API ---

export function fetchSessions(status?: string) {
  const params = status ? { status } : {};
  return api.get('/api/sessions', { params });
}

export function fetchSessionById(id: number) {
  return api.get(`/api/sessions/${id}`);
}

export function fetchSessionEmployees(id: number) {
  return api.get(`/api/sessions/${id}/employees`);
}

// --- Reports API ---

export function fetchSessionReport(id: number) {
  return api.get(`/api/reports/session/${id}`);
}

export function fetchEmployeeReport(id: number, from?: string, to?: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return api.get(`/api/reports/employee/${id}`, { params });
}

// --- Alerts API ---

export function fetchWorkHoursReport(from: string, to: string) {
  return api.get('/api/reports/work-hours', { params: { from, to } });
}

export function downloadMonthlyReportCsv(month: string) {
  return api.get('/api/reports/monthly', {
    params: { month, format: 'csv' },
    responseType: 'blob',
  });
}

export function fetchMonthlyReportJson(month: string) {
  return api.get('/api/reports/monthly', { params: { month, format: 'json' } });
}

export function fetchScreenTime(from: string, to: string) {
  return api.get('/api/reports/screen-time', { params: { from, to } });
}

export function fetchAlerts(sessionId?: number, employeeId?: number) {
  const params: Record<string, number> = {};
  if (sessionId) params.session_id = sessionId;
  if (employeeId) params.employee_id = employeeId;
  return api.get('/api/alerts', { params });
}

// --- Users API ---

export function fetchUsers() {
  return api.get('/api/users');
}

export function createUser(data: Record<string, unknown>) {
  return api.post('/api/users', data);
}

export function deleteUser(id: number) {
  return api.delete(`/api/users/${id}`);
}

export function updatePassword(id: number, password: string) {
  return api.patch(`/api/users/${id}/password`, { password });
}

// --- Telemetry API (for map) ---

export function fetchLatestLocations() {
  return api.get('/api/locations/latest');
}

export default api;
