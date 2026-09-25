import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suites = [
  { name: 'Phase 5: Shift Operations & Administration', file: 'test_phase5_shift_operations.js' },
  { name: 'Phase 6: Shift Planning, Roster & Swaps', file: 'test_phase6_shift_planning.js' },
  { name: 'Phase 7: Workforce Automation & Shift Compliance', file: 'test_phase7_workforce_automation.js' },
  { name: 'Phase 8: Workforce Intelligence & Self-Service', file: 'test_phase8_workforce_intelligence.js' },
  { name: 'Phase 9: Enterprise Platform & Operations', file: 'test_phase9_enterprise_operations.js' },
  { name: 'Phase 10: Production Readiness & Launch Hardening', file: 'test_phase10_production_readiness.js' }
];

async function runSuite(suite) {
  return new Promise((resolve) => {
    console.log(`\n================================================================`);
    console.log(`  EXECUTING: ${suite.name}`);
    console.log(`================================================================`);

    const child = spawn('node', [suite.file], {
      cwd: __dirname,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });

    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(s);
    });

    child.on('close', (code) => {
      let passed = 0;
      let failed = 0;

      const passMatches = stdout.match(/\[PASS\]/g);
      if (passMatches) {
        passed = passMatches.length;
      }

      const failMatches = stdout.match(/\[FAIL\]/g);
      if (failMatches) {
        failed = failMatches.length;
      }

      if (passed === 0 && code === 0) {
        const summaryMatch = stdout.match(/(\d+)\s+PASSED/i);
        if (summaryMatch) passed = parseInt(summaryMatch[1], 10);
      }

      resolve({
        name: suite.name,
        code,
        passed,
        failed,
        success: code === 0 && failed === 0
      });
    });
  });
}

async function main() {
  console.log('\n################################################################');
  console.log('       INNOVEITY CRM ENTERPRISE PLATFORM REGRESSION SUITE        ');
  console.log('                     PHASES 5 THROUGH 10                        ');
  console.log('################################################################\n');

  const results = [];

  for (const suite of suites) {
    const res = await runSuite(suite);
    results.push(res);
  }

  console.log('\n\n================================================================');
  console.log('               MASTER REGRESSION AUDIT SCORECARD                ');
  console.log('================================================================');
  console.log('Subsystem / Phase Suite                                | Status    | Tests');
  console.log('-------------------------------------------------------|-----------|------');

  let totalPassed = 0;
  let totalFailed = 0;
  let allPass = true;

  for (const r of results) {
    totalPassed += r.passed;
    totalFailed += r.failed;
    if (!r.success) allPass = false;

    const padName = r.name.padEnd(54, ' ');
    const padStatus = (r.success ? '[PASS]' : '[FAIL]').padEnd(9, ' ');
    const countStr = `${r.passed} passed / ${r.failed} failed`;
    console.log(`${padName} | ${padStatus} | ${countStr}`);
  }

  console.log('-------------------------------------------------------|-----------|------');
  const passRate = totalPassed + totalFailed > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 100;
  console.log(`TOTAL AGGREGATED SCORE: ${totalPassed} PASSED / ${totalFailed} FAILED (${passRate}%)`);
  console.log(`FINAL VERDICT: ${allPass ? '>>> 100% PASSED - SYSTEM IS PRODUCTION CERTIFIED <<<' : '>>> REGRESSION DETECTED <<<'}`);
  console.log('================================================================\n');

  process.exit(allPass ? 0 : 1);
}

main();
