// ClawSwarm Nexus — CLI Runner for Boundary & Scope Enforcement Evaluation Suite

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runBoundaryEvaluationSuite } from '../core/boundary-suite.js';

async function main() {
  console.log('========================================================================');
  console.log(' CLAWSWARM NEXUS — BOUNDARY & KEY-SCOPE ENFORCEMENT VERIFICATION');
  console.log('========================================================================');

  const report = await runBoundaryEvaluationSuite();
  for (const s of report.scenarios) {
    console.log(
      `\n[${s.scenarioId}] ${s.title}\n  -> Firewall : ${s.firewallAssessment.decision} (Score ${s.firewallAssessment.riskScore}/100)\n  -> Key Guard: ${s.keyGuardVerdict.code} (${s.keyGuardVerdict.reason})\n  -> Receipt  : ${s.receipt.receiptId} (Sig: ${s.receipt.signatureHex.slice(0, 20)}...)`
    );
  }

  const dataDir = join(process.cwd(), 'data');
  const pubDataDir = join(process.cwd(), 'public', 'data');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(pubDataDir, { recursive: true });

  const outJson = JSON.stringify(report, null, 2);
  writeFileSync(join(dataDir, 'boundary-eval.json'), outJson, 'utf-8');
  writeFileSync(join(pubDataDir, 'boundary-eval.json'), outJson, 'utf-8');

  console.log(
    `\n[OK] Verified ${report.totalBlockedCount}/${report.totalScenariosTested} boundary scenarios blocked and saved to data/boundary-eval.json`
  );
}

main().catch((err) => {
  console.error('Boundary evaluation failed:', err);
  process.exit(1);
});
