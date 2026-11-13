// VeriPact (ClawSwarm Nexus v2.0) — 20-Buyer x 5-Seller NEP-413 Signed Commit-Reveal Swarm Clearinghouse
// Each of the 25 participants holds an independent Ed25519 keypair, commits SHA-256(bid || salt),
// signs the commitment via NEP-413 Borsh (tag 2147484061), and undergoes cryptographic reveal verification.

import {
  createScopedAgentSigner,
  sha256Hex,
} from './crypto-keys.js';

export interface SwarmBuyerBid {
  buyerId: string;
  subtaskCategory: string;
  unitsRequested: number;
  maxUnitPriceNear: number;
  salt: string;
}

export interface SwarmSellerAsk {
  sellerId: string;
  specialization: string;
  baseAskUnitPriceNear: number;
  floorUnitPriceNear: number;
  bulkDiscountBps: number; // Applied when >= 3 buyers pool demand
  maxCapacityUnits: number;
  reputationScore: number; // 0 - 100
  teeAttested: boolean;
  salt: string;
}

export interface CommitmentRecord {
  participantId: string;
  role: 'BUYER' | 'SELLER';
  publicKeyNear: string;
  commitmentHash: string;
  nep413SignatureHex: string;
  nep413Verified: boolean;
  revealed: boolean;
  revealVerified: boolean;
}

export interface BuyerAllocation {
  buyerId: string;
  publicKeyNear: string;
  unitsRequested: number;
  unitsFilled: number;
  maxUnitPriceNear: number;
  clearingUnitPriceNear: number;
  totalPaidNear: number;
  consumerSurplusNear: number;
  commitmentHash: string;
  nep413SignatureHex: string;
}

export interface SellerAllocation {
  sellerId: string;
  publicKeyNear: string;
  baseAskUnitPriceNear: number;
  effectiveAskUnitPriceNear: number;
  floorUnitPriceNear: number;
  maxCapacityUnits: number;
  unitsAwarded: number;
  grossRevenueNear: number;
  reputationScore: number;
  teeAttested: boolean;
  commitmentHash: string;
  nep413SignatureHex: string;
}

export interface SwarmAuctionResult {
  auctionId: string;
  subtaskCategory: string;
  totalBuyersSubmitted: number;
  totalSellersSubmitted: number;
  validCommitmentsVerified: number;
  validNep413SignaturesVerified: number;
  rejectedCommitments: number;
  demandPoolingActive: boolean;
  pooledDiscountBpsApplied: number;
  totalDemandUnits: number;
  totalSupplyUnits: number;
  totalClearedUnits: number;
  uniformClearingPriceNear: number;
  vickreyReferencePriceNear: number;
  totalMarketVolumeNear: number;
  totalBuyerSurplusNear: number;
  winningPrimarySellerId: string;
  runnerUpSellerId: string;
  commitments: CommitmentRecord[];
  buyerAllocations: BuyerAllocation[];
  sellerAllocations: SellerAllocation[];
}

export async function computeBidCommitment(params: {
  accountId: string;
  role: 'BUYER' | 'SELLER';
  unitPriceNear: number;
  quantity: number;
  salt: string;
}): Promise<string> {
  const canonical = `${params.accountId}|${params.role}|${params.unitPriceNear.toFixed(6)}|${params.quantity}|${params.salt}`;
  return await sha256Hex(canonical);
}

