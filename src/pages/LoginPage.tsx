import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/users', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error || t('login.failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a0000 0%, #000000 25%, #330000 50%, #000000 75%, #1a0000 100%)',
    }}>
      <form onSubmit={handleSubmit} style={{
        width: 380, padding: 20, borderRadius: 16,
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/cropped-fg-logo-1-1.png" alt="Feruccio Logo" style={{ width: 80, height: 80, borderRadius: 16, marginBottom: 8 }} />
          <h1 style={{ color: 'white', fontSize: '1.5rem', marginTop: 0, marginBottom: 4 }}>Feruccio</h1>
        </div>

        {error && <div style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="username" style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: '0.85rem' }}>{t('login.username')}</label>
          <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'white', fontSize: '0.9rem' }}
            placeholder={t('login.usernamePlaceholder')}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: '0.85rem' }}>{t('login.password')}</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'white', fontSize: '0.9rem' }}
            placeholder={t('login.passwordPlaceholder')}
          />
        </div>

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: 12, background: 'linear-gradient(135deg, #CC0000, #8B0000)', border: 'none',
          borderRadius: 8, color: 'white', fontWeight: 600, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 14px rgba(204,0,0,0.4)', transition: 'all 0.2s',
        }}>
          {loading ? t('login.signingIn') : t('login.submit')}
        </button>
      </form>
    </div>
  );
}
