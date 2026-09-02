import React, { useState } from 'react';
import { 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  Fingerprint,
  Sparkles
} from 'lucide-react';
import ThreeGateway from '../components/ThreeGateway';
import DecisionBadge from '../components/DecisionBadge';
import { api } from '../api/client';

export default function JourneyVisualizer() {
  const [prompt, setPrompt] = useState("Buy a gaming laptop under ₹80,000, min 16GB RAM, trusted seller only");
  const [activeStep, setActiveStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedIntent, setExtractedIntent] = useState(null);
  const [contract, setContract] = useState(null);
  const [agentProposal, setAgentProposal] = useState(null);
  const [decisionResult, setDecisionResult] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [presetKey, setPresetKey] = useState('drift');

  const presets = {
    drift: {
      title: "Master Scenario (Critical Drift)",
      prompt: "Buy a gaming laptop under ₹80,000, min 16GB RAM, trusted seller only",
      proposal: {
        product_name: "Unbranded Gaming Laptop X",
        category: "laptop",
        merchant_name: "ShadowStore FastTech",
        seller_id: "seller_unverified_404",
        seller_trust_level: "unverified",
        price: 89999.0,
        currency: "INR",
        quantity: 1,
        ram_gb: 8
      }
    },
    slight_drift: {
      title: "Slight Budget Drift (Customer Confirmation)",
      prompt: "Buy a gaming laptop under ₹80,000, min 16GB RAM, trusted seller",
      proposal: {
        product_name: "Lenovo Legion 5 Gaming Laptop",
        category: "gaming laptop",
        merchant_name: "Lenovo Official Retailer",
        seller_id: "seller_lenovo_official",
        seller_trust_level: "trusted",
        price: 84999.0,
        currency: "INR",
        quantity: 1,
        ram_gb: 16
      }
    },
    perfect: {
      title: "Perfect Match (Immediate Capture)",
      prompt: "Buy a gaming laptop under ₹80,000, min 16GB RAM, trusted seller",
      proposal: {
        product_name: "ASUS TUF A15 Gaming Laptop",
        category: "gaming laptop",
        merchant_name: "ASUS Official Store",
        seller_id: "seller_asus_verified",
        seller_trust_level: "verified",
        price: 75000.0,
        currency: "INR",
        quantity: 1,
        ram_gb: 16
      }
    }
  };

  const handleApplyPreset = (key) => {
    setPresetKey(key);
    setPrompt(presets[key].prompt);
    setActiveStep(1);
    setExtractedIntent(null);
    setContract(null);
    setAgentProposal(null);
    setDecisionResult(null);
    setPaymentResult(null);
  };

  const runFullJourney = async () => {
    setIsLoading(true);
    setActiveStep(1);

    try {
      // Step 1 & 2: Extract Intent & Commit Contract
      setActiveStep(2);
      const intent = await api.extractIntent(prompt);
      setExtractedIntent(intent);

      const savedContract = await api.confirmContract(prompt, intent, 120);
      setContract(savedContract);

      // Step 3 & 4: Agent Selection
      await new Promise(r => setTimeout(r, 600));
      setActiveStep(4);
      const prop = presets[presetKey].proposal;
      setAgentProposal(prop);

      // Step 5: Policy Evaluation
      await new Promise(r => setTimeout(r, 700));
      setActiveStep(5);
      const decision = await api.submitTransaction({
        contract_id: savedContract.id,
        idempotency_key: `journey_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        agent_id: "agent-eval-01",
        merchant_name: prop.merchant_name,
        seller_id: prop.seller_id,
        seller_trust_level: prop.seller_trust_level,
        product_name: prop.product_name,
        category: prop.category,
        price: prop.price,
        currency: prop.currency,
        quantity: prop.quantity,
        ram_gb: prop.ram_gb
      });
      setDecisionResult(decision);

      // Step 6 / 7: Payment result or confirmation requirement
      if (decision.decision === 'APPROVE') {
        setActiveStep(7);
        setPaymentResult({
          status: 'PAYMENT_SUCCESS',
          payment_reference: decision.payment_reference,
          mode: 'SANDBOX'
        });
      } else if (decision.decision === 'REQUIRE_CONFIRMATION') {
        setActiveStep(6);
      } else {
        setActiveStep(7);
      }
    } catch (e) {
      alert(`Journey error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualConfirmation = async () => {
    if (!decisionResult || !decisionResult.confirmation_token) return;
    try {
      setIsLoading(true);
      const res = await api.confirmTransaction(
        decisionResult.transaction_id,
        decisionResult.confirmation_token,
        "Customer confirmed revised terms in Journey Visualizer."
      );
      setDecisionResult(res);
      setPaymentResult({
        status: 'PAYMENT_SUCCESS',
        payment_reference: res.payment_reference,
        mode: 'SANDBOX'
      });
      setActiveStep(7);
    } catch (e) {
      alert(`Confirmation failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Top Banner & Preset Selector */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--primary)" />
            Agent Journey Visualizer
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Follow an autonomous shopping agent step-by-step from customer prompt to intent extraction, discovery, policy evaluation, and payment capture.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {Object.keys(presets).map((key) => (
            <button
              key={key}
              className={`btn ${presetKey === key ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              onClick={() => handleApplyPreset(key)}
            >
              {presets[key].title}
            </button>
          ))}
          <button 
            className="btn btn-primary" 
            onClick={runFullJourney} 
            disabled={isLoading}
            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
          >
            {isLoading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
            Run Live Journey
          </button>
        </div>
      </div>

      {/* Main Layout: 7-Stage Timeline on Left, Real-Time 3D Gateway & Decision Summary on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* Left: 7-Step Interactive Flow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Step 1: Customer Instruction */}
          <div className="glass-card" style={{ borderLeft: `3px solid ${activeStep >= 1 ? 'var(--primary)' : 'var(--border-subtle)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Stage 1: Customer Shopping Request
              </span>
              <span className="badge badge-neutral">Stage 1 / 7</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                resize: 'none'
              }}
            />
          </div>

          {/* Step 2: Structured Intent Contract */}
          <div className="glass-card" style={{ borderLeft: `3px solid ${activeStep >= 2 ? 'var(--teal)' : 'var(--border-subtle)'}`, opacity: activeStep >= 2 ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Stage 2: Structured Intent Contract (Cryptographically Sealed)
              </span>
              {contract && <span className="badge badge-approved">ACTIVE CONTRACT</span>}
            </div>
            {extractedIntent ? (
              <div className="code-block" style={{ fontSize: '0.75rem', maxHeight: '120px' }}>
                <div>"category": "{extractedIntent.category}",</div>
                <div>"max_price": ₹{extractedIntent.max_price?.toLocaleString()},</div>
                <div>"ram_min": {extractedIntent.ram_min} GB,</div>
                <div>"seller_requirement": "{extractedIntent.seller_requirement}",</div>
                <div>"hash_fingerprint": "{contract?.hash_fingerprint?.substring(0, 24)}..."</div>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Awaiting intent extraction and contract sealing...
              </div>
            )}
          </div>

          {/* Step 3 & 4: Agent Discovery & Product Selection */}
          <div className="glass-card" style={{ borderLeft: `3px solid ${activeStep >= 4 ? 'var(--warning)' : 'var(--border-subtle)'}`, opacity: activeStep >= 4 ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Stage 3 & 4: Autonomous Agent Discovery & Checkout Selection
              </span>
              {agentProposal && <span className="badge badge-review">PROPOSAL SUBMITTED</span>}
            </div>
            {agentProposal ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Product:</span> <strong>{agentProposal.product_name}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Price:</span> <strong style={{ color: agentProposal.price > 80000 ? 'var(--danger)' : 'var(--success)' }}>₹{agentProposal.price?.toLocaleString()}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Hardware RAM:</span> <strong style={{ color: agentProposal.ram_gb < 16 ? 'var(--danger)' : '#fff' }}>{agentProposal.ram_gb} GB</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Seller:</span> <strong style={{ color: agentProposal.seller_trust_level === 'unverified' ? 'var(--danger)' : 'var(--success)' }}>{agentProposal.merchant_name} ({agentProposal.seller_trust_level})</strong></div>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Shopping agent is evaluating marketplace listings...
              </div>
            )}
          </div>

          {/* Step 5: Deterministic Policy Evaluation */}
          <div className="glass-card" style={{ borderLeft: `3px solid ${activeStep >= 5 ? (decisionResult?.decision === 'APPROVE' ? 'var(--success)' : decisionResult?.decision === 'BLOCK' ? 'var(--danger)' : 'var(--warning)') : 'var(--border-subtle)'}`, opacity: activeStep >= 5 ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Stage 5: Deterministic Policy Engine Evaluation
              </span>
              {decisionResult && <DecisionBadge decision={decisionResult.decision} />}
            </div>
            {decisionResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {decisionResult.ai_explanation}
                </p>
                {decisionResult.violations?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {decisionResult.violations.map((v, idx) => (
                      <span key={idx} className="badge badge-blocked" style={{ fontSize: '0.65rem' }}>
                        {v.code}: {v.field} mismatch
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Policy Engine standing by to enforce fail-closed constraints...
              </div>
            )}
          </div>

          {/* Step 6: Human Confirmation if Needed */}
          {activeStep === 6 && decisionResult?.decision === 'REQUIRE_CONFIRMATION' && (
            <div className="glass-card" style={{ borderLeft: '3px solid var(--warning)', background: 'var(--warning-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--warning)' }}>
                  Stage 6: Customer Authorization Required
                </span>
                <span className="badge badge-review">ACTION NEEDED</span>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', marginBottom: '12px' }}>
                Agent found laptop at ₹84,999 (6.2% over ₹80,000 budget). Specifications and seller trust are verified. Do you authorize this purchase?
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-success" onClick={handleManualConfirmation} disabled={isLoading}>
                  <CheckCircle2 size={14} /> Authorize Revised Purchase
                </button>
                <button className="btn btn-outline" onClick={() => setActiveStep(7)}>
                  Reject Purchase
                </button>
              </div>
            </div>
          )}

          {/* Step 7: Payment Adapter Result */}
          <div className="glass-card" style={{ borderLeft: `3px solid ${activeStep >= 7 ? (paymentResult ? 'var(--success)' : 'var(--danger)') : 'var(--border-subtle)'}`, opacity: activeStep >= 7 ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: paymentResult ? 'var(--success)' : 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Stage 7: Sandboxed Payment Adapter Execution
              </span>
              <span className={`badge ${paymentResult ? 'badge-approved' : 'badge-blocked'}`}>
                {paymentResult ? 'PAYMENT CAPTURED' : 'EXECUTION HALTED'}
              </span>
            </div>
            {paymentResult ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div>Payment Reference: <strong style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>{paymentResult.payment_reference}</strong></div>
                <div>Execution Mode: <strong>SANDBOX (No real money moved)</strong></div>
                <div style={{ color: 'var(--success)', marginTop: '4px' }}>Contract marked CONSUMED. Replay attacks permanently prevented.</div>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {activeStep >= 7 ? "Payment execution blocked by policy engine. Zero financial exposure." : "Awaiting final decision before invoking adapter..."}
              </div>
            )}
          </div>

        </div>

        {/* Right: Embedded 3D Gateway & Real-Time Decision State */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
              Live Security Gateway State
            </h3>
            <ThreeGateway 
              decision={decisionResult ? decisionResult.decision : 'APPROVE'} 
              height="300px" 
            />
            <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div>Current Step: <strong>Stage {activeStep} of 7</strong></div>
              <div>Decision: <strong style={{ color: decisionResult?.decision === 'APPROVE' ? 'var(--success)' : decisionResult?.decision === 'BLOCK' ? 'var(--danger)' : 'var(--warning)' }}>{decisionResult?.decision || 'ANALYZING'}</strong></div>
              <div>Risk Score: <strong>{decisionResult?.risk_score ?? '--'} / 100</strong></div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Fingerprint size={16} color="var(--primary)" />
              Security Invariant Checklist
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              <div>• LLM strictly separated from payment authority: <strong style={{ color: 'var(--success)' }}>TRUE</strong></div>
              <div>• Deterministic math overrides prompt injection: <strong style={{ color: 'var(--success)' }}>TRUE</strong></div>
              <div>• Contract sealed with canonical SHA-256: <strong style={{ color: 'var(--success)' }}>TRUE</strong></div>
              <div>• Payment adapter fails closed on unauthorized state: <strong style={{ color: 'var(--success)' }}>TRUE</strong></div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
