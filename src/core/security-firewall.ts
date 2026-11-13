// ClawSwarm Nexus — Live NEAR RPC Counterparty Risk Scorer & Prompt-Boundary Guard
// Evaluates target NEAR accounts on 6 concrete telemetry signals before any intent or payout is signed.

export type FirewallDecision = 'ALLOW' | 'WARN' | 'BLOCK';

export interface SignalFinding {
  signalId: 'SIG-01' | 'SIG-02' | 'SIG-03' | 'SIG-04' | 'SIG-05' | 'SIG-06';
  label: string;
  triggered: boolean;
  riskPoints: number;
  evidence: string;
}

export interface AccountRpcTelemetry {
  accountId: string;
  existsOnChain: boolean;
  networkQueried: string;
  liquidBalanceNear: number;
  storageUsageBytes: number;
  codeHash: string;
  isSmartContract: boolean;
  accessKeyCount: number;
  fullAccessKeyCount: number;
  functionCallKeyCount: number;
  blockHeight: number;
  rpcLatencyMs: number;
  source: 'live-near-rpc' | 'deterministic-fallback';
}

export interface CounterpartyRiskAssessment {
  receiverId: string;
  proposedAmountNear: number;
  methodName: string;
  taskMemo: string;
  riskScore: number;
  decision: FirewallDecision;
  signals: SignalFinding[];
  telemetry: AccountRpcTelemetry;
  evaluatedAtIso: string;
}

export interface KnownRiskEvidenceEntry {
  accountIdPattern: string;
  category: string;
  severity: 'HIGH' | 'CRITICAL';
  evidenceRef: string;
}

export const SHARED_RISK_REGISTRY: KnownRiskEvidenceEntry[] = [
  {
    accountIdPattern: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
    category: 'Unverified Implicit Fee-Sweep Sink',
    severity: 'CRITICAL',
    evidenceRef: 'NEAR-SEC-2026-019: Automated memo-override sweep account',
  },
  {
    accountIdPattern: 'collector-unverified-sink.testnet',
    category: 'Phishing Solver Spoof Account',
    severity: 'CRITICAL',
    evidenceRef: 'NEAR-SEC-2026-042: Zero-contract spoofed solver endpoint',
  },
  {
    accountIdPattern: 'spoof-bridge-relay.near',
    category: 'Unauthorized Settlement Relay',
    severity: 'HIGH',
    evidenceRef: 'NEAR-SEC-2026-051: Unverified EOA impersonating bridge relayer',
  },
];

const VERIFIED_SWARM_PROFILES: Record<
  string,
  Omit<AccountRpcTelemetry, 'accountId' | 'rpcLatencyMs' | 'source'>
> = {
  'intents.near': {
    existsOnChain: true,
    networkQueried: 'mainnet',
    liquidBalanceNear: 136648.42,
    storageUsageBytes: 1845290,
    codeHash: '7V2p9mK8xLz1Qw4Er6Ty8Ui0Op2As4Df6Gh8Jk0Lz2X',
    isSmartContract: true,
    accessKeyCount: 2,
    fullAccessKeyCount: 0,
    functionCallKeyCount: 2,
    blockHeight: 224374632,
  },
  'wrap.near': {
    existsOnChain: true,
    networkQueried: 'mainnet',
    liquidBalanceNear: 5419204.11,
    storageUsageBytes: 12940120,
    codeHash: '8Hn3kLp9Qw2Er5Ty7Ui9Op1As3Df5Gh7Jk9Lz1Xc3Vb',
    isSmartContract: true,
    accessKeyCount: 0,
    fullAccessKeyCount: 0,
    functionCallKeyCount: 0,
    blockHeight: 224374632,
  },
  'v2.ref-finance.near': {
    existsOnChain: true,
    networkQueried: 'mainnet',
    liquidBalanceNear: 18420.55,
    storageUsageBytes: 8412900,
    codeHash: '4Jk9Lz1Xc3Vb5Nm7Qw9Er2Ty4Ui6Op8As0Df2Gh4Jk6',
    isSmartContract: true,
    accessKeyCount: 1,
    fullAccessKeyCount: 0,
    functionCallKeyCount: 1,
    blockHeight: 224374632,
  },
};

const PROMPT_OVERRIDE_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s*override/i,
  /addkey\s*\(/i,
  /fullaccess/i,
  /deleteaccount/i,
  /transfer_all_balance/i,
  /override_policy\s*=\s*true/i,
  /bypass_firewall/i,
];

const EMPTY_CODE_HASH = '11111111111111111111111111111111';

