import React from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Search, 
  Workflow, 
  Flame, 
  Code, 
  Fingerprint, 
  Settings, 
  Server,
  Zap
} from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, systemStatus = 'OPERATIONAL', latencyMs = 38 }) {
  const tabs = [
    { id: 'command-center', label: 'Command Center', icon: Activity },
    { id: 'transactions', label: 'Transaction Explorer', icon: Search },
    { id: 'journey', label: 'Journey Visualizer', icon: Workflow },
    { id: 'simulation', label: 'Attack Simulation Lab', icon: Flame },
    { id: 'policy', label: 'Policy Workbench', icon: Code },
    { id: 'audit', label: 'Audit Explorer', icon: Fingerprint },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="enterprise-header">
      {/* Brand & Platform Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ 
          width: '38px', 
          height: '38px', 
          borderRadius: '10px', 
          background: 'linear-gradient(135deg, #0284C7, #38BDF8)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)'
        }}>
          <ShieldCheck size={22} color="#fff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.2px', color: '#fff' }}>
              IntentGuard
            </h1>
            <span style={{ 
              fontSize: '0.65rem', 
              fontWeight: 700, 
              background: 'rgba(56, 189, 248, 0.15)', 
              color: 'var(--primary)', 
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '4px',
              padding: '1px 6px',
              letterSpacing: '0.5px'
            }}>
              ENTERPRISE
            </span>
          </div>
          <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
            AI-Agent Transaction Security & Authorization Platform
          </p>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="nav-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Real-time Status Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          background: 'rgba(0,0,0,0.4)', 
          padding: '4px 10px', 
          borderRadius: '6px', 
          border: '1px solid var(--border-subtle)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)'
        }}>
          <Zap size={13} color="var(--primary)" />
          <span>{latencyMs}ms</span>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          background: 'rgba(16, 185, 129, 0.1)', 
          padding: '4px 10px', 
          borderRadius: '6px', 
          border: '1px solid rgba(16, 185, 129, 0.25)',
          fontSize: '0.75rem',
          color: 'var(--success)'
        }}>
          <span className="status-dot online"></span>
          <span>SANDBOX ACTIVE</span>
        </div>
      </div>
    </header>
  );
}
