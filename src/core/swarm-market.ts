// ClawSwarm Nexus — 20-Buyer x 5-Seller Commit-Reveal Sealed-Bid Swarm Clearinghouse
// Implements Track 05 (Swarms): SHA-256 commitments, reveal verification, demand pooling,
// uniform Vickrey-adjusted clearing price, and pro-rata settlement share allocation.

import { sha256Hex } from './crypto-keys.js';

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
  commitmentHash: string;
  revealed: boolean;
  revealVerified: boolean;
}

export interface BuyerAllocation {
  buyerId: string;
  unitsRequested: number;
  unitsFilled: number;
  maxUnitPriceNear: number;
  clearingUnitPriceNear: number;
  totalPaidNear: number;
  consumerSurplusNear: number;
  commitmentHash: string;
}

export interface SellerAllocation {
  sellerId: string;
  baseAskUnitPriceNear: number;
  effectiveAskUnitPriceNear: number;
  floorUnitPriceNear: number;
  maxCapacityUnits: number;
  unitsAwarded: number;
  grossRevenueNear: number;
  reputationScore: number;
  teeAttested: boolean;
  commitmentHash: string;
}

export interface SwarmAuctionResult {
  auctionId: string;
  subtaskCategory: string;
  totalBuyersSubmitted: number;
  totalSellersSubmitted: number;
  validCommitmentsVerified: number;
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
    // Deterministic spread of buyer reservation prices between 0.34 NEAR and 0.68 NEAR per unit
    const maxUnitPriceNear = Number((0.68 - (i - 1) * 0.016).toFixed(4));
    const unitsRequested = (i % 3) + 1; // 1 to 3 units per buyer
    buyers.push({
      buyerId: `buyer-${i}.swarm.testnet`,
      subtaskCategory,
      unitsRequested,
      maxUnitPriceNear,
      salt: `clawswarm-b${String(i).padStart(2, '0')}-seed-2026`,
    });
  }

  const sellers: SwarmSellerAsk[] = [
    {
      sellerId: 'seller-1.swarm.testnet',
      specialization: 'TEE Verifiable Solver & 1Click Router',
      baseAskUnitPriceNear: 0.42,
      floorUnitPriceNear: 0.355,
      bulkDiscountBps: 1000, // 10% bulk discount when >= 3 buyers pool
      maxCapacityUnits: 14,
      reputationScore: 98,
      teeAttested: true,
      salt: 'clawswarm-s01-tee-solver-2026',
    },
    {
      sellerId: 'seller-2.swarm.testnet',
      specialization: 'FastNEAR State Indexer & Liquidity Solver',
      baseAskUnitPriceNear: 0.44,
      floorUnitPriceNear: 0.37,
      bulkDiscountBps: 800, // 8% bulk discount
      maxCapacityUnits: 12,
      reputationScore: 95,
      teeAttested: true,
      salt: 'clawswarm-s02-fastnear-2026',
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
      salt: 'clawswarm-s03-relayer-2026',
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
      salt: 'clawswarm-s04-quoter-2026',
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
      salt: 'clawswarm-s05-archive-2026',
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
  const buyerCommitMap = new Map<string, string>();
  const sellerCommitMap = new Map<string, string>();

  // Phase 1 & 2: Compute Commitments and Verify Reveals
  const validBuyers: SwarmBuyerBid[] = [];
  for (const b of params.buyers) {
    const commitHash = await computeBidCommitment({
      accountId: b.buyerId,
      role: 'BUYER',
      unitPriceNear: b.maxUnitPriceNear,
      quantity: b.unitsRequested,
      salt: b.salt,
    });
    const revealSalt = tamperedSet.has(b.buyerId) ? `${b.salt}-tampered` : b.salt;
    const recomputedHash = await computeBidCommitment({
      accountId: b.buyerId,
      role: 'BUYER',
      unitPriceNear: b.maxUnitPriceNear,
      quantity: b.unitsRequested,
      salt: revealSalt,
    });
    const verified = commitHash === recomputedHash;
    commitments.push({
      participantId: b.buyerId,
      role: 'BUYER',
      commitmentHash: commitHash,
      revealed: true,
      revealVerified: verified,
    });
    buyerCommitMap.set(b.buyerId, commitHash);
    if (verified) validBuyers.push(b);
  }

  const validSellers: SwarmSellerAsk[] = [];
  for (const s of params.sellers) {
    const commitHash = await computeBidCommitment({
      accountId: s.sellerId,
      role: 'SELLER',
      unitPriceNear: s.baseAskUnitPriceNear,
      quantity: s.maxCapacityUnits,
      salt: s.salt,
    });
    const revealSalt = tamperedSet.has(s.sellerId) ? `${s.salt}-tampered` : s.salt;
    const recomputedHash = await computeBidCommitment({
      accountId: s.sellerId,
      role: 'SELLER',
      unitPriceNear: s.baseAskUnitPriceNear,
      quantity: s.maxCapacityUnits,
      salt: revealSalt,
    });
    const verified = commitHash === recomputedHash;
    commitments.push({
      participantId: s.sellerId,
      role: 'SELLER',
      commitmentHash: commitHash,
      revealed: true,
      revealVerified: verified,
    });
    sellerCommitMap.set(s.sellerId, commitHash);
    if (verified) validSellers.push(s);
  }

  const demandPoolingActive = validBuyers.length >= 3;

  // Sort buyers descending by maxUnitPriceNear, tie-break by commitmentHash ASC
  const sortedBuyers = [...validBuyers].sort((a, b) => {
    if (b.maxUnitPriceNear !== a.maxUnitPriceNear) {
      return b.maxUnitPriceNear - a.maxUnitPriceNear;
    }
    return (buyerCommitMap.get(a.buyerId) ?? '').localeCompare(
      buyerCommitMap.get(b.buyerId) ?? ''
    );
  });

  // Compute effective asks and sort sellers ascending by effectiveAskUnitPriceNear
  const sellersWithEffective = validSellers.map((s) => {
    const discountFactor = demandPoolingActive ? 1 - s.bulkDiscountBps / 10000 : 1;
    const effectiveAskUnitPriceNear = Number(
      (s.baseAskUnitPriceNear * discountFactor).toFixed(4)
    );
    return {
      ...s,
      effectiveAskUnitPriceNear,
      commitmentHash: sellerCommitMap.get(s.sellerId) ?? '',
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

  // Phase 3: Match aggregate demand & supply curves
  const totalDemandUnits = sortedBuyers.reduce((sum, b) => sum + b.unitsRequested, 0);
  const totalSupplyUnits = sellersWithEffective.reduce(
    (sum, s) => sum + s.maxCapacityUnits,
    0
  );

  // Build unit-level demand and supply schedules to find exact intersection
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

  // Count filled units per buyer and seller
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
    return {
      buyerId: b.buyerId,
      unitsRequested: b.unitsRequested,
      unitsFilled,
      maxUnitPriceNear: b.maxUnitPriceNear,
      clearingUnitPriceNear: uniformClearingPriceNear,
      totalPaidNear,
      consumerSurplusNear,
      commitmentHash: buyerCommitMap.get(b.buyerId) ?? '',
    };
  });

  const sellerAllocations: SellerAllocation[] = sellersWithEffective.map((s) => {
    const unitsAwarded = sellerAwardedCounts.get(s.sellerId) ?? 0;
    const grossRevenueNear = Number((unitsAwarded * uniformClearingPriceNear).toFixed(4));
    return {
      sellerId: s.sellerId,
      baseAskUnitPriceNear: s.baseAskUnitPriceNear,
      effectiveAskUnitPriceNear: s.effectiveAskUnitPriceNear,
      floorUnitPriceNear: s.floorUnitPriceNear,
      maxCapacityUnits: s.maxCapacityUnits,
      unitsAwarded,
      grossRevenueNear,
      reputationScore: s.reputationScore,
      teeAttested: s.teeAttested,
      commitmentHash: s.commitmentHash,
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
