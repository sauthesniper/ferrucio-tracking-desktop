import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSessions } from '../services/api';

interface Session {
  id: number;
  leader_id: number;
  leader_name: string;
  type: string;
  status: string;
  numeric_code: string;
  created_at: string;
  closed_at: string | null;
  employee_count: number;
}

export default function AttendancePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetchSessions(filter || undefined);
      setSessions(res.data.sessions);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSessions(); }, [filter]);

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      active: { bg: '#d1fae5', color: '#065f46' },
      expired: { bg: '#fef3c7', color: '#92400e' },
      closed: { bg: '#e2e8f0', color: '#475569' },
    };
    const s = styles[status] || styles.closed;
    return (
      <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500, background: s.bg, color: s.color }}>
        {status}
      </span>
    );
  };

  const typeBadge = (type: string) => {
    const isCheckIn = type === 'check_in';
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
        background: isCheckIn ? '#dbeafe' : '#fce7f3',
        color: isCheckIn ? '#1e40af' : '#9d174d',
      }}>
        {isCheckIn ? 'Check-in' : 'Check-out'}
      </span>
    );
  };

  const filteredSessions = sessions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.leader_name.toLowerCase().includes(q) ||
      s.numeric_code.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h1 style={{ margin: 0 }}>Attendance Sessions</h1>
      </div>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        {['', 'active', 'expired', 'closed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer',
              background: filter === f ? '#1e3a5f' : 'white',
              color: filter === f ? 'white' : '#374151',
              fontWeight: filter === f ? 600 : 400, fontSize: '0.85rem',
            }}
          >
            {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sessions..."
          style={{ padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: 6, marginLeft: 8, width: 200 }}
        />
        <button onClick={loadSessions} disabled={loading} style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: '12px 16px' }}>ID</th>
            <th style={{ padding: '12px 16px' }}>Leader</th>
            <th style={{ padding: '12px 16px' }}>Type</th>
            <th style={{ padding: '12px 16px' }}>Employees</th>
            <th style={{ padding: '12px 16px' }}>Status</th>
            <th style={{ padding: '12px 16px' }}>Created</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSessions.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '12px 16px', fontWeight: 500 }}>#{s.id}</td>
              <td style={{ padding: '12px 16px' }}>{s.leader_name}</td>
              <td style={{ padding: '12px 16px' }}>{typeBadge(s.type)}</td>
              <td style={{ padding: '12px 16px' }}>{s.employee_count}</td>
              <td style={{ padding: '12px 16px' }}>{statusBadge(s.status)}</td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>
                {new Date(s.created_at).toLocaleString()}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <Link
                  to={`/attendance/session/${s.id}`}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: '0.85rem',
                    background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd',
                    textDecoration: 'none',
                  }}
                >
                  View Report
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sessions.length === 0 && !loading && (
        <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 32 }}>No sessions found.</p>
      )}
    </div>
  );
}