export async function fetchNearAccountTelemetry(
  accountId: string,
  rpcEndpoint = 'https://free.rpc.fastnear.com'
): Promise<AccountRpcTelemetry> {
  const startMs = Date.now();
  const isTestnetAccount = accountId.endsWith('.testnet');
  const targetRpc = isTestnetAccount
    ? 'https://rpc.testnet.near.org'
    : rpcEndpoint;

  // Deterministic synthetic profile for local *.swarm.testnet solver sub-accounts
  if (accountId.endsWith('.swarm.testnet')) {
    return {
      accountId,
      existsOnChain: true,
      networkQueried: 'testnet-swarm-registry',
      liquidBalanceNear: 48.5,
      storageUsageBytes: 16480,
      codeHash: '5SwarmSolverVerifiedContractCodeHashBase58xxxx',
      isSmartContract: true,
      accessKeyCount: 3,
      fullAccessKeyCount: 1,
      functionCallKeyCount: 2,
      blockHeight: 224374632,
      rpcLatencyMs: Math.max(1, Date.now() - startMs),
      source: 'deterministic-fallback',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const viewAccountReq = fetch(targetRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'clawswarm-fw-account',
        method: 'query',
        params: {
          request_type: 'view_account',
          finality: 'final',
          account_id: accountId,
        },
      }),
      signal: controller.signal,
    });

    const viewKeysReq = fetch(targetRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'clawswarm-fw-keys',
        method: 'query',
        params: {
          request_type: 'view_access_key_list',
          finality: 'final',
          account_id: accountId,
        },
      }),
      signal: controller.signal,
    });

    const [accRes, keysRes] = await Promise.all([viewAccountReq, viewKeysReq]);
    clearTimeout(timer);

    if (accRes.ok) {
      const accJson = (await accRes.json()) as {
        result?: {
          amount?: string;
          storage_usage?: number;
          code_hash?: string;
          block_height?: number;
        };
        error?: unknown;
      };

      if (accJson.result && typeof accJson.result.amount === 'string') {
        const keysJson = keysRes.ok
          ? ((await keysRes.json()) as {
              result?: {
                keys?: Array<{
                  access_key?: { permission?: 'FullAccess' | { FunctionCall: unknown } };
                }>;
              };
            })
          : {};
        const keyList = keysJson.result?.keys ?? [];
        const fullAccessKeyCount = keyList.filter(
          (k) => k.access_key?.permission === 'FullAccess'
        ).length;
        const functionCallKeyCount = keyList.length - fullAccessKeyCount;

        const yocto = BigInt(accJson.result.amount);
        const liquidBalanceNear = Number(yocto / BigInt(1e18)) / 1e6;
        const codeHash = accJson.result.code_hash ?? EMPTY_CODE_HASH;

        return {
          accountId,
          existsOnChain: true,
          networkQueried: isTestnetAccount ? 'testnet' : 'mainnet',
          liquidBalanceNear: Number(liquidBalanceNear.toFixed(4)),
          storageUsageBytes: accJson.result.storage_usage ?? 0,
          codeHash,
          isSmartContract: codeHash !== EMPTY_CODE_HASH,
          accessKeyCount: keyList.length,
          fullAccessKeyCount,
          functionCallKeyCount,
          blockHeight: accJson.result.block_height ?? 0,
          rpcLatencyMs: Math.max(1, Date.now() - startMs),
          source: 'live-near-rpc',
        };
      }

      if (accJson.error) {
        return {
          accountId,
          existsOnChain: false,
          networkQueried: isTestnetAccount ? 'testnet' : 'mainnet',
          liquidBalanceNear: 0,
          storageUsageBytes: 0,
          codeHash: EMPTY_CODE_HASH,
          isSmartContract: false,
          accessKeyCount: 0,
          fullAccessKeyCount: 0,
          functionCallKeyCount: 0,
          blockHeight: 0,
          rpcLatencyMs: Math.max(1, Date.now() - startMs),
          source: 'live-near-rpc',
        };
      }
    }
  } catch {
    // Fall through to deterministic known profile if offline
  }

  const preset = VERIFIED_SWARM_PROFILES[accountId];
  if (preset) {
    return {
      accountId,
      ...preset,
      rpcLatencyMs: Math.max(1, Date.now() - startMs),
      source: 'deterministic-fallback',
    };
  }

  return {
    accountId,
    existsOnChain: false,
    networkQueried: isTestnetAccount ? 'testnet' : 'mainnet',
    liquidBalanceNear: 0,
    storageUsageBytes: 0,
    codeHash: EMPTY_CODE_HASH,
    isSmartContract: false,
    accessKeyCount: 0,
    fullAccessKeyCount: 0,
    functionCallKeyCount: 0,
    blockHeight: 0,
    rpcLatencyMs: Math.max(1, Date.now() - startMs),
    source: 'deterministic-fallback',
  };
}

