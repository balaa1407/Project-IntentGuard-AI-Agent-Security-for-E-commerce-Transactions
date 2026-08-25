# IntentGuard Enterprise — Comprehensive Implementation Plan

## 1. Executive Summary & Repository Audit

### 1.1 Context and Scope
This document records the baseline audit of the existing `razorpay-intentguard` repository and outlines the transformation into **IntentGuard Enterprise**: an AI-Agent Transaction Security and Authorization Platform for E-commerce. 

The core mission of IntentGuard Enterprise is to sit at the **trusted backend boundary** between autonomous shopping agents and payment execution rails. When human consumers delegate purchasing authority to AI agents, IntentGuard ensures that **no payment can execute unless the transaction strictly and deterministically satisfies an immutable, cryptographically verifiable authorization contract**.

---

### 1.2 Dead-Honest Repository Audit Findings

An exhaustive audit of the existing codebase (`package.json`, `src/App.jsx`, `src/services/ai.js`, `src/services/simulator.js`, and `.env`) revealed that the current repository is a frontend prototype with critical architectural and security vulnerabilities:

| Component / File | Current Implementation | Identified Vulnerability / Flaw | Severity |
| :--- | :--- | :--- | :--- |
| **Secret Management** (`.env`, `src/App.jsx`, `ai.js`) | `VITE_GEMINI_API_KEY` stored in `.env` and loaded via `import.meta.env.VITE_GEMINI_API_KEY`. | **Critical Secret Leakage:** In Vite, any variable prefixed with `VITE_` is statically injected into the client bundle and visible to any end user or browser inspector. Direct calls to `generativelanguage.googleapis.com` are made from the client browser. | **CRITICAL** |
| **Backend & Architecture** | No backend exists. The application is a static Single Page Application (SPA). | **Missing Trust Boundary:** No trusted server exists to enforce policies, manage sessions, or sign transactions. All "security checks" occur in client JavaScript memory. | **CRITICAL** |
| **Policy Evaluation** (`src/services/simulator.js`) | Three hardcoded scenarios (`LOW_RISK`, `MEDIUM_RISK`, `HIGH_RISK`). | **Fabricated Decisions:** Risk scores (`5`, `45`, `92`), match percentages (`98%`, `74%`, `31%`), and risk levels are pre-scripted constants. No real constraint calculation occurs. | **HIGH** |
| **Security Decision Authority** (`src/App.jsx`) | UI switches on `finalResult.riskLevel` to render `APPROVE`, `VERIFY INTENT`, or `HOLD PAYMENT`. | **Client-Side Bypass:** Anyone with devtools can flip the state or call the payment handler. No server enforces the decision. | **HIGH** |
| **Payment Execution** (`src/App.jsx`) | Buttons set a local React string `actionMessage = 'Payment will be initiated.'`. | **Zero Execution Integrity:** No payment adapter, no idempotency checks, no transaction state machine, no integration with sandbox rails. | **HIGH** |
| **Audit Log Integrity** (`src/App.jsx:79-84`) | Browser computes `crypto.subtle.digest('SHA-256')` of an ephemeral JSON object and displays the hex string. | **Misleading Security Claim:** The hash is never stored in a database, not chained, not signed, and can be forged client-side with zero effort. | **MEDIUM** |
| **LLM Trust Boundary** (`src/services/ai.js`) | Natural language input is sent to Gemini 3.5 Flash; output is parsed via `JSON.parse` with basic try-catch. | **Unconstrained Parsing & Prompt Injection Vulnerability:** No strict schema validation (Pydantic/Zod), no bounds checking, no fail-closed fallback for malformed or adversarial outputs. | **HIGH** |
| **Code Editor & Policy Management** | Basic HTML textareas or buttons. | **No Policy Governance:** No syntax validation, no version control, no diffing, no testing harness for enterprise rules. | **MEDIUM** |

---

### 1.3 Functionality Worth Preserving
While the underlying implementation must be replaced with enterprise-grade architecture, the original prototype established several valuable domain concepts:
1. **Natural Language to Intent Contract:** Converting human shopping instructions into structured, verifiable constraints.
2. **Agent Timeline Traceability:** Visualizing the shopping agent's micro-actions (T0 to T5) leading up to the checkout proposal.
3. **Multi-tier Decision Outcomes:** Distinct handling for perfect alignment (`APPROVE`), minor deviations requiring human authorization (`REQUIRE_CONFIRMATION`), and critical violations (`BLOCK`).
4. **Explainable Discrepancy Reporting:** Translating constraint violations into clear, human-understandable evidence for security operators.
5. **Cryptographic Auditability Concept:** Providing an immutable SHA-256 fingerprint of the authorization and execution record.

---

## 2. Target Enterprise Architecture

