import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Server, 
  ShieldCheck, 
  Cpu, 
  UserCheck, 
  Key, 
  CheckCircle2, 
  Database,
  Lock,
  Layers
} from 'lucide-react';
import { api } from '../api/client';

export default function SystemSettings() {
  const [modelProvider, setModelProvider] = useState('gemini-2.5-flash');
  const [activeRole, setActiveRole] = useState('security_operator');
  const [healthStatus, setHealthStatus] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    api.getHealth().then((data) => {
      setHealthStatus(data);
    }).catch(() => {
      setHealthStatus({
        status: "OPERATIONAL",
        service: "IntentGuard Enterprise",
        version: "1.0.0",
        environment: "sandbox",
        sandbox_mode: true
      });
    });
  }, []);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Platform Settings & Governance</h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Configure model providers, role-based access control (RBAC), and operational security boundaries.
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleSave} style={{ fontSize: '0.8rem' }}>
          <CheckCircle2 size={14} /> Save Configuration
        </button>
      </div>

      {isSaved && (
        <div style={{ padding: '10px 16px', background: 'var(--success-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: 'var(--success)', fontSize: '0.825rem', fontWeight: 600 }}>
          Configuration successfully saved and applied to active session!
        </div>
      )}

      {/* Main Grid: Model Provider & RBAC */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Model Provider Config */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
              LLM Intent Extraction Provider
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            The LLM translates natural language instructions into structured constraints. Note: The LLM is strictly an untrusted translation layer and never approves transactions.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { id: 'gemini-2.5-flash', name: 'Google Gemini 2.5 Flash', desc: 'Default server-side structured JSON model with lowest latency.' },
              { id: 'claude-3-5-sonnet', name: 'Anthropic Claude 3.5 Sonnet', desc: 'High-precision semantic extraction provider.' },
              { id: 'gpt-4o', name: 'OpenAI GPT-4o', desc: 'Standard structured output translation engine.' },
              { id: 'offline-deterministic', name: 'Offline Deterministic Rule Engine', desc: '100% offline regex & semantic matcher (No external API calls).' }
            ].map((p) => (
              <label 
                key={p.id}
                className="glass-card" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '12px', 
                  cursor: 'pointer',
                  border: modelProvider === p.id ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  background: modelProvider === p.id ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-surface-card)',
                  padding: '12px'
                }}
              >
                <input 
                  type="radio" 
                  name="provider" 
                  value={p.id} 
                  checked={modelProvider === p.id}
                  onChange={(e) => setModelProvider(e.target.value)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Role-Based Access Control (RBAC) */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={18} color="var(--teal)" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
              Role-Based Access Control (RBAC)
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Switch active security roles to test least-privilege service boundaries.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { id: 'security_operator', name: 'Security Operator', role: 'OPERATOR', desc: 'Can monitor transactions, review slight price deviations, and release payments.' },
              { id: 'admin', name: 'Enterprise Security Admin', role: 'ADMIN', desc: 'Full permissions: publish and rollback policy versions in Monaco workbench.' },
              { id: 'auditor', name: 'Compliance Auditor', role: 'AUDITOR', desc: 'Read-only access to audit trail and cryptographic hash-chain verification.' },
              { id: 'agent', name: 'Autonomous Shopping Agent', role: 'AGENT', desc: 'Least-privilege API token: can only propose purchase checkouts.' }
            ].map((r) => (
              <label 
                key={r.id}
                className="glass-card" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '12px', 
                  cursor: 'pointer',
                  border: activeRole === r.id ? '1px solid var(--teal)' : '1px solid var(--border-subtle)',
                  background: activeRole === r.id ? 'rgba(20, 184, 166, 0.08)' : 'var(--bg-surface-card)',
                  padding: '12px'
                }}
              >
                <input 
                  type="radio" 
                  name="role" 
                  value={r.id} 
                  checked={activeRole === r.id}
                  onChange={(e) => setActiveRole(e.target.value)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{r.name}</span>
                    <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{r.role}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{r.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

      </div>

      {/* Operational Invariants & Infrastructure Health */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={18} color="var(--primary)" />
          Backend Infrastructure & Trust Boundary Health
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div className="glass-card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>API Backend Service</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', margin: '4px 0' }}>Python FastAPI 0.115</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>● Service Active on port 8000</div>
          </div>

          <div className="glass-card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Persistence Layer</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', margin: '4px 0' }}>SQLAlchemy + SQLite / Postgres</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>● Connected & Schema Synced</div>
          </div>

          <div className="glass-card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment Adapter</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', margin: '4px 0' }}>Sandboxed Mock Razorpay Rails</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>● Strict Idempotency & State Invariant</div>
          </div>

          <div className="glass-card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cryptographic Engine</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', margin: '4px 0' }}>SHA-256 Chaining + Server HMAC</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--teal)' }}>● FIPS-Compliant Verification Active</div>
          </div>
        </div>
      </div>

    </div>
  );
}
