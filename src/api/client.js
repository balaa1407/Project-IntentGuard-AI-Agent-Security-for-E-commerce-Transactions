/**
 * IntentGuard Enterprise Unified API Client
 * Interfaces with FastAPI backend with strict typed error handling.
 */

const API_BASE = "http://localhost:8000/api/v1";

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Correlation-ID": `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    ...options.headers
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    if (!res.ok) {
      let errorDetail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errorDetail = errJson.detail || JSON.stringify(errJson);
      } catch (e) {
        errorDetail = await res.text();
      }
      throw new Error(errorDetail);
    }

    return await res.json();
  } catch (error) {
    console.warn(`[IntentGuard API Error] ${endpoint}:`, error.message);
    throw error;
  }
}

export const api = {
  // Health & Telemetry
  getHealth: () => request("/health"),
  getAnalytics: () => request("/analytics/overview"),

  // Intent & Contracts
  extractIntent: (prompt) => request("/intent/extract", {
    method: "POST",
    body: JSON.stringify({ prompt })
  }),
  confirmContract: (prompt, intent, ttlMinutes = 120) => request("/intent/confirm", {
    method: "POST",
    body: JSON.stringify({ prompt, intent, ttl_minutes: ttlMinutes })
  }),
  listContracts: () => request("/intent/contracts"),
  getContract: (id) => request(`/intent/contracts/${id}`),

  // Transactions & Policy
  submitTransaction: (data) => request("/transactions/submit", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  confirmTransaction: (txId, confirmationToken, reason) => request(`/transactions/${txId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ confirmation_token: confirmationToken, reason })
  }),
  listTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/transactions${query ? `?${query}` : ""}`);
  },
  getTransaction: (id) => request(`/transactions/${id}`),

  // Policies (Monaco Workbench)
  listPolicies: () => request("/policies"),
  getActivePolicy: () => request("/policies/active"),
  savePolicy: (policyData) => request("/policies", {
    method: "POST",
    body: JSON.stringify(policyData)
  }),
  testPolicy: (testData) => request("/policies/test", {
    method: "POST",
    body: JSON.stringify(testData)
  }),
  activatePolicy: (id) => request(`/policies/${id}/activate`, {
    method: "POST"
  }),

  // Audit Ledger
  listAuditEvents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/audit/events${query ? `?${query}` : ""}`);
  },
  verifyAuditLedger: () => request("/audit/verify"),

  // Attack Simulation Lab
  listScenarios: () => request("/simulation/scenarios"),
  runScenario: (scenarioId) => request(`/simulation/run/${scenarioId}`, {
    method: "POST"
  })
};
