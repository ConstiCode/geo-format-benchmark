import { randomUUID } from 'crypto';
import { fetchSerpResults } from '../pipeline/serp-fetcher.js';
import { fetchAndExtract } from '../pipeline/html-extractor.js';
import { convertAllFormats } from '../pipeline/format-converter.js';
import { generateAllRuns, assemblePrompt } from '../pipeline/experiment-runner.js';
import { complete } from '../pipeline/llm-client.js';
import { extractCitations } from '../analysis/response-parser.js';
import { calculateAllMetrics } from '../analysis/metrics.js';
import type { ExperimentConfig, SerpResult } from '../models/types.js';
import type { RunWithCitations } from '../analysis/metrics.js';
import { eq } from 'drizzle-orm';
import { db } from '../models/db.js';
import { queries, experiments, experimentRuns, citations } from '../models/schema.js';
import { writeFileSync, appendFileSync } from 'fs';

const DELAY_BETWEEN_RUNS_MS = 10_000;

const QUERIES = ['best CRM for startups', 'Besten Deutschen Fahrrad Onlineshops'];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp(): string {
  return new Date().toLocaleTimeString('de-DE', { hour12: false });
}

function log(msg: string) {
  const line = `[${timestamp()}] ${msg}`;
  console.log(line);
  appendFileSync('data/experiment-log.txt', line + '\n');
}

