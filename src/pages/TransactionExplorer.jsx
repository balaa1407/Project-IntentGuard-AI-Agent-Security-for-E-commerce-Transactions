import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Eye, 
  CheckCircle2, 
  AlertOctagon, 
  X, 
  Shield,
  Layers
} from 'lucide-react';
import DecisionBadge from '../components/DecisionBadge';
import { api } from '../api/client';

export default function TransactionExplorer() {
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const data = await api.listTransactions(decisionFilter ? { decision_filter: decisionFilter } : {});
      setTransactions(data);
    } catch (e) {
      console.warn("Failed to fetch transactions:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [decisionFilter]);

  const handleInspect = async (tx) => {
    setSelectedTx(tx);
    setActionNotice('');
    try {
      const contract = await api.getContract(tx.contract_id);
      setSelectedContract(contract);
    } catch (e) {
      // Fallback contract data
      setSelectedContract({
        id: tx.contract_id,
        category: "gaming laptop",
        max_price: 80000.0,
        currency: "INR",
        ram_min: 16,
        seller_requirement: "trusted",
        max_quantity: 1,
        natural_language_prompt: "Buy a gaming laptop under ₹80k, min 16GB RAM, trusted seller"
      });
    }
  };

  const handleConfirmPurchase = async () => {
    if (!selectedTx || !selectedTx.confirmation_token) return;
    setIsConfirming(true);
    try {
      const res = await api.confirmTransaction(
        selectedTx.transaction_id,
        selectedTx.confirmation_token,
        "Customer explicitly approved revised price deviation."
      );
      setSelectedTx(res);
      setActionNotice("Purchase successfully confirmed! Sandbox payment executed.");
      fetchTransactions();
    } catch (e) {
      alert(`Confirmation failed: ${e.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  const filtered = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.transaction_id?.toLowerCase().includes(q) ||
      tx.contract_id?.toLowerCase().includes(q) ||
      tx.decision?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Header & Filter Controls */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Transaction Explorer</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Inspect autonomous agent purchase proposals, compare against authorized contracts, and review rule violations.
            </p>
          </div>

          <button className="btn btn-outline" onClick={fetchTransactions} style={{ fontSize: '0.8rem' }}>
            Refresh Transactions
          </button>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              type="text"
              placeholder="Search by transaction ID, contract ID, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['', 'APPROVE', 'REQUIRE_CONFIRMATION', 'BLOCK'].map((d) => (
              <button
                key={d}
                className={`btn ${decisionFilter === d ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                onClick={() => setDecisionFilter(d)}
              >
                {d || 'ALL DECISIONS'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>TX ID</th>
              <th>TIMESTAMP</th>
              <th>DECISION</th>
              <th>RISK SCORE</th>
              <th>MATCH %</th>
              <th>VIOLATIONS</th>
              <th>EXECUTION STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((tx) => (
                <tr key={tx.transaction_id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary)' }}>
                    {tx.transaction_id.substring(0, 12)}...
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <DecisionBadge decision={tx.decision} />
                  </td>
                  <td>
                    <span style={{ 
                      fontWeight: 700, 
                      color: tx.risk_score > 60 ? 'var(--danger)' : tx.risk_score > 20 ? 'var(--warning)' : 'var(--success)' 
                    }}>
                      {tx.risk_score} / 100
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{tx.intent_match_pct}%</span>
                  </td>
                  <td>
                    {tx.violations && tx.violations.length > 0 ? (
                      <span style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>
                        {tx.violations.length} Violated
                      </span>
                    ) : (
                      <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>0 (Clean)</span>
                    )}
                  </td>
                  <td>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '3px 8px', 
                      borderRadius: '4px',
                      background: tx.status === 'PAYMENT_SUCCESS' ? 'var(--success-bg)' : tx.status === 'BLOCKED' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                      color: tx.status === 'PAYMENT_SUCCESS' ? 'var(--success)' : tx.status === 'BLOCKED' ? 'var(--danger)' : 'var(--warning)',
                      fontWeight: 600
                    }}>
                      {tx.status}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-outline" 
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      onClick={() => handleInspect(tx)}
                    >
                      <Eye size={13} /> Inspect
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                  {isLoading ? "Loading transactions..." : "No matching transactions found. Run an adversarial simulation or submit a test purchase."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Inspector Modal / Overlay */}
      {selectedTx && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '24px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', position: 'relative' }}>
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedTx(null)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            {/* Modal Title & Decision */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Transaction Security Inspector</h3>
                  <DecisionBadge decision={selectedTx.decision} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  ID: {selectedTx.transaction_id}
                </div>
              </div>
            </div>

            {actionNotice && (
              <div style={{ padding: '12px', background: 'var(--success-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', borderRadius: '8px', marginBottom: '20px', fontWeight: 600 }}>
                {actionNotice}
              </div>
            )}

            {/* Side-by-Side Comparison: Authorized Contract vs Attempted Proposal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              
              {/* Left Column: Authorized Contract */}
              <div className="glass-card" style={{ borderLeft: '3px solid var(--primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Shield size={16} color="var(--primary)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Authorized Intent Contract
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.825rem' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Instruction:</span> <span style={{ color: '#fff' }}>"{selectedContract?.natural_language_prompt || 'Gaming laptop under 80k'}"</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Category:</span> <strong style={{ color: '#fff' }}>{selectedContract?.category || 'gaming laptop'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Maximum Price:</span> <strong style={{ color: 'var(--primary)' }}>₹{selectedContract?.max_price?.toLocaleString() || '80,000'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Hardware Spec (RAM):</span> <strong style={{ color: '#fff' }}>&gt;= {selectedContract?.ram_min || 16} GB</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Seller Requirement:</span> <strong style={{ color: '#fff' }}>{selectedContract?.seller_requirement || 'trusted'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Max Quantity:</span> <span style={{ color: '#fff' }}>{selectedContract?.max_quantity || 1} unit</span></div>
                </div>
              </div>

              {/* Right Column: Attempted Purchase */}
              <div className="glass-card" style={{ borderLeft: `3px solid ${selectedTx.decision === 'APPROVE' ? 'var(--success)' : selectedTx.decision === 'BLOCK' ? 'var(--danger)' : 'var(--warning)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Layers size={16} color={selectedTx.decision === 'APPROVE' ? 'var(--success)' : 'var(--danger)'} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Agent Proposed Purchase
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.825rem' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Product:</span> <strong style={{ color: '#fff' }}>{selectedTx.violations?.some(v => v.code === 'PRODUCT_REQUIREMENTS_VIOLATED') ? 'Drifted Item' : 'ASUS TUF / Lenovo'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Evaluated Status:</span> <strong style={{ color: '#fff' }}>{selectedTx.status}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Risk Assessment:</span> <strong style={{ color: selectedTx.risk_score > 60 ? 'var(--danger)' : 'var(--success)' }}>{selectedTx.risk_score} / 100 ({selectedTx.intent_match_pct}% Match)</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Payment Reference:</span> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)' }}>{selectedTx.payment_reference || 'NONE (Execution Halted)'}</span></div>
                </div>
              </div>

            </div>

            {/* Violated Rules Breakdown */}
            {selectedTx.violations && selectedTx.violations.length > 0 ? (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertOctagon size={16} /> Violated Policy Invariants ({selectedTx.violations.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedTx.violations.map((v, i) => (
                    <div key={i} style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', fontSize: '0.825rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)' }}>
                          {v.code}
                        </span>
                        <span className="badge badge-blocked" style={{ fontSize: '0.65rem' }}>{v.severity}</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{v.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '14px', background: 'var(--success-bg)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                  Zero policy violations. All budget, spec, and seller trust constraints satisfied.
                </span>
              </div>
            )}

            {/* AI Explainability Box */}
            <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.75px', marginBottom: '6px' }}>
                Explainable Discrepancy Evidence
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
                {selectedTx.ai_explanation || "No explanation provided."}
              </p>
            </div>

            {/* Customer Review & Confirmation Action */}
            {selectedTx.status === 'REQUIRE_CONFIRMATION' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--warning-bg)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px' }}>
                <div>
                  <h5 style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '0.9rem' }}>Human Approval Required</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Slight deviation detected. Authorize purchase to release sandboxed payment execution.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-success" 
                    onClick={handleConfirmPurchase}
                    disabled={isConfirming}
                  >
                    <CheckCircle2 size={15} />
                    {isConfirming ? "Executing..." : "Authorize Revised Purchase"}
                  </button>
                  <button className="btn btn-outline" onClick={() => setSelectedTx(null)}>
                    Decline
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
