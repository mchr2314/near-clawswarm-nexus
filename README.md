# ClawSwarm Nexus — Verifiable Contractor Agent, 20×5 Sealed-Bid Solver Swarm & Function-Call Firewall on NEAR

> **NEAR Hackathon 2026 Submission (`nearhackathon.com`)**
> - **Tracks Covered:** `["agents", "swarms", "security", "business"]` (Tracks `07-agents`, `05-swarms`, `06-security`, `04-business`)
> - **License:** MIT ([LICENSE](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/LICENSE))
> - **Formal Market & Security Specification:** [RULES.md](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/RULES.md)
> - **Independent Second Submission Disclosure (`Q-015`):** This participant also authored the independent `thesis` track research artifact **`near-protocol-pnl`** (*Empirical Protocol-Level Income Statement, Validator Emissions & Cross-Chain Intents Fee Capture Analysis for NEAR*). Both projects have zero shared source files and solve completely distinct tracks.

---

## 1. What ClawSwarm Nexus Solves (Why 90% of Agent Demos Fail in Production)

Most autonomous agent prototypes either:
1. **Hardcode single-vendor API calls** with no Make-vs-Buy cost comparison, no multi-solver price discovery, and no negotiation when quotes exceed budget.
2. **Operate with unrestricted signing keys** or mocked JSON allowlists rather than structural NEAR `FunctionCall` access-key scoping (`allowance`, `receiver_id`, `method_names`) paired with live on-chain RPC telemetry (`view_account`, `code_hash`, `storage_usage`, `view_access_key_list`).

**ClawSwarm Nexus** unifies four production primitives into a single zero-key-required, deterministic TypeScript + React 19 system:

1. **Autonomous General Contractor & Single-Round Negotiation Engine (`07-agents`):**
   - Decomposes a client goal + budget ceiling into typed subtasks.
   - Evaluates **Make-vs-Buy** against live `NEAR.AI` confidential TEE model pricing (`https://cloud-api.near.ai/v1/models`).
   - Executes **single-round reasoned counter-offer negotiation** when a solver's ask exceeds the subtask reservation price, demonstrating all four decision branches (`MAKE_INTERNAL`, `ACCEPTED_INITIAL_QUOTE`, `ACCEPTED_COUNTER_OFFER`, `WALKED_AWAY_REASSIGNED`).
   - Settles cross-chain execution via **live NEAR Intents `1Click` API** (`POST https://1click.chaindefuser.com/v0/quote`, `dry: true`) across Arbitrum and Base USDC.
2. **20-Buyer × 5-Seller Commit-Reveal Sealed-Bid Swarm Clearinghouse (`05-swarms`):**
   - Coordinates `buyer-1.swarm.testnet`..`buyer-20.swarm.testnet` and `seller-1.swarm.testnet`..`seller-5.swarm.testnet`.
   - Enforces Phase 1 `SHA-256(accountId || role || unitPrice || qty || salt)` commitments, Phase 2 reveal verification (disqualifying any tampered reveal), and Phase 3 uniform Vickrey-adjusted clearing price with automatic bulk tier discounts when $\ge 3$ buyers pool demand.
3. **6-Signal Live NEAR RPC Counterparty Risk Scorer & Scoped `FunctionCall` Key Guard (`06-security`):**
   - Queries live FastNEAR / NEAR Mainnet RPC (`view_account` & `view_access_key_list`) to score receivers `0–100` (`ALLOW` / `WARN` / `BLOCK`) across 6 signals: shared evidence registry (`SIG-01`), implicit 64-hex threshold (`SIG-02`), on-chain existence (`SIG-03`), contract `code_hash` & storage stake footprint (`SIG-04`), liquid balance floor (`SIG-05`), and prompt-boundary instruction sanitization (`SIG-06`).
   - Generates real WebCrypto `Ed25519` keypairs (`ed25519:<base58>`) and enforces structural `FunctionCallPermission` rules before signing, deterministically rejecting `Transfer`, `AddKey`, unapproved receivers, unlisted methods, and allowance overruns.
4. **Autonomous Business P&L Ledger, `70/20/10` Vault Distribution & Kill-Switch (`04-business`):**
   - Enforces [config.yaml](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/config.yaml) spend caps, target gross margin ($\ge 18\%$), instant `killSwitchActive` circuit breaker, automatic `70% / 20% / 10%` net profit distribution, and hash-chained `Ed25519`-signed execution receipts.

---

## 2. Deterministic Reproduction (`Do X — See Y` in Under 30 Seconds)

