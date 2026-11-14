# VeriPact (`near-clawswarm-nexus` v2.0) — NEP-413 Verifiable Contractor Agent, 20×5 Commit-Reveal Clearinghouse & Scoped-Key Guard on NEAR

> **NEAR Hackathon 2026 Submission (`nearhackathon.com`)**
> - **Tracks Covered:** `["agents", "swarms", "security", "business"]` (Tracks `07-agents`, `05-swarms`, `06-security`, `04-business`)
> - **Live Web Mission Control:** `https://mchr2314.github.io/near-clawswarm-nexus/`
> - **License:** MIT ([LICENSE](./LICENSE))
> - **Formal Market & Security Specification:** [RULES.md](./RULES.md)
> - **Independent Second Submission Disclosure (`Q-015`):** This participant also authored the independent `thesis` track research artifact **[near-protocol-pnl](https://github.com/mchr2314/near-protocol-pnl)** (*Empirical Protocol-Level Income Statement, Validator Emissions & Cross-Chain Intents Fee Capture Analysis for NEAR*, live at `https://mchr2314.github.io/near-protocol-pnl/`). Both projects have zero shared source files and solve completely distinct tracks.

---

## 1. What VeriPact Solves (Why Standard Agent Prototypes Fail Production Audit)

Most autonomous agent demos fail institutional verification because they:
1. **Use generic JSON hashes instead of NEAR-native wire standards (`NEP-413` & Borsh `FunctionCallAction`)**, making their signatures incompatible with `intents.near` and NEAR wallets.
2. **Hardcode policy limits in source code** rather than parsing live constraints (`killSwitchActive`, `maxDailySpendNear`, `maxSingleTaskNear`, `allowedMethods`) from [config.yaml](./config.yaml).
3. **Simulate multi-agent markets without per-agent cryptographic identity**, rather than equipping every buyer and seller with an independent `Ed25519` keypair (`ed25519:<base58>`) and verifying `NEP-413` signatures alongside `SHA-256` commit-reveal preimages.

**VeriPact (`near-clawswarm-nexus` v2.0)** unifies four production-grade NEAR primitives into a deterministic, zero-key-required TypeScript + React 19 system:

1. **Autonomous General Contractor & Single-Round Negotiation Engine (`07-agents`):**
   - Decomposes a client goal + budget ceiling into 4 typed subtasks.
   - Evaluates **Make-vs-Buy** against live `NEAR.AI` confidential TEE model pricing (`https://cloud-api.near.ai/v1/models` — `64` production models: `16` Confidential TEE Enclave + `48` Proxy).
   - Executes **single-round reasoned counter-offer negotiation** when a solver's ask exceeds the subtask reservation price, demonstrating all four decision branches (`MAKE_INTERNAL`, `ACCEPTED_INITIAL_QUOTE`, `ACCEPTED_COUNTER_OFFER`, `WALKED_AWAY_REASSIGNED`).
   - Requests **live NEAR Intents `1Click` Mainnet non-dry quotes** (`POST https://1click.chaindefuser.com/v0/quote`, `dry: false`) across **3 chains** (`Arbitrum USDC`, `Base USDC`, and `Ethereum Mainnet USDC`), generating real Mainnet 64-byte hex deposit escrow addresses (`mainnetDepositAddress`), real `Ed25519` solver quote signatures, and verifying live `/v0/status` (`PENDING_DEPOSIT`).
   - Executes and verifies **real on-chain transactions on the NEAR blockchain** ([src/core/near-onchain.ts](./src/core/near-onchain.ts)), verifying real account creation (`veripact-agent-2026.testnet`, tx `8jPD7TX2WUsxYBDxfYmBDHp62UwkMEan1rBg1xJkR2PM`) and real Borsh `SignedTransaction` execution against `wrap.testnet` (`vp-492840.testnet`, tx `31shSr5PffAAF9PMcx6Nn7YC2aBYAYjTRNehekKNBhqM`, receipt `A8KX8xaLwob3tLh9ZjhMfsTKFgzz9iiyuGZD2xyzcC3f`) via live NEAR RPC (`method: "tx"`).
2. **20-Buyer × 5-Seller NEP-413 Signed Commit-Reveal Clearinghouse (`05-swarms`):**
   - Coordinates `buyer-1.swarm.testnet`..`buyer-20.swarm.testnet` and `seller-1.swarm.testnet`..`seller-5.swarm.testnet`.
   - Every participant (`25` agents total) generates an independent `Ed25519` keypair, commits `SHA-256(accountId || role || unitPrice || qty || salt)`, and signs the commitment using **specification-exact `NEP-413` Borsh serialization** (little-endian `u32` domain tag `2147484061` = `0x9d010080` + Borsh `message` + 32-byte `nonce` + Borsh `recipient`).
   - Phase 2 verifies all `25/25` `SHA-256` reveals and `25/25` `NEP-413` `Ed25519` signatures before computing the uniform Vickrey-adjusted clearing price (`0.4347 NEAR/unit`) and visualizing the Supply-Demand intersection curve.
3. **6-Signal Live NEAR Mainnet RPC Counterparty Risk Scorer & Borsh `FunctionCall` Key Guard (`06-security`):**
   - Queries live FastNEAR / NEAR Mainnet RPC (`view_account` & `view_access_key_list`) for `intents.near`, `wrap.near`, and `v2.ref-finance.near` to score receivers `0–100` (`ALLOW` / `WARN` / `BLOCK`) across 6 telemetry signals (`SIG-01`..`SIG-06`).
   - Enforces structural `FunctionCallPermission` rules before encoding valid calls into **specification-exact NEAR Borsh `FunctionCallAction` binary wire format** (`0x02` action enum discriminant + `method_name` + `args` + `u64` gas + `u128` yoctoNEAR deposit).
4. **Live `config.yaml` Business Policy Loader, `70/20/10` Vault Distribution & Kill-Switch (`04-business`):**
   - Parses [config.yaml](./config.yaml) directly from disk on every run (and supports CLI flags `--kill-switch`, `--budget <NEAR>`, `--max-daily <NEAR>`). Editing `config.yaml` immediately alters runtime enforcement without recompiling.

---

## 2. Deterministic Reproduction (`Do X — See Y` in Under 20 Seconds)

1. **Install dependencies** — run `npm install` — see `node_modules/` installed cleanly (`Node >= 20`, zero private API keys required).
2. **Execute live Contractor + 20×5 NEP-413 Swarm + Mainnet RPC Firewall + 3-Chain 1Click Mainnet Quote + On-Chain Tx Verification loop** — run `npm run demo` — see all 7 stages execute and write `public/data/latest-run.json`.
3. **Test live policy constraint override (Kill-Switch or Daily Spend Cap)** — run `npm run demo -- --kill-switch` or `npm run demo -- --max-daily 4.5` — see `HALTED BY KILL-SWITCH` enforced deterministically.
4. **Run the 4-scenario Boundary & FunctionCall Key-Scope Verification Suite** — run `npm run boundary-eval` — see `4/4` non-conforming actions (`FullAccess` AddKey, `DeleteAccount`, unallowlisted receiver, allowance overflow) blocked with signed `NEP-413` receipts.
5. **Run the automated Vitest unit, NEP-413 Borsh & invariant suite** — run `npm test` — see `9 passed` in `tests/agent-system.test.ts`.
6. **Run full one-command verification gate** — run `npm run verify` — see `demo + boundary-eval + test + build` complete with exit code `0`.

---

## 3. Repository Structure

| File | Responsibility |
| :--- | :--- |
| [RULES.md](./RULES.md) | Formal commit-reveal auction math, `NEP-413` binary specification, counter-offer rules, and 6-signal risk matrix |
| [config.yaml](./config.yaml) | Live-parsed autonomous business spend ceilings, scoped `FunctionCall` key allowlist, `70/20/10` split, and kill-switch |
| [src/core/config-loader.ts](./src/core/config-loader.ts) | Zero-dependency `config.yaml` parser that enforces live operator policy edits |
| [src/core/crypto-keys.ts](./src/core/crypto-keys.ts) | `NEP-413` Borsh serializer (`0x9d010080`), NEAR Borsh `FunctionCallAction` encoder, `Ed25519` signer, and key guard |
| [src/core/near-onchain.ts](./src/core/near-onchain.ts) | Borsh `SignedTransaction` serializer and live NEAR blockchain transaction verifier (`wrap.testnet` & `veripact-agent-2026.testnet`) |
| [src/core/security-firewall.ts](./src/core/security-firewall.ts) | Live NEAR Mainnet RPC (`view_account`, `view_access_key_list`) 6-signal counterparty risk scorer & prompt-boundary filter |
| [src/core/swarm-market.ts](./src/core/swarm-market.ts) | 20-Buyer × 5-Seller `NEP-413` + `SHA-256` commit-reveal clearinghouse with uniform Vickrey pricing |
| [src/core/contractor-agent.ts](./src/core/contractor-agent.ts) | General Contractor planner, single-round counter-offer negotiator, 3-chain `1Click` Mainnet quoter, and `70/20/10` P&L ledger |
| [src/ui/App.tsx](./src/ui/App.tsx) | Framer Architectural Swiss-Grid Mission Control UI with 3D Geodesic Swarm Lattice, Supply-Demand SVG curve, and `NEP-413` wire hex inspector |
| [tests/agent-system.test.ts](./tests/agent-system.test.ts) | Automated Vitest verification suite (`9/9` tests passing) |
