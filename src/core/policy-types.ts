// VeriPact (ClawSwarm Nexus v2.0) — Shared Policy & Config Schema Types

export interface PolicyFileSchema {
  agent: {
    accountId: string;
    networkId: string;
    rpcEndpoint: string;
    oneClickEndpoint: string;
    nearAiEndpoint: string;
  };
  permissions: {
    scopedAccessKey: {
      receiverId: string;
      allowanceNear: number;
      allowedMethods: string[];
    };
  };
  businessPolicy: {
    killSwitchActive: boolean;
    maxDailySpendNear: number;
    maxSingleTaskNear: number;
    minGrossMarginPct: number;
    negotiationDiscountTargetPct: number;
    maxCounterOfferRounds: number;
    revenueSplitBps: {
      operatorTreasury: number;
      specialistSolverPool: number;
      riskReserveVault: number;
    };
  };
  securityFirewall: {
    blockThresholdScore: number;
    warnThresholdScore: number;
    minVerifiedContractStorageBytes: number;
    requireExplicitNamedAccountAboveNear: number;
  };
}

export const DefaultBusinessPolicy: PolicyFileSchema = {
  agent: {
    accountId: 'contractor.veripact.near',
    networkId: 'mainnet',
    rpcEndpoint: 'https://free.rpc.fastnear.com',
    oneClickEndpoint: 'https://1click.chaindefuser.com',
    nearAiEndpoint: 'https://cloud-api.near.ai/v1/models',
  },
  permissions: {
    scopedAccessKey: {
      receiverId: 'intents.near',
      allowanceNear: 25.0,
      allowedMethods: [
        'ft_transfer_call',
        'execute_intent',
        'settle_batch',
        'storage_deposit',
      ],
    },
  },
  businessPolicy: {
    killSwitchActive: false,
    maxDailySpendNear: 50.0,
    maxSingleTaskNear: 12.0,
    minGrossMarginPct: 18.0,
    negotiationDiscountTargetPct: 12.0,
    maxCounterOfferRounds: 1,
    revenueSplitBps: {
      operatorTreasury: 7000,
      specialistSolverPool: 2000,
      riskReserveVault: 1000,
    },
  },
  securityFirewall: {
    blockThresholdScore: 70,
    warnThresholdScore: 35,
    minVerifiedContractStorageBytes: 1000,
    requireExplicitNamedAccountAboveNear: 2.5,
  },
};
