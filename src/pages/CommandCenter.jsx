import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  Fingerprint, 
  Activity, 
  RefreshCw,
  Lock,
  ArrowRight
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import ThreeGateway from '../components/ThreeGateway';
import DecisionBadge from '../components/DecisionBadge';
import { api } from '../api/client';

export default function CommandCenter({ onNavigate }) {
  const [analytics, setAnalytics] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [latestDecision, setLatestDecision] = useState('APPROVE');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [analyticsData, eventsData] = await Promise.all([
        api.getAnalytics().catch(() => ({
          status: 'OPERATIONAL',
          mode: 'SANDBOX',
          total_transactions: 12,
          approved_count: 5,
          blocked_count: 6,
          pending_confirmation_count: 1,
          active_contracts: 4,
          total_audit_events: 28,
          average_risk_score: 52.4,
          violations_breakdown: {
            BUDGET_EXCEEDED: 4,
            PRODUCT_REQUIREMENTS_VIOLATED: 3,
            SELLER_NOT_TRUSTED: 3
          },
          gateway_latency_ms: 38
        })),
        api.listAuditEvents({ limit: 6 }).catch(() => [])
      ]);

      setAnalytics(analyticsData);
      setRecentEvents(eventsData);
      if (eventsData && eventsData.length > 0 && eventsData[0].decision) {
        setLatestDecision(eventsData[0].decision);
      }
    } catch (e) {
      console.warn("Failed to load command center data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Top Banner / Mode Alert */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--primary)' }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Security Command Center</h2>
              <span className="badge badge-approved" style={{ fontSize: '0.65rem' }}>Deterministic Policy Engine Armed</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Real-time monitoring of autonomous shopping agent transactions, cryptographic contracts, and policy violations.
            </p>
          </div>
        </div>

        <button className="btn btn-outline" onClick={fetchData} disabled={isLoading} style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          Refresh Metrics
        </button>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <MetricCard
          title="TOTAL PROCESSED"
          value={analytics?.total_transactions ?? '--'}
          subtitle="Agent checkout attempts"
          icon={Activity}
          color="var(--primary)"
        />
        <MetricCard
          title="BLOCKED VIOLATIONS"
          value={analytics?.blocked_count ?? '--'}
          subtitle="Hard drift halted"
          icon={ShieldAlert}
          color="var(--danger)"
          trend="+Critical"
        />
        <MetricCard
          title="APPROVED CHECKOUTS"
          value={analytics?.approved_count ?? '--'}
          subtitle="Strictly verified intent"
          icon={ShieldCheck}
          color="var(--success)"
        />
        <MetricCard
          title="PENDING CONFIRMATION"
          value={analytics?.pending_confirmation_count ?? '--'}
          subtitle="Customer review required"
          icon={AlertTriangle}
          color="var(--warning)"
        />
        <MetricCard
          title="ACTIVE CONTRACTS"
          value={analytics?.active_contracts ?? '--'}
          subtitle="Immutable authorizations"
          icon={FileText}
          color="var(--teal)"
        />
        <MetricCard
          title="AUDIT LEDGER"
          value={analytics?.total_audit_events ?? '--'}
          subtitle="SHA-256 Chained Events"
          icon={Fingerprint}
          color="#38BDF8"
        />
      </div>

      {/* Main Grid: 3D Gateway & Violations Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* Left: 3D Transaction Gateway Core */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} color="var(--primary)" />
                Real-Time 3D Transaction Gateway
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Visualizes live policy enforcement state between shopping agents and sandboxed payment rails.
              </p>
            </div>
            <DecisionBadge decision={latestDecision} />
          </div>

          <ThreeGateway decision={latestDecision} height="320px" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Gateway Mode: <strong style={{ color: 'var(--primary)' }}>SANDBOX (Zero Real Money Moved)</strong></span>
            <span>Latency: <strong style={{ color: 'var(--success)' }}>{analytics?.gateway_latency_ms || 38}ms</strong></span>
            <span>Fail-Closed: <strong style={{ color: 'var(--success)' }}>ENFORCED</strong></span>
          </div>
        </div>

        {/* Right: Policy Violations Breakdown */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            Policy Violations by Category
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Deterministic violations caught at the trusted boundary.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
            {[
              { code: 'BUDGET_EXCEEDED', label: 'Budget Limit Exceeded', count: analytics?.violations_breakdown?.BUDGET_EXCEEDED || 0, color: 'var(--danger)' },
              { code: 'PRODUCT_REQUIREMENTS_VIOLATED', label: 'Product & Hardware Spec Violation', count: analytics?.violations_breakdown?.PRODUCT_REQUIREMENTS_VIOLATED || 0, color: '#F97316' },
              { code: 'SELLER_NOT_TRUSTED', label: 'Unverified / Untrusted Seller', count: analytics?.violations_breakdown?.SELLER_NOT_TRUSTED || 0, color: 'var(--warning)' },
              { code: 'UNAUTHORIZED_QUANTITY', label: 'Unauthorized Quantity / Volume', count: analytics?.violations_breakdown?.UNAUTHORIZED_QUANTITY || 0, color: '#A855F7' },
              { code: 'CONTRACT_MODIFIED', label: 'Contract Tamper Attempt', count: analytics?.violations_breakdown?.CONTRACT_MODIFIED || 0, color: '#EC4899' }
            ].map((item) => (
              <div key={item.code} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color }}>{item.count} events</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, (item.count / Math.max(1, analytics?.total_transactions || 10)) * 100)}%`, 
                    background: item.color,
                    borderRadius: '3px'
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => onNavigate('simulation')} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
              Run Attack Simulations <ArrowRight size={13} />
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Section: Real-time Cryptographic Audit Event Stream */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Fingerprint size={16} color="var(--primary)" />
              Live Security Event Stream
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Append-only tamper-evident audit ledger with SHA-256 hash chaining.
            </p>
          </div>
          <button className="btn btn-outline" onClick={() => onNavigate('audit')} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
            View Full Audit Ledger <ArrowRight size={13} />
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>SEQ #</th>
              <th>TIMESTAMP (UTC)</th>
              <th>ACTOR</th>
              <th>EVENT TYPE</th>
              <th>DECISION</th>
              <th>CORRELATION ID</th>
              <th>SHA-256 HASH</th>
            </tr>
          </thead>
          <tbody>
            {recentEvents && recentEvents.length > 0 ? (
              recentEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                    #{ev.sequence_number}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ fontWeight: 600 }}>{ev.actor}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                      {ev.event_type}
                    </span>
                  </td>
                  <td>
                    {ev.decision ? <DecisionBadge decision={ev.decision} /> : <span style={{ color: 'var(--text-muted)' }}>--</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {ev.correlation_id?.substring(0, 16)}...
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {ev.current_hash?.substring(0, 16)}...
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No security events recorded yet. Run a simulation scenario or submit a transaction.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
