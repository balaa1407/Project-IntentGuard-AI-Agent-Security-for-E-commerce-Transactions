import React, { useState, useEffect } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { 
  Play, 
  GitCompare, 
  FileText, 
  UploadCloud,
  FileCode
} from 'lucide-react';
import DecisionBadge from '../components/DecisionBadge';
import { api } from '../api/client';

const POLICY_TEMPLATES = {
  standard: `# IntentGuard Enterprise Policy Definition (v1.2.0)
version: "1.2.0"
name: "Standard E-Commerce Guardrails"
description: "Standard policy with 10% drift tolerance, hardware RAM matching, and verified seller trust."

rules:
  # Up to 10% price drift is held for human confirmation; beyond 10% is hard blocked
  max_price_tolerance_pct: 0.10
  
  # Strictly enforces RAM and hardware constraint matching
  strict_spec_match: true
  
  # Enforces verified/trusted seller status
  strict_seller_verification: true
  
  # Enforces single-purchase contract lifecycle
  enforce_single_use: true
  
  # Allowed transaction currencies
  allowed_currencies:
    - "INR"
    - "USD"
`,
  strict_zero_drift: `# IntentGuard Enterprise Policy Definition (v2.0.0-Strict)
version: "2.0.0-strict"
name: "Zero Tolerance Financial Defense"
description: "Zero budget drift allowed. Any price above max_price is immediately BLOCKED without human confirmation."

rules:
  # Zero tolerance: 0% drift
  max_price_tolerance_pct: 0.00
  strict_spec_match: true
  strict_seller_verification: true
  enforce_single_use: true
  allowed_currencies:
    - "INR"
`,
  high_value_luxury: `# IntentGuard Enterprise Policy Definition (v1.3.0-Luxury)
version: "1.3.0-luxury"
name: "High-Value Consumer Electronics"
description: "Specialized policy allowing up to 15% price drift for premium items with customer review."

rules:
  max_price_tolerance_pct: 0.15
  strict_spec_match: true
  strict_seller_verification: true
  enforce_single_use: true
  allowed_currencies:
    - "INR"
    - "USD"
    - "EUR"
`
};