export function generateDefault20x5SwarmRoster(subtaskCategory = 'crosschain_intent_routing'): {
  buyers: SwarmBuyerBid[];
  sellers: SwarmSellerAsk[];
} {
  const buyers: SwarmBuyerBid[] = [];
  for (let i = 1; i <= 20; i++) {
    const maxUnitPriceNear = Number((0.68 - (i - 1) * 0.016).toFixed(4));
    const unitsRequested = (i % 3) + 1;
    buyers.push({
      buyerId: `buyer-${i}.swarm.testnet`,
      subtaskCategory,
      unitsRequested,
      maxUnitPriceNear,
      salt: `veripact-b${String(i).padStart(2, '0')}-seed-2026`,
    });
  }

  const sellers: SwarmSellerAsk[] = [
    {
      sellerId: 'seller-1.swarm.testnet',
      specialization: 'TEE Verifiable Solver & 1Click Router',
      baseAskUnitPriceNear: 0.42,
      floorUnitPriceNear: 0.355,
      bulkDiscountBps: 1000,
      maxCapacityUnits: 14,
      reputationScore: 98,
      teeAttested: true,
      salt: 'veripact-s01-tee-solver-2026',
    },
    {
      sellerId: 'seller-2.swarm.testnet',
      specialization: 'FastNEAR State Indexer & Liquidity Solver',
      baseAskUnitPriceNear: 0.44,
      floorUnitPriceNear: 0.37,
      bulkDiscountBps: 800,
      maxCapacityUnits: 12,
      reputationScore: 95,
      teeAttested: true,
      salt: 'veripact-s02-fastnear-2026',
    },
    {
      sellerId: 'seller-3.swarm.testnet',
      specialization: 'Cross-VM Settlement Relayer',
      baseAskUnitPriceNear: 0.47,
      floorUnitPriceNear: 0.405,
      bulkDiscountBps: 750,
      maxCapacityUnits: 10,
      reputationScore: 91,
      teeAttested: true,
      salt: 'veripact-s03-relayer-2026',
    },
    {
      sellerId: 'seller-4.swarm.testnet',
      specialization: 'Multi-Chain Arbitrage Quoter',
      baseAskUnitPriceNear: 0.52,
      floorUnitPriceNear: 0.45,
      bulkDiscountBps: 500,
      maxCapacityUnits: 10,
      reputationScore: 87,
      teeAttested: false,
      salt: 'veripact-s04-quoter-2026',
    },
    {
      sellerId: 'seller-5.swarm.testnet',
      specialization: 'High-Throughput Archive Validator',
      baseAskUnitPriceNear: 0.58,
      floorUnitPriceNear: 0.51,
      bulkDiscountBps: 500,
      maxCapacityUnits: 8,
      reputationScore: 84,
      teeAttested: false,
      salt: 'veripact-s05-archive-2026',
    },
  ];

  return { buyers, sellers };
}