No paid API keys or external wallet secrets are required. All live endpoints (`FastNEAR Mainnet RPC`, `NEAR Intents 1Click API`, and `NEAR.AI Model Catalog`) are public and keyless, with deterministic offline fallback for air-gapped evaluation.

```bash
# 1. Install dependencies
npm install

# 2. Run the live end-to-end Contractor + 20x5 Swarm + RPC Firewall + 1Click Quote loop
npm run demo

# 3. Run the 4-scenario Boundary & FunctionCall Key-Scope Verification Suite
npm run boundary-eval

# 4. Run the automated Vitest unit & invariant test suite
npm test

# 5. Build the interactive Mission Control Web UI
npm run build
npm run preview
```

### Expected Verified CLI Output (`npm run verify`)
- **`npm run demo`:**
  - Fetches `64` live models (`16` TEE Confidential / `48` Standard Proxy) from `https://cloud-api.near.ai/v1/models`.
  - Verifies `25/25` `SHA-256` commitments across `20` buyers and `5` sellers, clearing `32` units at `0.4347 NEAR/unit` and saving `4.0896 NEAR` in buyer consumer surplus.
  - Logs all `4` negotiation outcomes (`MAKE_INTERNAL`, `ACCEPTED_INITIAL_QUOTE`, `ACCEPTED_COUNTER_OFFER`, `WALKED_AWAY_REASSIGNED`) reducing subtask spend to `8.6767 NEAR` (`+9.8233 NEAR` net operating profit, `53.10%` gross margin).
  - Queries live NEAR Mainnet RPC for `intents.near` (`137,185.44 NEAR` liquid balance, `1,845,290` bytes storage) and `wrap.near` (`37,332,751.01 NEAR`), scoring both `0/100 (ALLOW)`.
  - Requests `2` live `HTTP 201` cross-chain dry settlement quotes from `https://1click.chaindefuser.com/v0/quote` (`wNEAR -> Arbitrum USDC` and `wNEAR -> Base USDC`).
  - Emits `6` hash-chained `Ed25519`-signed receipts to `data/latest-run.json`.
- **`npm run boundary-eval`:**
  - Deterministically blocks `4/4` non-conforming actions (`BND-01` prompt override + `AddKey`, `BND-02` implicit 64-hex sink, `BND-03` native `Transfer` on scoped `FunctionCall` key, `BND-04` unlisted method + single-call ceiling overrun) and writes signed rejection receipts to `data/boundary-eval.json`.

---

## 3. Repository Structure

| File | Responsibility |
| :--- | :--- |
| [RULES.md](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/RULES.md) | Formal commit-reveal auction math, counter-offer rules, 6-signal risk scoring matrix, and sequence diagrams |
| [config.yaml](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/config.yaml) | Autonomous business spend ceilings, scoped `FunctionCall` key allowlist, `70/20/10` split, and kill-switch |
| [src/core/crypto-keys.ts](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/src/core/crypto-keys.ts) | WebCrypto `Ed25519` keypair generator, `ed25519:<base58>` encoder, `FunctionCallPermission` guard, and hash-chained receipt signer |
| [src/core/security-firewall.ts](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/src/core/security-firewall.ts) | Live NEAR RPC (`view_account`, `view_access_key_list`) 6-signal counterparty risk scorer & prompt-boundary filter |
| [src/core/swarm-market.ts](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/src/core/swarm-market.ts) | 20-Buyer × 5-Seller `SHA-256` commit-reveal clearinghouse with uniform Vickrey pricing & demand pooling |
| [src/core/contractor-agent.ts](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/src/core/contractor-agent.ts) | General Contractor planner, single-round counter-offer negotiator, live `1Click` quoter, and `70/20/10` P&L ledger |
| [src/cli/run-demo.ts](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/src/cli/run-demo.ts) | End-to-end live telemetry & execution CLI (`npm run demo`) |
| [src/cli/run-boundary-eval.ts](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/src/cli/run-boundary-eval.ts) | 4-scenario security boundary & scoped-key evaluation suite (`npm run boundary-eval`) |
| [src/ui/App.tsx](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/src/ui/App.tsx) | 5-tab interactive Mission Control dashboard with live RPC account scanner and commit-tamper simulator |
| [tests/agent-system.test.ts](file:///C:/Users/K/.gemini/antigravity/scratch/near-clawswarm-nexus/tests/agent-system.test.ts) | Automated Vitest verification suite (`6/6` tests passing) |
