// ClawSwarm Nexus — Real WebCrypto Ed25519 Keypair, NEAR Base58 Encoding,
// Scoped FunctionCall Permission Guard & Hash-Chained Signed Receipts

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros++;
  }
  let result = '1'.repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const buf = new ArrayBuffer(clean.length / 2);
  const out = new Uint8Array(buf);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

export type NearActionType =
  | 'FunctionCall'
  | 'Transfer'
  | 'AddKey'
  | 'DeleteKey'
  | 'DeleteAccount'
  | 'DeployContract'
  | 'Stake';

export interface ScopedFunctionCallPermission {
  keyId: string;
  publicKeyNear: string;
  allowedReceivers: string[];
  allowedMethods: string[];
  maxAllowanceNear: number;
  maxSingleCallNear: number;
  spentNear: number;
}

export interface ProposedAgentAction {
  actionType: NearActionType;
  receiverId: string;
  methodName?: string;
  argsJson?: Record<string, unknown>;
  attachedNear: number;
}

export interface KeyGuardVerdict {
  allowed: boolean;
  code:
    | 'ALLOWED_FUNCTION_CALL'
    | 'ERR_ACTION_NOT_FUNCTION_CALL'
    | 'ERR_RECEIVER_OUT_OF_SCOPE'
    | 'ERR_METHOD_NOT_ALLOWLISTED'
    | 'ERR_SINGLE_CALL_LIMIT_EXCEEDED'
    | 'ERR_ALLOWANCE_EXHAUSTED';
  reason: string;
  remainingAllowanceNear: number;
}

export interface AgentEd25519Signer {
  accountId: string;
  publicKeyNear: string;
  publicKeyHex: string;
  permission: ScopedFunctionCallPermission;
  signMessage: (message: string) => Promise<string>;
  verifyMessage: (message: string, signatureHex: string) => Promise<boolean>;
}

export interface SignedExecutionReceipt {
  receiptId: string;
  sequence: number;
  timestampIso: string;
  stage:
    | 'TASK_DECOMPOSITION'
    | 'SWARM_AUCTION_CLEAR'
    | 'COUNTER_OFFER_NEGOTIATION'
    | 'FIREWALL_PREFLIGHT'
    | 'ONECLICK_SETTLEMENT_QUOTE'
    | 'REVENUE_DISTRIBUTION'
    | 'BOUNDARY_GUARD_REJECTION';
  actorAccountId: string;
  publicKeyNear: string;
  prevReceiptHash: string;
  payloadHash: string;
  receiptHash: string;
  signatureHex: string;
  summary: string;
  details: Record<string, unknown>;
}

export async function createScopedAgentSigner(params: {
  accountId: string;
  allowedReceivers: string[];
  allowedMethods: string[];
  maxAllowanceNear: number;
  maxSingleCallNear: number;
}): Promise<AgentEd25519Signer> {
  const keyPair = (await globalThis.crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;

  const rawPub = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey)
  );
  const publicKeyNear = `ed25519:${encodeBase58(rawPub)}`;
  const publicKeyHex = toHex(rawPub);

  const permission: ScopedFunctionCallPermission = {
    keyId: `fck-${publicKeyHex.slice(0, 12)}`,
    publicKeyNear,
    allowedReceivers: [...params.allowedReceivers],
    allowedMethods: [...params.allowedMethods],
    maxAllowanceNear: params.maxAllowanceNear,
    maxSingleCallNear: params.maxSingleCallNear,
    spentNear: 0,
  };

  return {
    accountId: params.accountId,
    publicKeyNear,
    publicKeyHex,
    permission,
    async signMessage(message: string): Promise<string> {
      const encoded = new TextEncoder().encode(message);
      const sigBuffer = await globalThis.crypto.subtle.sign(
        { name: 'Ed25519' },
        keyPair.privateKey,
        encoded
      );
      return toHex(new Uint8Array(sigBuffer));
    },
    async verifyMessage(message: string, signatureHex: string): Promise<boolean> {
      try {
        const encoded = new TextEncoder().encode(message);
        const sigBytes = fromHex(signatureHex);
        return await globalThis.crypto.subtle.verify(
          { name: 'Ed25519' },
          keyPair.publicKey,
          sigBytes,
          encoded
        );
      } catch {
        return false;
      }
    },
  };
}

