import { eq } from 'drizzle-orm';
import { db } from '../models/db.js';
import { experiments, experimentRuns, citations } from '../models/schema.js';
import { calculateAllMetrics } from '../analysis/metrics.js';
import type { RunWithCitations } from '../analysis/metrics.js';
import type { ContentFormat, LlmProvider } from '../models/types.js';

async function main() {
  // Get all completed experiments
  const exps = await db.select().from(experiments);

  for (const exp of exps) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Experiment: ${exp.id}`);
    console.log(`Query: (queryId: ${exp.queryId})`);
    console.log(`Status: ${exp.status}`);

    // Get completed runs
    const runs = await db
      .select()
      .from(experimentRuns)
      .where(eq(experimentRuns.experimentId, exp.id));

    const completedRuns = runs.filter((r) => r.status === 'completed');
    const failedRuns = runs.filter((r) => r.status === 'failed');
    console.log(`Runs: ${completedRuns.length} completed, ${failedRuns.length} failed`);

    if (completedRuns.length === 0) {
      console.log('No completed runs — skipping');
      continue;
    }

    // Build RunWithCitations
    const runsWithCitations: RunWithCitations[] = [];
    for (const run of completedRuns) {
      const cits = await db.select().from(citations).where(eq(citations.runId, run.id));

      runsWithCitations.push({
        runConfig: {
          runNumber: run.runNumber,
          testSourceIndex: run.testSourceIndex,
          testFormat: run.testFormat as ContentFormat,
          sourceFormats: [], // not stored, reconstruct
          sourceOrder: run.sourceOrder,
          llmProvider: run.llmProvider as LlmProvider,
        },
        citations: cits.map((c) => ({
          runId: c.runId,
          sourceIndex: c.sourceIndex,
          citationRank: c.citationRank,
          sentiment: c.sentiment as 'positive' | 'neutral' | 'negative',
          contextSnippet: c.contextSnippet ?? '',
        })),
      });
    }

    // Reconstruct sourceFormats from testSourceIndex + testFormat
    for (const rwc of runsWithCitations) {
      const formats: ContentFormat[] = Array(5).fill('clean_html');
      formats[rwc.runConfig.testSourceIndex] = rwc.runConfig.testFormat;
      rwc.runConfig.sourceFormats = formats;
    }

    const metrics = calculateAllMetrics(runsWithCitations);

    console.log('\nCitation Rate by Format:');
    for (const [format, rate] of Object.entries(metrics.citationRateByFormat)) {
      console.log(`  ${format}: ${(rate * 100).toFixed(1)}%`);
    }

    console.log('\nMean Citation Position (lower = better):');
    for (const [format, pos] of Object.entries(metrics.meanCitationPositionByFormat)) {
      console.log(`  ${format}: ${pos.toFixed(2)}`);
    }

    const biasStrength =
      Math.abs(metrics.positionBiasScore) < 0.3
        ? 'weak'
        : Math.abs(metrics.positionBiasScore) < 0.6
          ? 'moderate'
          : 'strong';
    console.log(
      `\nPosition Bias: ${metrics.positionBiasScore.toFixed(3)} (${biasStrength} ${metrics.positionBiasScore > 0 ? 'primacy' : 'recency'} bias)`,
    );

    console.log('\nFormat Lift (vs clean_html baseline):');
    for (const [format, lift] of Object.entries(metrics.formatLift)) {
      console.log(`  ${format}: ${lift >= 0 ? '+' : ''}${(lift * 100).toFixed(1)}%`);
    }

    console.log('\nCross-LLM Consistency:');
    for (const [provider, rates] of Object.entries(metrics.crossLlmConsistency)) {
      console.log(`  ${provider}:`);
      for (const [format, rate] of Object.entries(rates)) {
        console.log(`    ${format}: ${(rate * 100).toFixed(1)}%`);
      }
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
