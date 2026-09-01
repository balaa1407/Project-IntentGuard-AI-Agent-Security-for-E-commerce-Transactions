import React from 'react';

export default function MetricCard({ title, value, subtitle, icon: Icon, color = 'var(--primary)', trend }) {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.5px' }}>
          {title}
        </span>
        {Icon && (
          <div style={{ 
            padding: '6px', 
            borderRadius: '6px', 
            background: 'rgba(255, 255, 255, 0.04)',
            color: color
          }}>
            <Icon size={18} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
          {value}
        </span>
        {trend && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: trend.startsWith('+') ? 'var(--success)' : 'var(--text-muted)' }}>
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
