// VeriPact (ClawSwarm Nexus v2.0) — Zero-Dependency YAML Config Parser & Policy Loader
// Reads config.yaml directly from disk so any constraint change by a judge or operator
// (killSwitchActive, maxDailySpendNear, maxSingleTaskNear, minGrossMarginPct, allowedMethods, etc.)
// is immediately enforced on the next run without recompilation.

import { DefaultBusinessPolicy, PolicyFileSchema } from './policy-types.js';

export function parseConfigYamlText(rawYaml: string): PolicyFileSchema {
  const result: PolicyFileSchema = structuredClone(DefaultBusinessPolicy);
  const lines = rawYaml.split(/\r?\n/);

  let section = '';
  let subsection = '';
  let inList = false;
  const parsedMethods: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();

    if (indent === 0 && trimmed.endsWith(':')) {
      section = trimmed.slice(0, -1).trim();
      subsection = '';
      inList = false;
      continue;
    }

    if (indent === 2 && trimmed.endsWith(':')) {
      subsection = trimmed.slice(0, -1).trim();
      inList = false;
      continue;
    }

    if (indent === 4 && trimmed.endsWith(':')) {
      const key = trimmed.slice(0, -1).trim();
      if (key === 'allowedMethods') {
        inList = true;
      }
      continue;
    }

    if (inList && trimmed.startsWith('-')) {
      const item = trimmed
        .slice(1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (item) parsedMethods.push(item);
      continue;
    }

    const kvMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
    if (!kvMatch) continue;
    const [, key, rawVal] = kvMatch;
    const cleanVal = rawVal.trim().replace(/^["']|["']$/g, '');

    if (section === 'agent') {
      if (key === 'accountId') result.agent.accountId = cleanVal;
      if (key === 'networkId') result.agent.networkId = cleanVal;
      if (key === 'rpcEndpoint') result.agent.rpcEndpoint = cleanVal;
      if (key === 'oneClickEndpoint') result.agent.oneClickEndpoint = cleanVal;
      if (key === 'nearAiEndpoint') result.agent.nearAiEndpoint = cleanVal;
    } else if (section === 'permissions' && subsection === 'scopedAccessKey') {
      if (key === 'receiverId') result.permissions.scopedAccessKey.receiverId = cleanVal;
      if (key === 'allowanceNear') {
        const n = Number(cleanVal);
        if (!Number.isNaN(n)) result.permissions.scopedAccessKey.allowanceNear = n;
      }
    } else if (section === 'businessPolicy') {
      if (subsection === 'revenueSplitBps') {
        const n = Number(cleanVal);
        if (!Number.isNaN(n)) {
          if (key === 'operatorTreasury')
            result.businessPolicy.revenueSplitBps.operatorTreasury = n;
          if (key === 'specialistSolverPool')
            result.businessPolicy.revenueSplitBps.specialistSolverPool = n;
          if (key === 'riskReserveVault')
            result.businessPolicy.revenueSplitBps.riskReserveVault = n;
        }
      } else {
        if (key === 'killSwitchActive') {
          result.businessPolicy.killSwitchActive =
            cleanVal.toLowerCase() === 'true';
        }
        const n = Number(cleanVal);
        if (!Number.isNaN(n)) {
          if (key === 'maxDailySpendNear')
            result.businessPolicy.maxDailySpendNear = n;
          if (key === 'maxSingleTaskNear')
            result.businessPolicy.maxSingleTaskNear = n;
          if (key === 'minGrossMarginPct')
            result.businessPolicy.minGrossMarginPct = n;
          if (key === 'negotiationDiscountTargetPct')
            result.businessPolicy.negotiationDiscountTargetPct = n;
          if (key === 'maxCounterOfferRounds')
            result.businessPolicy.maxCounterOfferRounds = n;
        }
      }
    } else if (section === 'securityFirewall') {
      const n = Number(cleanVal);
      if (!Number.isNaN(n)) {
        if (key === 'blockThresholdScore')
          result.securityFirewall.blockThresholdScore = n;
        if (key === 'warnThresholdScore')
          result.securityFirewall.warnThresholdScore = n;
        if (key === 'minVerifiedContractStorageBytes')
          result.securityFirewall.minVerifiedContractStorageBytes = n;
        if (key === 'requireExplicitNamedAccountAboveNear')
          result.securityFirewall.requireExplicitNamedAccountAboveNear = n;
      }
    }
  }

  if (parsedMethods.length > 0) {
    result.permissions.scopedAccessKey.allowedMethods = parsedMethods;
  }

  return result;
}
