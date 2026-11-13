// VeriPact (ClawSwarm Nexus v2.0) — Authentic NEP-413 Borsh Off-Chain Message Signing,
// NEAR Borsh FunctionCallAction Wire Serializer, Scoped FunctionCall Key Guard & Hash-Chained Receipts

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// NEP-413 Domain Separation Tag: 2^31 + 413 = 2147484061 (0x8000019d)
export const NEP413_TAG_U32 = 2147484061;

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let num = 0n;
  for (let i = 0; i < bytes.length; i++) {
    num = (num << 8n) | BigInt(bytes[i]);
  }
  let result = '';
  while (num > 0n) {
    const rem = Number(num % 58n);
    result = BASE58_ALPHABET[rem] + result;
    num /= 58n;
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result = '1' + result;
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

export async function sha256Bytes(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf = new ArrayBuffer(encoded.byteLength);
  const view = new Uint8Array(buf);
  view.set(encoded);
  const digest = await sha256Bytes(view);
  return toHex(digest);
}

// Borsh Helper: u32 Little-Endian (4 bytes)
function writeU32LE(value: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, value >>> 0, true);
  return new Uint8Array(buf);
}

// Borsh Helper: u64 Little-Endian (8 bytes)
function writeU64LE(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, value, true);
  return new Uint8Array(buf);
}

