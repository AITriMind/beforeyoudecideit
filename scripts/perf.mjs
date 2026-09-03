/**
 * TM-09 — the performance gate.
 *
 * Five Lighthouse runs per route against a static server, medians compared with
 * the release budgets. Reports are written outside the served tree.
 *
 * Run a static server on the repository root first, then:
 *   node scripts/perf.mjs [http://127.0.0.1:4174]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:4174').replace(/\/$/, '');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reports = join(root, '..', 'lighthouse-reports');
const RUNS = 5;

const ROUTES = ['/', '/decisions/raising-the-price-of-the-core-package/'];

/** The absolute release gates. */
const BUDGET = { lcpMs: 2200, cls: 0.05, tbtMs: 150 };

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

mkdirSync(reports, { recursive: true });

const table = [];
let failed = 0;

for (const route of ROUTES) {
  const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
  const runs = [];
  for (let run = 1; run <= RUNS; run += 1) {
    const out = join(reports, `${slug}-${run}.json`);
    const result = spawnSync(
      process.execPath,
      [
        join(root, 'node_modules', 'lighthouse', 'cli', 'index.js'),
        `${BASE}${route}`,
        '--only-categories=performance',
        '--output=json',
        `--output-path=${out}`,
        '--quiet',
        '--chrome-flags=--headless=new --disable-gpu --no-first-run'
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    // On Windows, Lighthouse regularly exits non-zero while removing its own
    // temporary Chrome profile. The measurement is already written by then, so
    // a run counts when the report exists; any other failure does not.
    const cleanupOnly =
      result.status !== 0 &&
      /EPERM[\s\S]*destroyTmp|destroyTmp[\s\S]*EPERM/.test(`${result.stderr}${result.stdout}`) &&
      existsSync(out);
    if (result.status !== 0 && !cleanupOnly) {
      console.error(`run ${run} on ${route} failed: ${(result.stderr || '').slice(0, 300)}`);
      continue;
    }
    if (cleanupOnly) process.stdout.write('~');
    const report = JSON.parse(readFileSync(out, 'utf8'));
    runs.push({
      route,
      run,
      lcpMs: report.audits['largest-contentful-paint'].numericValue,
      cls: report.audits['cumulative-layout-shift'].numericValue,
      tbtMs: report.audits['total-blocking-time'].numericValue,
      performanceScore: Math.round(report.categories.performance.score * 100),
      transferredBytes: report.audits['total-byte-weight'].numericValue
    });
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  if (runs.length < RUNS) {
    console.error(`${route}: only ${runs.length} valid runs, need ${RUNS} — invalid-run`);
    failed += 1;
    continue;
  }

  const row = {
    route,
    lcpMs: Math.round(median(runs.map((r) => r.lcpMs))),
    cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
    tbtMs: Math.round(median(runs.map((r) => r.tbtMs))),
    score: median(runs.map((r) => r.performanceScore)),
    transferKb: Math.round(median(runs.map((r) => r.transferredBytes)) / 1024)
  };
  table.push(row);

  for (const [metric, limit] of Object.entries(BUDGET)) {
    if (row[metric] > limit) {
      console.error(`${route}: ${metric} median ${row[metric]} exceeds ${limit} — fail-absolute`);
      failed += 1;
    }
  }
}

writeFileSync(join(reports, 'summary.json'), `${JSON.stringify(table, null, 2)}\n`);

console.log('');
console.log('route                                              LCP    CLS    TBT   score  transfer');
for (const row of table) {
  console.log(
    `${row.route.padEnd(50)} ${String(row.lcpMs).padStart(5)}  ${String(row.cls).padStart(5)}  ${String(row.tbtMs).padStart(4)}  ${String(row.score).padStart(5)}  ${String(row.transferKb).padStart(5)}KB`
  );
}
console.log('');
console.log(`budgets: LCP <= ${BUDGET.lcpMs}ms, CLS <= ${BUDGET.cls}, TBT <= ${BUDGET.tbtMs}ms`);
if (failed) {
  console.error(`performance gate: FAIL (${failed})`);
  process.exit(1);
}
console.log('performance gate: pass');
