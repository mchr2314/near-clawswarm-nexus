// ClawSwarm Nexus — CLI End-to-End Live Telemetry & Execution Demo
// Runs the complete Contractor Agent + 20x5 Sealed-Bid Swarm + Live RPC Firewall + 1Click Quote loop

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runContractorWorkflow } from '../core/contractor-agent.js';

async function main() {
  console.log('========================================================================');
  console.log(' CLAWSWARM NEXUS — VERIFIABLE CONTRACTOR AGENT & SWARM CLEARINGHOUSE');
  console.log('========================================================================');

  const startMs = Date.now();
  const report = await runContractorWorkflow();
  const elapsedMs = Date.now() - startMs;

  console.log(`\n[1] Agent Identity & Scoped FunctionCall Key:`);
  console.log(`    Account ID       : ${report.agentAccountId}`);
  console.log(`    Public Key (NEAR): ${report.agentPublicKeyNear}`);
  console.log(`    NEAR.AI Catalog  : ${report.nearAiTelemetry.totalModels} models (${report.nearAiTelemetry.confidentialTeeModels} TEE Confidential / ${report.nearAiTelemetry.standardProxyModels} Proxy) [${report.nearAiTelemetry.source}]`);

  console.log(`\n[2] 20-Buyer x 5-Seller Commit-Reveal Sealed-Bid Swarm Market:`);
  console.log(`    Commitments Valid: ${report.swarmAuction.validCommitmentsVerified}/${report.swarmAuction.totalBuyersSubmitted + report.swarmAuction.totalSellersSubmitted} SHA-256 commitments verified`);
  console.log(`    Demand Pooling   : ${report.swarmAuction.demandPoolingActive ? 'ACTIVE' : 'INACTIVE'} (${report.swarmAuction.pooledDiscountBpsApplied} bps bulk solver discount unlocked)`);
  console.log(`    Cleared Volume   : ${report.swarmAuction.totalClearedUnits} units @ Uniform Clearing Price ${report.swarmAuction.uniformClearingPriceNear.toFixed(4)} NEAR/unit`);
  console.log(`    Vickrey Reference: ${report.swarmAuction.vickreyReferencePriceNear.toFixed(4)} NEAR/unit | Buyer Surplus Saved: ${report.swarmAuction.totalBuyerSurplusNear.toFixed(4)} NEAR`);

  console.log(`\n[3] Make-vs-Buy & Single-Round Counter-Offer Negotiation (4 Subtasks):`);
  for (const n of report.negotiations) {
    console.log(
      `    - [${n.subtaskId}] ${n.outcome.padEnd(24)} | Selected: ${n.finalSelectedSellerId.padEnd(28)} | Cost: ${n.finalTotalCostNear.toFixed(4)} NEAR (Saved: ${n.savingsVsInitialNear.toFixed(4)} NEAR)`
    );
  }

  console.log(`\n[4] Live NEAR RPC Counterparty Risk Scorer & Scoped Key Guard:`);
  for (let i = 0; i < report.firewallAssessments.length; i++) {
    const fw = report.firewallAssessments[i];
    const kg = report.keyGuardVerdicts[i];
    console.log(
      `    - Receiver: ${fw.receiverId.padEnd(22)} | Risk Score: ${String(fw.riskScore).padStart(2)}/100 (${fw.decision}) | RPC Balance: ${fw.telemetry.liquidBalanceNear.toFixed(2)} NEAR | Key Guard: ${kg.code}`
    );
  }

  console.log(`\n[5] Live NEAR Intents 1Click Cross-Chain Dry Quotes:`);
  for (const q of report.oneClickQuotes) {
    console.log(
      `    - [${q.routeId}] ${q.amountInNear.toFixed(4)} wNEAR -> ${q.amountOutFormatted} USDC (${q.destinationChain.toUpperCase()}) | HTTP ${q.httpStatus} | Correlation: ${q.correlationId} [${q.source}]`
    );
  }

  console.log(`\n[6] Autonomous Business Ledger & 70/20/10 Revenue Distribution:`);
  console.log(`    Gross Client Budget : ${report.ledger.clientGrossBudgetNear.toFixed(4)} NEAR`);
  console.log(`    Total Solver Spend  : ${report.ledger.totalSubtaskSpendNear.toFixed(4)} NEAR`);
  console.log(`    Net Operating Profit: ${report.ledger.netOperatingProfitNear.toFixed(4)} NEAR (Margin: ${report.ledger.grossMarginPct.toFixed(2)}%)`);
  console.log(`    -> 70% Operator Treasury : ${report.ledger.distributions.operatorTreasuryNear.toFixed(4)} NEAR`);
  console.log(`    -> 20% Solver Rebate Pool: ${report.ledger.distributions.specialistSolverPoolNear.toFixed(4)} NEAR`);
  console.log(`    -> 10% Risk Reserve Vault: ${report.ledger.distributions.riskReserveVaultNear.toFixed(4)} NEAR`);

  console.log(`\n[7] Hash-Chained Ed25519 Signed Receipts (${report.receipts.length} receipts):`);
  for (const r of report.receipts) {
    console.log(
      `    #${r.sequence} [${r.stage.padEnd(25)}] Hash: ${r.receiptHash.slice(0, 16)}... Sig: ${r.signatureHex.slice(0, 16)}...`
    );
  }

  const dataDir = join(process.cwd(), 'data');
  const pubDataDir = join(process.cwd(), 'public', 'data');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(pubDataDir, { recursive: true });

  const outJson = JSON.stringify(report, null, 2);
  writeFileSync(join(dataDir, 'latest-run.json'), outJson, 'utf-8');
  writeFileSync(join(pubDataDir, 'latest-run.json'), outJson, 'utf-8');

  console.log(`\n[OK] Saved verifiable artifact to data/latest-run.json & public/data/latest-run.json (${elapsedMs} ms)`);
}

main().catch((err) => {
  console.error('Demo execution failed:', err);
  process.exit(1);
});