export async function runSealedBidSwarmAuction(params: {
  auctionId: string;
  subtaskCategory: string;
  buyers: SwarmBuyerBid[];
  sellers: SwarmSellerAsk[];
  tamperedParticipantIds?: string[];
}): Promise<SwarmAuctionResult> {
  const tamperedSet = new Set(params.tamperedParticipantIds ?? []);
  const commitments: CommitmentRecord[] = [];
  const buyerMetaMap = new Map<
    string,
    { commitHash: string; pubKey: string; sigHex: string }
  >();
  const sellerMetaMap = new Map<
    string,
    { commitHash: string; pubKey: string; sigHex: string }
  >();

  // Phase 1 & 2: Each of the 20 Buyers and 5 Sellers generates an Ed25519 keypair,
  // signs its commitment via NEP-413, and submits plaintext reveal for verification.
  const validBuyers: SwarmBuyerBid[] = [];
  for (let idx = 0; idx < params.buyers.length; idx++) {
    const b = params.buyers[idx];
    const buyerSigner = await createScopedAgentSigner({
      accountId: b.buyerId,
      allowedReceivers: ['clearinghouse.veripact.near'],
      allowedMethods: ['submit_bid_commitment', 'reveal_bid'],
      maxAllowanceNear: 10,
      maxSingleCallNear: 5,
    });

    const commitHash = await computeBidCommitment({
      accountId: b.buyerId,
      role: 'BUYER',
      unitPriceNear: b.maxUnitPriceNear,
      quantity: b.unitsRequested,
      salt: b.salt,
    });

    const nonceHex = (idx + 1).toString(16).padStart(8, '0') + commitHash.slice(0, 56);
    const nep413Signed = await buyerSigner.signNep413({
      message: commitHash,
      nonceHex,
      recipient: 'clearinghouse.veripact.near',
    });

    const nep413Verified = await buyerSigner.verifyNep413(
      {
        message: commitHash,
        nonceHex,
        recipient: 'clearinghouse.veripact.near',
      },
      nep413Signed.signatureHex
    );

    const revealSalt = tamperedSet.has(b.buyerId) ? `${b.salt}-tampered` : b.salt;
    const recomputedHash = await computeBidCommitment({
      accountId: b.buyerId,
      role: 'BUYER',
      unitPriceNear: b.maxUnitPriceNear,
      quantity: b.unitsRequested,
      salt: revealSalt,
    });

    const verified = commitHash === recomputedHash && nep413Verified;
    commitments.push({
      participantId: b.buyerId,
      role: 'BUYER',
      publicKeyNear: buyerSigner.publicKeyNear,
      commitmentHash: commitHash,
      nep413SignatureHex: nep413Signed.signatureHex,
      nep413Verified,
      revealed: true,
      revealVerified: verified,
    });
    buyerMetaMap.set(b.buyerId, {
      commitHash,
      pubKey: buyerSigner.publicKeyNear,
      sigHex: nep413Signed.signatureHex,
    });
    if (verified) validBuyers.push(b);
  }

  const validSellers: SwarmSellerAsk[] = [];
  for (let idx = 0; idx < params.sellers.length; idx++) {
    const s = params.sellers[idx];
    const sellerSigner = await createScopedAgentSigner({
      accountId: s.sellerId,
      allowedReceivers: ['clearinghouse.veripact.near'],
      allowedMethods: ['submit_ask_commitment', 'reveal_ask'],
      maxAllowanceNear: 10,
      maxSingleCallNear: 5,
    });

    const commitHash = await computeBidCommitment({
      accountId: s.sellerId,
      role: 'SELLER',
      unitPriceNear: s.baseAskUnitPriceNear,
      quantity: s.maxCapacityUnits,
      salt: s.salt,
    });

    const nonceHex = (idx + 101).toString(16).padStart(8, '0') + commitHash.slice(0, 56);
    const nep413Signed = await sellerSigner.signNep413({
      message: commitHash,
      nonceHex,
      recipient: 'clearinghouse.veripact.near',
    });

    const nep413Verified = await sellerSigner.verifyNep413(
      {
        message: commitHash,
        nonceHex,
        recipient: 'clearinghouse.veripact.near',
      },
      nep413Signed.signatureHex
    );

    const revealSalt = tamperedSet.has(s.sellerId) ? `${s.salt}-tampered` : s.salt;
    const recomputedHash = await computeBidCommitment({
      accountId: s.sellerId,
      role: 'SELLER',
      unitPriceNear: s.baseAskUnitPriceNear,
      quantity: s.maxCapacityUnits,
      salt: revealSalt,
    });

    const verified = commitHash === recomputedHash && nep413Verified;
    commitments.push({
      participantId: s.sellerId,
      role: 'SELLER',
      publicKeyNear: sellerSigner.publicKeyNear,
      commitmentHash: commitHash,
      nep413SignatureHex: nep413Signed.signatureHex,
      nep413Verified,
      revealed: true,
      revealVerified: verified,
    });
    sellerMetaMap.set(s.sellerId, {
      commitHash,
      pubKey: sellerSigner.publicKeyNear,
      sigHex: nep413Signed.signatureHex,
    });
    if (verified) validSellers.push(s);
  }

  const demandPoolingActive = validBuyers.length >= 3;

  const sortedBuyers = [...validBuyers].sort((a, b) => {
    if (b.maxUnitPriceNear !== a.maxUnitPriceNear) {
      return b.maxUnitPriceNear - a.maxUnitPriceNear;
    }
    return (buyerMetaMap.get(a.buyerId)?.commitHash ?? '').localeCompare(
      buyerMetaMap.get(b.buyerId)?.commitHash ?? ''
    );
  });

  const sellersWithEffective = validSellers.map((s) => {
    const discountFactor = demandPoolingActive ? 1 - s.bulkDiscountBps / 10000 : 1;
    const effectiveAskUnitPriceNear = Number(
      (s.baseAskUnitPriceNear * discountFactor).toFixed(4)
    );
    const meta = sellerMetaMap.get(s.sellerId);
    return {
      ...s,
      effectiveAskUnitPriceNear,
      commitmentHash: meta?.commitHash ?? '',
      publicKeyNear: meta?.pubKey ?? '',
      nep413SignatureHex: meta?.sigHex ?? '',
    };
  });

  sellersWithEffective.sort((a, b) => {
    if (a.effectiveAskUnitPriceNear !== b.effectiveAskUnitPriceNear) {
      return a.effectiveAskUnitPriceNear - b.effectiveAskUnitPriceNear;
    }
    if (b.reputationScore !== a.reputationScore) {
      return b.reputationScore - a.reputationScore;
    }
    return a.commitmentHash.localeCompare(b.commitmentHash);
  });

  const totalDemandUnits = sortedBuyers.reduce((sum, b) => sum + b.unitsRequested, 0);
  const totalSupplyUnits = sellersWithEffective.reduce(
    (sum, s) => sum + s.maxCapacityUnits,
    0
  );

  const unitDemands: Array<{ buyerId: string; reservationPrice: number }> = [];
  for (const b of sortedBuyers) {
    for (let u = 0; u < b.unitsRequested; u++) {
      unitDemands.push({ buyerId: b.buyerId, reservationPrice: b.maxUnitPriceNear });
    }
  }

  const unitSupplies: Array<{ sellerId: string; effectiveAsk: number }> = [];
  for (const s of sellersWithEffective) {
    for (let u = 0; u < s.maxCapacityUnits; u++) {
      unitSupplies.push({
        sellerId: s.sellerId,
        effectiveAsk: s.effectiveAskUnitPriceNear,
      });
    }
  }

  const maxMatchable = Math.min(unitDemands.length, unitSupplies.length);
  let clearedUnits = 0;
  for (let k = 0; k < maxMatchable; k++) {
    if (unitDemands[k].reservationPrice >= unitSupplies[k].effectiveAsk) {
      clearedUnits++;
    } else {
      break;
    }
  }

  const marginalBuyerPrice =
    clearedUnits > 0 ? unitDemands[clearedUnits - 1].reservationPrice : 0;
  const marginalSellerAsk =
    clearedUnits > 0 ? unitSupplies[clearedUnits - 1].effectiveAsk : 0;
  const nextExcludedSellerAsk =
    clearedUnits < unitSupplies.length
      ? unitSupplies[clearedUnits].effectiveAsk
      : marginalBuyerPrice;

  const vickreyReferencePriceNear = Number(
    Math.min(marginalBuyerPrice, nextExcludedSellerAsk).toFixed(4)
  );
  const uniformClearingPriceNear =
    clearedUnits > 0
      ? Number(
          Math.min(
            marginalBuyerPrice,
            (marginalSellerAsk + vickreyReferencePriceNear) / 2
          ).toFixed(4)
        )
      : 0;

  const buyerFilledCounts = new Map<string, number>();
  const sellerAwardedCounts = new Map<string, number>();
  for (let k = 0; k < clearedUnits; k++) {
    const bId = unitDemands[k].buyerId;
    const sId = unitSupplies[k].sellerId;
    buyerFilledCounts.set(bId, (buyerFilledCounts.get(bId) ?? 0) + 1);
    sellerAwardedCounts.set(sId, (sellerAwardedCounts.get(sId) ?? 0) + 1);
  }

  const buyerAllocations: BuyerAllocation[] = sortedBuyers.map((b) => {
    const unitsFilled = buyerFilledCounts.get(b.buyerId) ?? 0;
    const totalPaidNear = Number((unitsFilled * uniformClearingPriceNear).toFixed(4));
    const consumerSurplusNear = Number(
      (unitsFilled * (b.maxUnitPriceNear - uniformClearingPriceNear)).toFixed(4)
    );
    const meta = buyerMetaMap.get(b.buyerId);
    return {
      buyerId: b.buyerId,
      publicKeyNear: meta?.pubKey ?? '',
      unitsRequested: b.unitsRequested,
      unitsFilled,
      maxUnitPriceNear: b.maxUnitPriceNear,
      clearingUnitPriceNear: uniformClearingPriceNear,
      totalPaidNear,
      consumerSurplusNear,
      commitmentHash: meta?.commitHash ?? '',
      nep413SignatureHex: meta?.sigHex ?? '',
    };
  });

  const sellerAllocations: SellerAllocation[] = sellersWithEffective.map((s) => {
    const unitsAwarded = sellerAwardedCounts.get(s.sellerId) ?? 0;
    const grossRevenueNear = Number((unitsAwarded * uniformClearingPriceNear).toFixed(4));
    return {
      sellerId: s.sellerId,
      publicKeyNear: s.publicKeyNear,
      baseAskUnitPriceNear: s.baseAskUnitPriceNear,
      effectiveAskUnitPriceNear: s.effectiveAskUnitPriceNear,
      floorUnitPriceNear: s.floorUnitPriceNear,
      maxCapacityUnits: s.maxCapacityUnits,
      unitsAwarded,
      grossRevenueNear,
      reputationScore: s.reputationScore,
      teeAttested: s.teeAttested,
      commitmentHash: s.commitmentHash,
      nep413SignatureHex: s.nep413SignatureHex,
    };
  });

  const totalMarketVolumeNear = Number(
    (clearedUnits * uniformClearingPriceNear).toFixed(4)
  );
  const totalBuyerSurplusNear = Number(
    buyerAllocations.reduce((sum, b) => sum + b.consumerSurplusNear, 0).toFixed(4)
  );

  const winningPrimarySellerId =
    sellersWithEffective[0]?.sellerId ?? 'seller-1.swarm.testnet';
  const runnerUpSellerId =
    sellersWithEffective[1]?.sellerId ?? 'seller-2.swarm.testnet';
  const pooledDiscountBpsApplied = demandPoolingActive
    ? (sellersWithEffective[0]?.bulkDiscountBps ?? 0)
    : 0;

  return {
    auctionId: params.auctionId,
    subtaskCategory: params.subtaskCategory,
    totalBuyersSubmitted: params.buyers.length,
    totalSellersSubmitted: params.sellers.length,
    validCommitmentsVerified: commitments.filter((c) => c.revealVerified).length,
    validNep413SignaturesVerified: commitments.filter((c) => c.nep413Verified).length,
    rejectedCommitments: commitments.filter((c) => !c.revealVerified).length,
    demandPoolingActive,
    pooledDiscountBpsApplied,
    totalDemandUnits,
    totalSupplyUnits,
    totalClearedUnits: clearedUnits,
    uniformClearingPriceNear,
    vickreyReferencePriceNear,
    totalMarketVolumeNear,
    totalBuyerSurplusNear,
    winningPrimarySellerId,
    runnerUpSellerId,
    commitments,
    buyerAllocations,
    sellerAllocations,
  };
}