```
[ Customer / User ]
         |  (Natural Language Request)
         v
+---------------------------------------------------------------------------------+
|                       TRUSTED BACKEND BOUNDARY (FastAPI)                        |
|                                                                                 |
|  +-----------------------------+       +-------------------------------------+  |
|  |     Intent Extractor        | ----> |   Strict Pydantic Intent Schema     |  |
|  |  (Gemini / Offline Mock)    |       |  (Validates constraints & bounds)   |  |
|  +-----------------------------+       +-------------------------------------+  |
|                                                           |                     |
|                                                           v                     |
|                                        +-------------------------------------+  |
|                                        | Immutable Authorization Contract    |  |
|                                        |  (Persisted in DB with Hash ID)     |  |
|                                        +-------------------------------------+  |
|                                                           |                     |
|  [ Shopping Agent Checkout Attempt ]                      |                     |
|                |                                          |                     |
|                v                                          v                     |
|  +---------------------------------------------------------------------------+  |
|  |              DETERMINISTIC TRANSACTION POLICY ENGINE                      |  |
|  |  - Budget Limit Check (fail closed)                                       |  |
|  |  - Hardware Spec Verification (RAM, Storage, Category)                    |  |
|  |  - Seller Trust & Verification Status Check                               |  |
|  |  - Quantity & Single-Purchase Enforcement                                 |  |
|  |  - Contract Expiry & Modification Check                                   |  |
|  |  - Replay & Duplicate Idempotency Key Check                               |  |
|  +---------------------------------------------------------------------------+  |
|                                    |                                            |
|          +-------------------------+-------------------------+                  |
|          |                         |                         |                  |
|          v                         v                         v                  |
|     [ APPROVE ]        [ REQUIRE_CONFIRMATION ]          [ BLOCK ]              |
|          |                         |                         |                  |
|          |                 (Human Approves           (Execution Halted;         |
|          |                  Revised Terms)            Evidence Logged)          |
|          |                         |                         |                  |
|          v                         v                         |                  |
|  +-------------------------------------+                     |                  |
|  |   Sandboxed Payment Adapter         |                     |                  |
|  |   (Idempotent Mock Gateway)         |                     |                  |
|  +-------------------------------------+                     |                  |
|                     |                                        |                  |
|                     v                                        v                  |
|  +---------------------------------------------------------------------------+  |
|  |           TAMPER-EVIDENT APPEND-ONLY AUDIT LEDGER (SHA-256 CHAIN)          |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
```

### 2.1 Backend Modules (`backend/app/`)
1. **`core/config.py`**: Pydantic `BaseSettings` reading environment variables securely, validating keys, setting CORS and debug flags.
2. **`core/security.py`**: JWT token creation, API key authentication, RBAC roles (`ADMIN`, `SECURITY_OPERATOR`, `AUDITOR`, `AGENT`), password hashing.
3. **`models/`**: Declarative models for users, contracts, transactions, policies, and hash-chained audit events.
4. **`schemas/`**: Pydantic v2 schemas for intent drafts, immutable contracts, transactions, policies, violations, decisions, and audit verification.
5. **`services/`**:
   - `intent_extractor.py`: Gemini client + deterministic offline fallback parser.
   - `policy_engine.py`: 100% deterministic constraint evaluator.
   - `payment_adapter.py`: Sandboxed payment gateway adapter with explicit state transitions.
   - `audit_service.py`: Hash-chained audit event recorder with integrity verification.
6. **`api/v1/`**: Endpoints for auth, intent contracts, transaction processing, policies, audit verification, metrics, and adversarial simulation.

### 2.2 Frontend Modules (`src/`)
1. **Design System & Aesthetics**: Dark graphite theme, electric blue/teal accents, responsive cards, glassmorphic panels.
2. **7 Core Enterprise Pages**:
   - Command Center
   - Transaction Explorer
   - Agent Journey Visualizer
   - Attack Simulation Lab
   - Policy Management Workbench (Monaco Editor)
   - Audit Explorer (Cryptographic hash-chain integrity)
   - System Settings
3. **Interactive 3D Gateway**: React Three Fiber + Drei transaction visualization reflecting real backend decision states.

---

## 3. Migration and Implementation Roadmap

- **Stage 1**: Repository audit & documentation (`IMPLEMENTATION_PLAN.md`, `ARCHITECTURE.md`, `THREAT_MODEL.md`, `ACCEPTANCE_CRITERIA.md`).
- **Stage 2**: Backend foundation: FastAPI, SQLAlchemy, Alembic, Pydantic v2, SQLite/Postgres switchable database.
- **Stage 3**: Deterministic policy engine, sandbox payment adapter, and hash-chained audit service.
- **Stage 4**: Adversarial attack test suite & Pytest verification.
- **Stage 5**: Rebuild frontend into 7 enterprise views with R3F 3D visualization and Framer Motion.
- **Stage 6**: Embedded Monaco Editor policy workbench with split-pane testing and diffing.
- **Stage 7**: End-to-end integration testing and validation.
- **Stage 8**: Docker Compose, environment examples, CI workflow, and deployment documentation.
