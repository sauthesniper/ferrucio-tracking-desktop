import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchSessionReport } from '../services/api';

interface SessionInfo {
  id: number;
  leaderId: number;
  leaderName: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string | null;
  employeeCount: number;
}

interface Employee {
  attendanceId: number;
  employeeId: number;
  employeeName: string;
  phone: string;
  uniqueCode: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
  checkInType: string;
  checkOutType: string | null;
  checkInLeaderId: number | null;
  checkInLeaderName: string | null;
  checkOutLeaderId: number | null;
  checkOutLeaderName: string | null;
  manualReason: string | null;
}

interface Transfer {
  id: number;
  fromLeaderId: number;
  fromLeaderName: string;
  toLeaderId: number;
  toLeaderName: string;
  transferredAt: string;
}

export default function SessionReportPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchSessionReport(Number(id))
      .then((res) => {
        setSession(res.data.session);
        setEmployees(res.data.employees);
        setTransfers(res.data.transfers);
        setError('');
      })
      .catch((err: any) => {
        setError(err?.response?.data?.error || 'Failed to load session report');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const formatDuration = (mins: number | null) => {
    if (mins == null) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <Link to="/attendance" style={{ color: '#0369a1', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        ← Back to Sessions
      </Link>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {session && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <h1 style={{ margin: 0 }}>Session Report #{session.id}</h1>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 180 }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>Leader</div>
              <div style={{ fontWeight: 600 }}>{session.leaderName}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 180 }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>Type</div>
              <div style={{ fontWeight: 600 }}>{session.type === 'check_in' ? 'Check-in' : 'Check-out'}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 180 }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>Status</div>
              <div style={{ fontWeight: 600 }}>{session.status}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 180 }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>Employees</div>
              <div style={{ fontWeight: 600 }}>{session.employeeCount}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 180 }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>Start Time</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{new Date(session.startTime).toLocaleString()}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 180 }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>End Time</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{session.endTime ? new Date(session.endTime).toLocaleString() : '—'}</div>
            </div>
          </div>
        </>
      )}

      {/* Leadership Transfers */}
      {transfers.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Leadership Transfers</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transfers.map((t) => (
              <div key={t.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: '0.9rem' }}>
                <strong>{t.fromLeaderName}</strong> → <strong>{t.toLeaderName}</strong>
                <span style={{ color: '#6b7280', marginLeft: 12 }}>{new Date(t.transferredAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee List */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Employees</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: '12px 16px' }}>Employee</th>
            <th style={{ padding: '12px 16px' }}>Check-in</th>
            <th style={{ padding: '12px 16px' }}>Check-out</th>
            <th style={{ padding: '12px 16px' }}>Duration</th>
            <th style={{ padding: '12px 16px' }}>Type</th>
            <th style={{ padding: '12px 16px' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.attendanceId} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 500 }}>
                  <Link to={`/attendance/employee/${emp.employeeId}`} style={{ color: '#0369a1', textDecoration: 'none' }}>
                    {emp.employeeName}
                  </Link>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{emp.phone}</div>
              </td>
              <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{new Date(emp.checkInAt).toLocaleString()}</td>
              <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{emp.checkOutAt ? new Date(emp.checkOutAt).toLocaleString() : '—'}</td>
              <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{formatDuration(emp.durationMinutes)}</td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500,
                  background: emp.checkInType === 'manual' ? '#fef3c7' : '#dbeafe',
                  color: emp.checkInType === 'manual' ? '#92400e' : '#1e40af',
                }}>
                  {emp.checkInType}
                </span>
                {emp.checkOutType && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500, marginLeft: 4,
                    background: emp.checkOutType === 'manual' ? '#fef3c7' : emp.checkOutType === 'auto' ? '#fce7f3' : '#dbeafe',
                    color: emp.checkOutType === 'manual' ? '#92400e' : emp.checkOutType === 'auto' ? '#9d174d' : '#1e40af',
                  }}>
                    {emp.checkOutType}
                  </span>
                )}
              </td>
              <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#6b7280' }}>
                {emp.checkInType === 'manual' && emp.checkInLeaderName && (
                  <div>Check-in by: {emp.checkInLeaderName}</div>
                )}
                {emp.checkOutType === 'manual' && emp.checkOutLeaderName && (
                  <div>Check-out by: {emp.checkOutLeaderName}</div>
                )}
                {emp.manualReason && <div>Reason: {emp.manualReason}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {employees.length === 0 && (
        <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 32 }}>No employees in this session.</p>
      )}
    </div>
  );
}