export function enforceFunctionCallPermission(
  permission: ScopedFunctionCallPermission,
  action: ProposedAgentAction,
  commitSpend = false
): KeyGuardVerdict {
  const remainingBefore = Number(
    (permission.maxAllowanceNear - permission.spentNear).toFixed(6)
  );

  // 1. Structural NEAR Access Key Action Type Check
  if (action.actionType !== 'FunctionCall') {
    return {
      allowed: false,
      code: 'ERR_ACTION_NOT_FUNCTION_CALL',
      reason: `Scoped FunctionCall key (${permission.publicKeyNear.slice(0, 20)}...) structurally forbids native ${action.actionType} actions on NEAR.`,
      remainingAllowanceNear: remainingBefore,
    };
  }

  // 2. Receiver Account Scope Check
  const receiverMatches = permission.allowedReceivers.some((pattern) => {
    if (pattern.startsWith('*.')) {
      return action.receiverId.endsWith(pattern.slice(1));
    }
    return action.receiverId === pattern;
  });

  if (!receiverMatches) {
    return {
      allowed: false,
      code: 'ERR_RECEIVER_OUT_OF_SCOPE',
      reason: `Target receiver "${action.receiverId}" is outside scoped key receiver allowlist [${permission.allowedReceivers.join(', ')}].`,
      remainingAllowanceNear: remainingBefore,
    };
  }

  // 3. Method Name Allowlist Check
  if (!action.methodName || !permission.allowedMethods.includes(action.methodName)) {
    return {
      allowed: false,
      code: 'ERR_METHOD_NOT_ALLOWLISTED',
      reason: `Method "${action.methodName ?? '<empty>'}" is not permitted by FunctionCall key allowlist [${permission.allowedMethods.join(', ')}].`,
      remainingAllowanceNear: remainingBefore,
    };
  }

  // 4. Per-Call Spend Limit Check
  if (action.attachedNear > permission.maxSingleCallNear) {
    return {
      allowed: false,
      code: 'ERR_SINGLE_CALL_LIMIT_EXCEEDED',
      reason: `Attached amount ${action.attachedNear.toFixed(4)} NEAR exceeds single-call ceiling ${permission.maxSingleCallNear.toFixed(4)} NEAR.`,
      remainingAllowanceNear: remainingBefore,
    };
  }

  // 5. Cumulative Key Allowance Check
  if (permission.spentNear + action.attachedNear > permission.maxAllowanceNear + 1e-9) {
    return {
      allowed: false,
      code: 'ERR_ALLOWANCE_EXHAUSTED',
      reason: `Attached amount ${action.attachedNear.toFixed(4)} NEAR exceeds remaining FunctionCall allowance ${remainingBefore.toFixed(4)} NEAR.`,
      remainingAllowanceNear: remainingBefore,
    };
  }

  if (commitSpend) {
    permission.spentNear = Number((permission.spentNear + action.attachedNear).toFixed(6));
  }

  return {
    allowed: true,
    code: 'ALLOWED_FUNCTION_CALL',
    reason: `Verified FunctionCall ${action.receiverId}::${action.methodName} (${action.attachedNear.toFixed(4)} NEAR) within scoped key permissions.`,
    remainingAllowanceNear: Number(
      (permission.maxAllowanceNear - permission.spentNear).toFixed(6)
    ),
  };
}

export async function createSignedReceipt(params: {
  signer: AgentEd25519Signer;
  sequence: number;
  prevReceiptHash: string;
  stage: SignedExecutionReceipt['stage'];
  summary: string;
  details: Record<string, unknown>;
  timestampIso?: string;
}): Promise<SignedExecutionReceipt> {
  const timestampIso = params.timestampIso ?? new Date().toISOString();
  const payloadCanonical = JSON.stringify({
    sequence: params.sequence,
    stage: params.stage,
    actorAccountId: params.signer.accountId,
    summary: params.summary,
    details: params.details,
  });
  const payloadHash = await sha256Hex(payloadCanonical);
  const preimage = `${params.sequence}|${timestampIso}|${params.stage}|${params.signer.accountId}|${params.prevReceiptHash}|${payloadHash}`;
  const receiptHash = await sha256Hex(preimage);
  const signatureHex = await params.signer.signMessage(receiptHash);

  return {
    receiptId: `rcpt-${String(params.sequence).padStart(3, '0')}-${receiptHash.slice(0, 10)}`,
    sequence: params.sequence,
    timestampIso,
    stage: params.stage,
    actorAccountId: params.signer.accountId,
    publicKeyNear: params.signer.publicKeyNear,
    prevReceiptHash: params.prevReceiptHash,
    payloadHash,
    receiptHash,
    signatureHex,
    summary: params.summary,
    details: params.details,
  };
}
