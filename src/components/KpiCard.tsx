import React from 'react';

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  minWidth: 200,
};

const iconContainerStyle = (color: string): React.CSSProperties => ({
  width: 48,
  height: 48,
  borderRadius: 10,
  background: color + '18',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.4rem',
  color,
  flexShrink: 0,
});

const titleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#6b7280',
  margin: 0,
  fontWeight: 500,
};

const valueStyle: React.CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 700,
  color: '#111827',
  margin: 0,
  lineHeight: 1.2,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#9ca3af',
  margin: 0,
  marginTop: 2,
};

export default function KpiCard({ title, value, icon, color, subtitle }: KpiCardProps) {
  return (
    <div style={{ ...cardStyle, borderBottom: `4px solid ${color}` }}>
      <div style={iconContainerStyle(color)}>{icon}</div>
      <div>
        <p style={titleStyle}>{title}</p>
        <p style={valueStyle}>{value}</p>
        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      </div>
    </div>
  );
}