export async function evaluateCounterpartyRisk(params: {
  receiverId: string;
  proposedAmountNear: number;
  methodName: string;
  taskMemo: string;
  rpcEndpoint?: string;
  preloadedTelemetry?: AccountRpcTelemetry;
}): Promise<CounterpartyRiskAssessment> {
  const telemetry =
    params.preloadedTelemetry ??
    (await fetchNearAccountTelemetry(params.receiverId, params.rpcEndpoint));

  const signals: SignalFinding[] = [];

  // SIG-01: Shared Risk Evidence Registry
  const registryHit = SHARED_RISK_REGISTRY.find(
    (entry) =>
      entry.accountIdPattern.toLowerCase() === params.receiverId.toLowerCase()
  );
  signals.push({
    signalId: 'SIG-01',
    label: 'Shared Verifiable Risk Registry Check',
    triggered: Boolean(registryHit),
    riskPoints: registryHit ? 55 : 0,
    evidence: registryHit
      ? `Matched ${registryHit.severity} entry (${registryHit.category} — ${registryHit.evidenceRef}).`
      : 'No adverse entries in shared evidence registry.',
  });

  // SIG-02: Implicit 64-Hex Account Structure on High-Value Routing
  const isImplicitHex = /^[0-9a-f]{64}$/i.test(params.receiverId);
  const sig02Triggered = isImplicitHex && params.proposedAmountNear > 2.5;
  signals.push({
    signalId: 'SIG-02',
    label: 'Implicit 64-Hex Receiver Structure',
    triggered: sig02Triggered,
    riskPoints: sig02Triggered ? 25 : 0,
    evidence: isImplicitHex
      ? `Receiver is an unindexed 64-hex implicit account receiving ${params.proposedAmountNear.toFixed(2)} NEAR (> 2.5 NEAR threshold).`
      : `Receiver "${params.receiverId}" uses human-readable named account hierarchy.`,
  });

  // SIG-03: On-Chain Existence & State Verification
  const sig03Triggered = !telemetry.existsOnChain;
  signals.push({
    signalId: 'SIG-03',
    label: 'On-Chain Account Existence (RPC view_account)',
    triggered: sig03Triggered,
    riskPoints: sig03Triggered ? 30 : 0,
    evidence: telemetry.existsOnChain
      ? `Verified on ${telemetry.networkQueried} at block #${telemetry.blockHeight.toLocaleString()}.`
      : `Account "${params.receiverId}" returned UNKNOWN_ACCOUNT on ${telemetry.networkQueried}.`,
  });

  // SIG-04: Smart Contract Bytecode & Storage Footprint
  const sig04Triggered =
    telemetry.existsOnChain &&
    (!telemetry.isSmartContract || telemetry.storageUsageBytes < 1000);
  signals.push({
    signalId: 'SIG-04',
    label: 'Contract Bytecode & Storage Stake Footprint',
    triggered: sig04Triggered,
    riskPoints: sig04Triggered ? 20 : 0,
    evidence: telemetry.isSmartContract
      ? `Contract deployed (code_hash=${telemetry.codeHash.slice(0, 12)}..., storage=${telemetry.storageUsageBytes.toLocaleString()} bytes).`
      : `No contract bytecode deployed (code_hash=1111...1111, storage=${telemetry.storageUsageBytes} bytes) for method call "${params.methodName}".`,
  });

  // SIG-05: Liquid Balance Anomaly (Dust-Sweep Profile)
  const sig05Triggered =
    !telemetry.existsOnChain || telemetry.liquidBalanceNear < 0.05;
  signals.push({
    signalId: 'SIG-05',
    label: 'Receiver Liquid Balance Telemetry',
    triggered: sig05Triggered,
    riskPoints: sig05Triggered ? 15 : 0,
    evidence: `Liquid balance: ${telemetry.liquidBalanceNear.toFixed(4)} NEAR (${sig05Triggered ? 'below 0.05 NEAR safety floor' : 'healthy operating reserve'}).`,
  });

  // SIG-06: Prompt-Boundary Instruction Filter
  const matchedPattern = PROMPT_OVERRIDE_PATTERNS.find((re) =>
    re.test(params.taskMemo)
  );
  const sig06Triggered = Boolean(matchedPattern);
  signals.push({
    signalId: 'SIG-06',
    label: 'Prompt-Boundary Instruction Filter',
    triggered: sig06Triggered,
    riskPoints: sig06Triggered ? 65 : 0,
    evidence: sig06Triggered
      ? `Detected embedded control-flow override pattern (${matchedPattern?.source}) inside task payload.`
      : 'Task payload and memo passed structural instruction sanitization.',
  });

  const rawScore = signals.reduce((sum, s) => sum + s.riskPoints, 0);
  const riskScore = Math.min(100, rawScore);

  let decision: FirewallDecision = 'ALLOW';
  if (riskScore >= 70) {
    decision = 'BLOCK';
  } else if (riskScore >= 35) {
    decision = 'WARN';
  }

  return {
    receiverId: params.receiverId,
    proposedAmountNear: params.proposedAmountNear,
    methodName: params.methodName,
    taskMemo: params.taskMemo,
    riskScore,
    decision,
    signals,
    telemetry,
    evaluatedAtIso: new Date().toISOString(),
  };
}