export default function PolicyWorkbench() {
  const [activeTab, setActiveTab] = useState('test'); // 'test', 'diff', 'docs'
  const [activePolicy, setActivePolicy] = useState(null);
  const [policyCode, setPolicyCode] = useState(POLICY_TEMPLATES.standard);
  const [policyVersion, setPolicyVersion] = useState("1.2.0");
  const [policyName, setPolicyName] = useState("Standard E-Commerce Guardrails");
  const [activePublishedCode, setActivePublishedCode] = useState(POLICY_TEMPLATES.standard);

  const [selectedFixture, setSelectedFixture] = useState('gaming_laptop_drift');
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Sample test fixtures
  const fixtures = {
    gaming_laptop_drift: {
      name: "Fixture 1: Core Gaming Laptop Drift (₹80k Auth vs ₹89,999 8GB Unverified)",
      contract: {
        category: "gaming laptop",
        max_price: 80000.0,
        currency: "INR",
        ram_min: 16,
        seller_requirement: "trusted",
        max_quantity: 1
      },
      transaction: {
        contract_id: "test-contract-01",
        idempotency_key: "fixture-drift-01",
        agent_id: "agent-01",
        merchant_name: "ShadowStore FastTech",
        seller_id: "seller_unverified_404",
        seller_trust_level: "unverified",
        product_name: "Unbranded Gaming Laptop X",
        category: "laptop",
        price: 89999.0,
        currency: "INR",
        quantity: 1,
        ram_gb: 8
      }
    },
    slight_drift: {
      name: "Fixture 2: Slight Price Drift (₹80k Auth vs ₹84,999 16GB Trusted)",
      contract: {
        category: "gaming laptop",
        max_price: 80000.0,
        currency: "INR",
        ram_min: 16,
        seller_requirement: "trusted",
        max_quantity: 1
      },
      transaction: {
        contract_id: "test-contract-02",
        idempotency_key: "fixture-slight-02",
        agent_id: "agent-01",
        merchant_name: "Lenovo Official Retailer",
        seller_id: "seller_lenovo_official",
        seller_trust_level: "trusted",
        product_name: "Lenovo Legion 5",
        category: "gaming laptop",
        price: 84999.0,
        currency: "INR",
        quantity: 1,
        ram_gb: 16
      }
    },
    perfect_match: {
      name: "Fixture 3: Compliant Checkout (₹80k Auth vs ₹75,000 16GB Verified)",
      contract: {
        category: "gaming laptop",
        max_price: 80000.0,
        currency: "INR",
        ram_min: 16,
        seller_requirement: "trusted",
        max_quantity: 1
      },
      transaction: {
        contract_id: "test-contract-03",
        idempotency_key: "fixture-perfect-03",
        agent_id: "agent-01",
        merchant_name: "ASUS Official Store",
        seller_id: "seller_asus_verified",
        seller_trust_level: "verified",
        product_name: "ASUS TUF A15",
        category: "gaming laptop",
        price: 75000.0,
        currency: "INR",
        quantity: 1,
        ram_gb: 16
      }
    }
  };

  useEffect(() => {
    api.getActivePolicy().then((data) => {
      setActivePolicy(data);
      if (data && data.content_yaml) {
        setPolicyCode(data.content_yaml);
        setActivePublishedCode(data.content_yaml);
        setPolicyVersion(data.version);
        setPolicyName(data.name);
      }
    }).catch(() => {
      // Offline fallback
    });
  }, []);

  const handleTestPolicy = async () => {
    setIsTesting(true);
    setTestResult(null);
    setStatusMessage('');
    const fixture = fixtures[selectedFixture];

    try {
      const res = await api.testPolicy({
        policy_yaml: policyCode,
        sample_contract: fixture.contract,
        sample_transaction: fixture.transaction
      });
      setTestResult(res);
    } catch (e) {
      setTestResult({
        is_valid_syntax: false,
        error_message: e.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePublishPolicy = async () => {
    try {
      const saved = await api.savePolicy({
        name: policyName,
        version: policyVersion,
        content_yaml: policyCode,
        description: "Updated policy published from Monaco Workbench."
      });
      await api.activatePolicy(saved.id);
      setActivePublishedCode(policyCode);
      setStatusMessage(`Policy ${policyVersion} successfully published and activated!`);
    } catch (e) {
      alert(`Publish failed: ${e.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Top Workbench Controls */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCode size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Monaco Policy Workbench</h2>
            <span className="badge badge-approved" style={{ fontSize: '0.65rem' }}>Active: v{policyVersion}</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Declarative security guardrails evaluated deterministically by the transaction policy engine.
          </p>
        </div>

        {/* Template & Action Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            onChange={(e) => {
              const code = POLICY_TEMPLATES[e.target.value];
              if (code) setPolicyCode(code);
            }}
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem'
            }}
          >
            <option value="standard">Template: Standard Guardrails (10%)</option>
            <option value="strict_zero_drift">Template: Zero Tolerance (0%)</option>
            <option value="high_value_luxury">Template: Luxury Electronics (15%)</option>
          </select>

          <button className="btn btn-outline" onClick={handleTestPolicy} disabled={isTesting} style={{ fontSize: '0.8rem' }}>
            <Play size={13} /> {isTesting ? "Testing..." : "Test Sandbox"}
          </button>

          <button className="btn btn-primary" onClick={handlePublishPolicy} style={{ fontSize: '0.8rem' }}>
            <UploadCloud size={14} /> Publish Policy
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: '10px 16px', background: 'var(--success-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: 'var(--success)', fontSize: '0.825rem', fontWeight: 600 }}>
          {statusMessage}
        </div>
      )}

      {/* Split Pane: Monaco Editor on Left, Sandbox Tests / Diff / Docs on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '20px', minHeight: '600px' }}>
        
        {/* Left Pane: Monaco Code Editor */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>policy_rules.yaml</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(YAML Schema-Validated)</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Auto-Formatting Enabled</span>
          </div>

          <div style={{ flex: 1, minHeight: '520px' }}>
            <Editor
              height="100%"
              language="yaml"
              theme="vs-dark"
              value={policyCode}
              onChange={(value) => setPolicyCode(value || '')}
              options={{
                minimap: { enabled: true },
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 }
              }}
            />
          </div>
        </div>

        {/* Right Pane: Split Tabs (Test Runner / Diff View / Schema Docs) */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Tab Selector */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)' }}>
            <button
              className={`nav-tab-btn ${activeTab === 'test' ? 'active' : ''}`}
              onClick={() => setActiveTab('test')}
              style={{ fontSize: '0.775rem' }}
            >
              <Play size={13} /> Sandbox Test Runner
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'diff' ? 'active' : ''}`}
              onClick={() => setActiveTab('diff')}
              style={{ fontSize: '0.775rem' }}
            >
              <GitCompare size={13} /> Version Diff
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'docs' ? 'active' : ''}`}
              onClick={() => setActiveTab('docs')}
              style={{ fontSize: '0.775rem' }}
            >
              <FileText size={13} /> Schema Reference
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
            
            {/* Tab 1: Test Runner */}
            {activeTab === 'test' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Select Candidate Transaction Fixture:
                  </label>
                  <select
                    value={selectedFixture}
                    onChange={(e) => setSelectedFixture(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.825rem'
                    }}
                  >
                    <option value="gaming_laptop_drift">{fixtures.gaming_laptop_drift.name}</option>
                    <option value="slight_drift">{fixtures.slight_drift.name}</option>
                    <option value="perfect_match">{fixtures.perfect_match.name}</option>
                  </select>
                </div>

                <button 
                  className="btn btn-primary" 
                  onClick={handleTestPolicy} 
                  disabled={isTesting}
                  style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}
                >
                  <Play size={14} /> Run Policy Evaluation Test
                </button>

                {/* Test Output Panel */}
                {testResult ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                    <div style={{ 
                      padding: '14px', 
                      background: testResult.is_valid_syntax ? 'rgba(0,0,0,0.3)' : 'var(--danger-bg)', 
                      borderRadius: '8px', 
                      border: `1px solid ${testResult.is_valid_syntax ? 'var(--border-subtle)' : 'rgba(239, 68, 68, 0.3)'}` 
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                          Syntax Validation: {testResult.is_valid_syntax ? <strong style={{ color: 'var(--success)' }}>PASSED</strong> : <strong style={{ color: 'var(--danger)' }}>FAILED</strong>}
                        </span>
                        {testResult.decision && <DecisionBadge decision={testResult.decision} />}
                      </div>

                      {testResult.error_message && (
                        <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '8px', margin: 0 }}>
                          {testResult.error_message}
                        </p>
                      )}

                      {testResult.is_valid_syntax && (
                        <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '0.8rem' }}>
                          <div>Evaluated Decision: <strong style={{ color: testResult.decision === 'APPROVE' ? 'var(--success)' : testResult.decision === 'BLOCK' ? 'var(--danger)' : 'var(--warning)' }}>{testResult.decision}</strong></div>
                          <div>Risk Score: <strong>{testResult.risk_score} / 100</strong></div>
                          <div>Violations: <strong style={{ color: testResult.violations?.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{testResult.violations?.length || 0}</strong></div>
                        </div>
                      )}
                    </div>

                    {testResult.violations?.length > 0 && (
                      <div>
                        <h5 style={{ fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '8px' }}>
                          Violations Detected:
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {testResult.violations.map((v, i) => (
                            <div key={i} style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', fontSize: '0.785rem' }}>
                              <strong style={{ color: 'var(--danger)' }}>{v.code}:</strong> {v.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
                    Click "Run Policy Evaluation Test" to dry-run the editor code against the selected fixture.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Read-Only Diff Viewer */}
            {activeTab === 'diff' && (
              <div style={{ height: '480px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span>Left: Active Published Policy</span>
                  <span>Right: Current Working Draft</span>
                </div>
                <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <DiffEditor
                    height="100%"
                    language="yaml"
                    theme="vs-dark"
                    original={activePublishedCode}
                    modified={policyCode}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 12
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Declarative Schema Reference */}
            {activeTab === 'docs' && (
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>
                  Declarative Policy Schema Specification
                </h4>
                <p>
                  Policies are declarative configuration files interpreted by the deterministic policy engine. Arbitrary Python code execution is rejected to maintain zero-privilege security.
                </p>

                <div className="glass-card" style={{ padding: '12px' }}>
                  <strong style={{ color: 'var(--primary)' }}>max_price_tolerance_pct</strong> (float, 0.0 to 1.0)
                  <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Defines the percentage price deviation above max_price that triggers REQUIRE_CONFIRMATION rather than an immediate hard BLOCK. (e.g., 0.10 = 10%).
                  </p>
                </div>

                <div className="glass-card" style={{ padding: '12px' }}>
                  <strong style={{ color: 'var(--primary)' }}>strict_spec_match</strong> (boolean)
                  <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    When true, item must strictly satisfy all declared hardware specifications (e.g. minimum RAM in GB).
                  </p>
                </div>

                <div className="glass-card" style={{ padding: '12px' }}>
                  <strong style={{ color: 'var(--primary)' }}>strict_seller_verification</strong> (boolean)
                  <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    When true, only sellers verified against the backend directory are permitted.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
