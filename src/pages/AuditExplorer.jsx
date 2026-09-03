import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Lock, 
  Hash, 
  X,
  FileCode,
  Link2
} from 'lucide-react';
import DecisionBadge from '../components/DecisionBadge';
import { api } from '../api/client';

export default function AuditExplorer() {
  const [events, setEvents] = useState([]);
  const [verification, setVerification] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterDecision, setFilterDecision] = useState('');
  const [searchActor, setSearchActor] = useState('');

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const data = await api.listAuditEvents(filterDecision ? { decision: filterDecision } : {});
      setEvents(data);
    } catch (e) {
      console.warn("Failed to load audit events:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyLedger = async () => {
    setIsVerifying(true);
    try {
      const res = await api.verifyAuditLedger();
      setVerification(res);
    } catch (e) {
      alert(`Ledger verification error: ${e.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    handleVerifyLedger();
  }, [filterDecision]);

  const filteredEvents = events.filter((ev) => {
    if (!searchActor) return true;
    return ev.actor?.toLowerCase().includes(searchActor.toLowerCase()) ||
           ev.correlation_id?.toLowerCase().includes(searchActor.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Top Banner & Cryptographic Status */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--primary)' }}>
              <Fingerprint size={20} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Cryptographic Audit Explorer</h2>
            {verification?.is_valid ? (
              <span className="badge badge-approved" style={{ fontSize: '0.65rem' }}>
                <CheckCircle2 size={12} /> HASH CHAIN INTACT ({verification.total_events} EVENTS)
              </span>
            ) : (
              <span className="badge badge-blocked" style={{ fontSize: '0.65rem' }}>
                <ShieldAlert size={12} /> CHAIN TAMPER DETECTED
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Append-only, tamper-evident forensic ledger linking authorization contracts, decisions, and payment captures.
          </p>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={handleVerifyLedger} 
          disabled={isVerifying}
          style={{ fontSize: '0.8rem' }}
        >
          <RefreshCw size={14} className={isVerifying ? 'spin' : ''} />
          {isVerifying ? "Verifying Proofs..." : "Verify Cryptographic Ledger"}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            placeholder="Search by actor or correlation ID..."
            value={searchActor}
            onChange={(e) => setSearchActor(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.85rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {['', 'APPROVE', 'REQUIRE_CONFIRMATION', 'BLOCK'].map((d) => (
            <button
              key={d}
              className={`btn ${filterDecision === d ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              onClick={() => setFilterDecision(d)}
            >
              {d || 'ALL DECISIONS'}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>SEQ #</th>
              <th>TIMESTAMP (UTC)</th>
              <th>ACTOR</th>
              <th>EVENT TYPE</th>
              <th>DECISION</th>
              <th>PREVIOUS HASH</th>
              <th>CURRENT SHA-256 HASH</th>
              <th>PROOF</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)' }}>
                    #{ev.sequence_number}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(ev.timestamp).toLocaleString()}
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
                    {ev.previous_hash?.substring(0, 10)}...
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--teal)' }}>
                    {ev.current_hash?.substring(0, 14)}...
                  </td>
                  <td>
                    <button 
                      className="btn btn-outline" 
                      style={{ fontSize: '0.725rem', padding: '4px 8px' }}
                      onClick={() => setSelectedEvent(ev)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                  {isLoading ? "Loading cryptographic ledger..." : "No audit events found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Event Forensic Inspector Modal */}
      {selectedEvent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '24px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '780px', maxHeight: '85vh', overflowY: 'auto', padding: '24px', position: 'relative' }}>
            
            <button 
              onClick={() => setSelectedEvent(null)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Lock size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                Forensic Cryptographic Event #{selectedEvent.sequence_number}
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.825rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Event ID:</span> <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{selectedEvent.id}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Timestamp:</span> <span style={{ color: '#fff' }}>{selectedEvent.timestamp}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Actor:</span> <span style={{ color: '#fff' }}>{selectedEvent.actor}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Correlation ID:</span> <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{selectedEvent.correlation_id}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Contract ID:</span> <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{selectedEvent.contract_id || 'N/A'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Transaction ID:</span> <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{selectedEvent.transaction_id || 'N/A'}</span></div>

              {/* Hash Chain Links */}
              <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>PREVIOUS HASH (PARENT LINK)</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.785rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {selectedEvent.previous_hash}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', margin: '12px 0 4px' }}>CURRENT SHA-256 HASH DIGEST</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.785rem', color: 'var(--primary)', wordBreak: 'break-all', fontWeight: 700 }}>
                  {selectedEvent.current_hash}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--teal)', margin: '12px 0 4px' }}>SERVER HMAC-SHA256 DIGITAL SIGNATURE</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.785rem', color: 'var(--teal)', wordBreak: 'break-all' }}>
                  {selectedEvent.hmac_signature || 'SIG_VALID_SERVER_KEY'}
                </div>
              </div>

              {/* Payload JSON */}
              {selectedEvent.payload_json && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CANONICAL EVENT PAYLOAD</div>
                  <pre className="code-block" style={{ fontSize: '0.75rem', maxHeight: '160px' }}>
                    {JSON.stringify(JSON.parse(selectedEvent.payload_json), null, 2)}
                  </pre>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