async function runSingleExperiment(queryText: string, queryIndex: number, totalQueries: number) {
  log(`\n${'='.repeat(60)}`);
  log(`  Query ${queryIndex + 1}/${totalQueries}: "${queryText}"`);
  log(`${'='.repeat(60)}`);

  // 1. Create query in DB
  const [query] = await db.insert(queries).values({ queryText }).returning();
  log(`Query stored in DB: ${query.id}`);

  // 2. Fetch SERP results
  log('Phase 1/5: Fetching SERP results...');
  const serpResults = await fetchSerpResults(queryText, query.id);
  log(`Got ${serpResults.length} SERP results:`);
  serpResults.forEach((r, i) => log(`  ${i + 1}. ${r.title}`));
  log(`  URLs: ${serpResults.map((r) => r.url).join(', ')}`);

  // 3. Fetch HTML
  log('Phase 2/5: Fetching HTML content...');
  const sourcesWithHtml: SerpResult[] = [];
  for (const [i, result] of serpResults.entries()) {
    try {
      const withHtml = await fetchAndExtract(result, query.id);
      sourcesWithHtml.push(withHtml);
      log(`  Source ${i}: OK — ${withHtml.rawHtml.length} chars from ${result.url}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`  Source ${i}: FAIL — ${msg.slice(0, 80)}`);
      sourcesWithHtml.push(result);
    }
  }

  // 4. Convert formats
  log('Phase 3/5: Converting to 4 formats...');
  const formattedSources = sourcesWithHtml.map((source, i) =>
    convertAllFormats(source, `source-${i}`),
  );
  for (const [i, fs] of formattedSources.entries()) {
    log(
      `  Source ${i}: raw_html=${fs.raw_html.content.length}, clean_html=${fs.clean_html.content.length}, markdown=${fs.markdown.content.length}, json_ld=${fs.json_ld.content.length} chars`,
    );
  }

  // 5. Generate runs
  const config: ExperimentConfig = {
    id: randomUUID(),
    query: queryText,
    llmProviders: ['OpenAi', 'Google', 'Anthropic'],
    enablePositionRotation: true,
    createdAt: new Date(),
  };

  const runConfigs = generateAllRuns(config, sourcesWithHtml);
  log(`Phase 4/5: Generated ${runConfigs.length} runs (15 formats x 5 permutations x 3 providers)`);

  const estimatedMinutes = Math.ceil((runConfigs.length * DELAY_BETWEEN_RUNS_MS) / 60000);
  log(`Estimated time for this query: ~${estimatedMinutes} minutes`);

  await db.insert(experiments).values({
    id: config.id,
    queryId: query.id,
    llmProviders: config.llmProviders,
    enablePositionRotation: config.enablePositionRotation,
    totalRuns: runConfigs.length,
    status: 'running',
  });
  log(`Experiment stored in DB: ${config.id}`);

  // 6. Execute runs
  log('Phase 5/5: Calling LLMs...');
  const runsWithCitations: RunWithCitations[] = [];
  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const runConfig of runConfigs) {
    const runStart = Date.now();
    try {
      const prompt = assemblePrompt(queryText, formattedSources, runConfig);

      log(
        `  Run ${runConfig.runNumber}/${runConfigs.length} [${runConfig.llmProvider}] format=${runConfig.testFormat} src=${runConfig.testSourceIndex} order=[${runConfig.sourceOrder}]`,
      );

      const llmResponse = await complete(prompt, runConfig.llmProvider);
      const parsedCitations = extractCitations(llmResponse.content, runConfig);

      const [run] = await db
        .insert(experimentRuns)
        .values({
          experimentId: config.id,
          runNumber: runConfig.runNumber,
          llmProvider: runConfig.llmProvider,
          testSourceIndex: runConfig.testSourceIndex,
          testFormat: runConfig.testFormat,
          sourceOrder: runConfig.sourceOrder,
          prompt: prompt,
          rawResponse: llmResponse.content,
          status: 'completed',
          completedAt: new Date(),
        })
        .returning();

      if (parsedCitations.length > 0) {
        await db.insert(citations).values(
          parsedCitations.map((c) => ({
            runId: run.id,
            sourceIndex: c.sourceIndex,
            citationRank: c.citationRank,
            sentiment: c.sentiment,
            contextSnippet: c.contextSnippet,
            sourceUrl: '',
            sourceFormat: runConfig.sourceFormats[c.sourceIndex],
          })),
        );
      }

      completed++;
      runsWithCitations.push({ runConfig, citations: parsedCitations });
      log(
        `    OK: ${llmResponse.content.length} chars, ${parsedCitations.length} citations, ${llmResponse.inputTokens}+${llmResponse.outputTokens} tokens, ${Date.now() - runStart}ms`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      failed++;
      log(`    FAILED: ${msg.slice(0, 120)}`);

      await db.insert(experimentRuns).values({
        experimentId: config.id,
        runNumber: runConfig.runNumber,
        llmProvider: runConfig.llmProvider,
        testSourceIndex: runConfig.testSourceIndex,
        testFormat: runConfig.testFormat,
        sourceOrder: runConfig.sourceOrder,
        prompt: '',
        status: 'failed',
        error: msg,
      });

      runsWithCitations.push({ runConfig, citations: [] });
    }

    // Progress summary every 25 runs
    if (runConfig.runNumber % 25 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 60000);
      const remaining = Math.round(
        ((runConfigs.length - runConfig.runNumber) * DELAY_BETWEEN_RUNS_MS) / 60000,
      );
      log(
        `  --- Progress: ${runConfig.runNumber}/${runConfigs.length} (${completed} ok, ${failed} failed) | ${elapsed}min elapsed, ~${remaining}min remaining ---`,
      );
    }

    if (runConfig.runNumber < runConfigs.length) {
      await sleep(DELAY_BETWEEN_RUNS_MS);
    }
  }

  // 7. Update experiment
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  await db
    .update(experiments)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(experiments.id, config.id));

  log(`Query "${queryText}" complete: ${completed} ok, ${failed} failed in ${totalTime}s`);

  // 8. Calculate metrics
  const metrics = calculateAllMetrics(runsWithCitations);

  log('\n--- Citation Rate by Format ---');
  for (const [format, rate] of Object.entries(metrics.citationRateByFormat)) {
    log(`  ${format}: ${(rate * 100).toFixed(1)}%`);
  }

  log('--- Mean Citation Position (lower = better) ---');
  for (const [format, pos] of Object.entries(metrics.meanCitationPositionByFormat)) {
    log(`  ${format}: ${pos.toFixed(2)}`);
  }

  const biasStrength =
    Math.abs(metrics.positionBiasScore) < 0.3
      ? 'weak'
      : Math.abs(metrics.positionBiasScore) < 0.6
        ? 'moderate'
        : 'strong';
  log(
    `--- Position Bias: ${metrics.positionBiasScore.toFixed(3)} (${biasStrength} ${metrics.positionBiasScore > 0 ? 'primacy' : 'recency'} bias) ---`,
  );

  log('--- Format Lift (vs clean_html) ---');
  for (const [format, lift] of Object.entries(metrics.formatLift)) {
    log(`  ${format}: ${lift >= 0 ? '+' : ''}${(lift * 100).toFixed(1)}%`);
  }

  log('--- Cross-LLM Consistency ---');
  for (const [provider, rates] of Object.entries(metrics.crossLlmConsistency)) {
    log(`  ${provider}:`);
    for (const [format, rate] of Object.entries(rates)) {
      log(`    ${format}: ${(rate * 100).toFixed(1)}%`);
    }
  }

  return { config, metrics, completed, failed };
}

async function main() {
  log(`\n${'#'.repeat(60)}`);
  log(`  GEO FORMAT BENCHMARK — OVERNIGHT RUN`);
  log(`  Started: ${new Date().toISOString()}`);
  log(`  Queries: ${QUERIES.length}`);
  log(`  Providers: OpenAi, Google, Anthropic`);
  log(`  Position rotation: ON`);
  log(`  Delay between runs: ${DELAY_BETWEEN_RUNS_MS / 1000}s`);
  log(`  Total estimated runs: ${QUERIES.length * 225}`);
  log(
    `  Total estimated time: ~${Math.ceil((QUERIES.length * 225 * DELAY_BETWEEN_RUNS_MS) / 60000)} minutes`,
  );
  log(`${'#'.repeat(60)}`);

  const allResults = [];

  for (const [i, queryText] of QUERIES.entries()) {
    try {
      const result = await runSingleExperiment(queryText, i, QUERIES.length);
      allResults.push(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`QUERY FAILED: "${queryText}" — ${msg}`);
    }
  }

  // Save combined results
  writeFileSync('data/experiment-results.json', JSON.stringify(allResults, null, 2));

  log(`\n${'#'.repeat(60)}`);
  log(`  ALL EXPERIMENTS COMPLETE`);
  log(`  Finished: ${new Date().toISOString()}`);
  log(`  Results saved to data/experiment-results.json`);
  log(`  Full log saved to data/experiment-log.txt`);
  log(`${'#'.repeat(60)}`);

  process.exit(0);
}

main().catch((err) => {
  log(`FATAL ERROR: ${err}`);
  process.exit(1);
});