// Borsh Helper: u128 Little-Endian (16 bytes)
function writeU128LE(value: bigint): Uint8Array {
  const out = new Uint8Array(16);
  let v = value;
  for (let i = 0; i < 16; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

// Borsh Helper: String (u32 length LE + UTF-8 bytes)
function writeBorshString(str: string): Uint8Array {
  const utf8 = new TextEncoder().encode(str);
  const lenBytes = writeU32LE(utf8.byteLength);
  const out = new Uint8Array(4 + utf8.byteLength);
  out.set(lenBytes, 0);
  out.set(utf8, 4);
  return out;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const buf = new ArrayBuffer(total);
  const out = new Uint8Array(buf);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export interface Nep413SignPayload {
  message: string;
  nonceHex: string; // 32-byte (64 hex chars)
  recipient: string;
  callbackUrl?: string;
}

/**
 * Serializes a NEP-413 message payload strictly according to NEAR NEP-413 Borsh specification:
 * 1. 4-byte LE tag: 2147484061 (2^31 + 413)
 * 2. Borsh String: message
 * 3. Fixed [u8; 32]: nonce
 * 4. Borsh String: recipient
 * 5. Borsh Option<String>: callbackUrl (0x00 if None, 0x01 + Borsh String if Some)
 */
export function serializeNep413Borsh(payload: Nep413SignPayload): Uint8Array<ArrayBuffer> {
  const tagBytes = writeU32LE(NEP413_TAG_U32);
  const msgBytes = writeBorshString(payload.message);
  const rawNonce = fromHex(payload.nonceHex.padEnd(64, '0').slice(0, 64));
  const nonce32 = new Uint8Array(32);
  nonce32.set(rawNonce.slice(0, 32));
  const recipientBytes = writeBorshString(payload.recipient);
  const callbackBytes = payload.callbackUrl
    ? concatBytes([new Uint8Array([1]), writeBorshString(payload.callbackUrl)])
    : new Uint8Array([0]);

  return concatBytes([
    tagBytes,
    msgBytes,
    nonce32,
    recipientBytes,
    callbackBytes,
  ]);
}

/**
 * Serializes a NEAR Protocol FunctionCallAction into exact Borsh binary wire format:
 * - discriminant u8 = 2 (Action::FunctionCall)
 * - method_name: Borsh String
 * - args: Borsh Vec<u8> (u32 len + JSON UTF-8 bytes)
 * - gas: u64 LE (default 30 TGas = 30_000_000_000_000)
 * - deposit: u128 LE (in yoctoNEAR)
 */
export function serializeNearFunctionCallActionBorsh(params: {
  methodName: string;
  argsJson: Record<string, unknown>;
  gasTgas?: number;
  attachedNear: number;
}): { borshHex: string; byteLength: number; gasUnits: string; depositYocto: string } {
  const discriminant = new Uint8Array([2]); // Action::FunctionCall index in NEAR runtime
  const methodBytes = writeBorshString(params.methodName);
  const argsUtf8 = new TextEncoder().encode(JSON.stringify(params.argsJson));
  const argsLen = writeU32LE(argsUtf8.byteLength);
  const gasUnitsBig = BigInt(Math.round((params.gasTgas ?? 30) * 1e12));
  const gasBytes = writeU64LE(gasUnitsBig);
  const depositYoctoBig =
    BigInt(Math.round(params.attachedNear * 1e6)) * BigInt('1000000000000000000');
  const depositBytes = writeU128LE(depositYoctoBig);

  const encoded = concatBytes([
    discriminant,
    methodBytes,
    argsLen,
    argsUtf8,
    gasBytes,
    depositBytes,
  ]);

  return {
    borshHex: toHex(encoded),
    byteLength: encoded.byteLength,
    gasUnits: gasUnitsBig.toString(),
    depositYocto: depositYoctoBig.toString(),
  };
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
  borshFunctionCallHex?: string;
}

export interface AgentEd25519Signer {
  accountId: string;
  publicKeyNear: string;
  publicKeyHex: string;
  permission: ScopedFunctionCallPermission;
  signMessage: (message: string) => Promise<string>;
  verifyMessage: (message: string, signatureHex: string) => Promise<boolean>;
  signNep413: (payload: Nep413SignPayload) => Promise<{
    borshPayloadHex: string;
    sha256DigestHex: string;
    signatureHex: string;
    publicKeyNear: string;
  }>;
  verifyNep413: (
    payload: Nep413SignPayload,
    signatureHex: string
  ) => Promise<boolean>;
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
  nep413NonceHex: string;
  nep413BorshHex: string;
  nep413DigestHex: string;
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
    async signNep413(payload: Nep413SignPayload) {
      const borshBytes = serializeNep413Borsh(payload);
      // NEP-413 standard hashes the Borsh-encoded payload with SHA-256 before Ed25519 signing
      const digestBytes = await sha256Bytes(borshBytes);
      const sigBuffer = await globalThis.crypto.subtle.sign(
        { name: 'Ed25519' },
        keyPair.privateKey,
        digestBytes
      );
      return {
        borshPayloadHex: toHex(borshBytes),
        sha256DigestHex: toHex(digestBytes),
        signatureHex: toHex(new Uint8Array(sigBuffer)),
        publicKeyNear,
      };
    },
    async verifyNep413(
      payload: Nep413SignPayload,
      signatureHex: string
    ): Promise<boolean> {
      try {
        const borshBytes = serializeNep413Borsh(payload);
        const digestBytes = await sha256Bytes(borshBytes);
        const sigBytes = fromHex(signatureHex);
        return await globalThis.crypto.subtle.verify(
          { name: 'Ed25519' },
          keyPair.publicKey,
          sigBytes,
          digestBytes
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

  const borshSerialized = serializeNearFunctionCallActionBorsh({
    methodName: action.methodName,
    argsJson: action.argsJson ?? {
      receiver_id: action.receiverId,
      attached_near: action.attachedNear,
    },
    attachedNear: action.attachedNear,
  });

  return {
    allowed: true,
    code: 'ALLOWED_FUNCTION_CALL',
    reason: `Verified FunctionCall ${action.receiverId}::${action.methodName} (${action.attachedNear.toFixed(4)} NEAR) within scoped key permissions.`,
    remainingAllowanceNear: Number(
      (permission.maxAllowanceNear - permission.spentNear).toFixed(6)
    ),
    borshFunctionCallHex: borshSerialized.borshHex,
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

  // Construct deterministic 32-byte NEP-413 nonce from sequence + prevReceiptHash
  const nep413NonceHex = (
    params.sequence.toString(16).padStart(8, '0') + params.prevReceiptHash.slice(0, 56)
  ).slice(0, 64);

  const nep413Result = await params.signer.signNep413({
    message: receiptHash,
    nonceHex: nep413NonceHex,
    recipient: params.signer.accountId,
  });

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
    nep413NonceHex,
    nep413BorshHex: nep413Result.borshPayloadHex,
    nep413DigestHex: nep413Result.sha256DigestHex,
    signatureHex: nep413Result.signatureHex,
    summary: params.summary,
    details: params.details,
  };
}
