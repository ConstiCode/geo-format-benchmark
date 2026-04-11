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

const DELAY_BETWEEN_RUNS_MS = 5000; // 5 seconds to avoid rate limits

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const queryText = 'Besten Deutschen Fahrrad Onlineshops';
  console.log(`\n=== Running experiment: "${queryText}" ===\n`);

  // 1. Create query in DB
  const [query] = await db.insert(queries).values({ queryText }).returning();
  console.log(`Query created: ${query.id}`);

  // 2. Fetch SERP results
  console.log('Fetching SERP results...');
  const serpResults = await fetchSerpResults(queryText, query.id);
  console.log(`Got ${serpResults.length} results`);

  // 3. Fetch HTML for each result
  console.log('Fetching HTML content...');
  const sourcesWithHtml: SerpResult[] = [];
  for (const result of serpResults) {
    try {
      const withHtml = await fetchAndExtract(result, query.id);
      sourcesWithHtml.push(withHtml);
      console.log(`  OK: ${result.url} (${withHtml.rawHtml.length} chars)`);
    } catch {
      console.log(`  FAIL: ${result.url} — using empty HTML`);
      sourcesWithHtml.push(result);
    }
  }

  // 4. Convert to all formats
  console.log('Converting to 4 formats...');
  const formattedSources = sourcesWithHtml.map((source, i) =>
    convertAllFormats(source, `source-${i}`),
  );

  // 5. Generate run configs (Gemini only, no rotation)
  const config: ExperimentConfig = {
    id: randomUUID(),
    query: queryText,
    llmProviders: ['Anthropic'],
    enablePositionRotation: false,
    createdAt: new Date(),
  };

  const runConfigs = generateAllRuns(config, sourcesWithHtml);
  console.log(`Generated ${runConfigs.length} runs\n`);

  // 5b. Store experiment in DB
  await db.insert(experiments).values({
    id: config.id,
    queryId: query.id,
    llmProviders: config.llmProviders,
    enablePositionRotation: config.enablePositionRotation,
    totalRuns: runConfigs.length,
    status: 'running',
  });

  // 6. Execute runs with delay between calls
  const runsWithCitations: RunWithCitations[] = [];

  for (const runConfig of runConfigs) {
    try {
      const prompt = assemblePrompt(queryText, formattedSources, runConfig);
      console.log(
        `Run ${runConfig.runNumber}/${runConfigs.length}: ${runConfig.testFormat} (source ${runConfig.testSourceIndex})...`,
      );

      const llmResponse = await complete(prompt, runConfig.llmProvider);
      console.log(`  Response: ${llmResponse.content.length} chars, ${llmResponse.latencyMs}ms`);

      // Parse citations
      const parsedCitations = extractCitations(llmResponse.content, runConfig);
      console.log(`  Citations found: ${parsedCitations.length}`);

      // Store run in DB
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

      // Store citations in DB
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

      runsWithCitations.push({ runConfig, citations: parsedCitations });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  FAILED: ${msg}`);

      // Store failed run
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

    // Delay between runs to avoid rate limits
    if (runConfig.runNumber < runConfigs.length) {
      await sleep(DELAY_BETWEEN_RUNS_MS);
    }
  }

  // 7. Calculate metrics
  console.log('\n=== RESULTS ===\n');
  const metrics = calculateAllMetrics(runsWithCitations);

  console.log('Citation Rate by Format:');
  for (const [format, rate] of Object.entries(metrics.citationRateByFormat)) {
    console.log(`  ${format}: ${(rate * 100).toFixed(1)}%`);
  }

  console.log('\nMean Citation Position by Format:');
  for (const [format, pos] of Object.entries(metrics.meanCitationPositionByFormat)) {
    console.log(`  ${format}: ${pos.toFixed(2)}`);
  }

  console.log(`\nPosition Bias Score: ${metrics.positionBiasScore.toFixed(3)}`);

  console.log('\nFormat Lift (vs clean_html):');
  for (const [format, lift] of Object.entries(metrics.formatLift)) {
    console.log(`  ${format}: ${lift >= 0 ? '+' : ''}${(lift * 100).toFixed(1)}%`);
  }

  // Update experiment status
  await db
    .update(experiments)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(experiments.id, config.id));

  console.log('\nDone! All data stored in PostgreSQL.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Experiment failed:', err);
  process.exit(1);
});
