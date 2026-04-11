import type {
  RunConfig,
  ExperimentConfig,
  SerpResult,
  ContentFormat,
  FormattedContent,
} from '../models/types.js';
import { fetchSerpResults } from './serp-fetcher.js';
import { fetchAndExtract } from './html-extractor.js';
import { convertAllFormats } from './format-converter.js';
import { complete } from './llm-client.js';
import { db } from '../models/db.js';
import { experimentRuns } from '../models/schema.js';
import {
  createExperimentStatus,
  incrementCompletedRuns,
  incrementFailedRuns,
  setPhase,
} from '../models/firestore.js';

const TEST_FORMATS: ContentFormat[] = ['json_ld', 'markdown', 'raw_html'];

function generateFormatRotationRuns(sourceCount: number) {
  let testPermutations = [];
  let base_test = Array(sourceCount).fill('clean_html');
  for (let format of TEST_FORMATS) {
    for (let i = 0; i < base_test.length; i++) {
      let test = [...base_test];
      test[i] = format;

      testPermutations.push(test);
    }
  }
  return testPermutations;
}

function generatePositionPermutations(sourceCount: number) {
  let permutationArray = [];
  for (let offset = 0; offset < sourceCount; offset++) {
    let perm = Array(sourceCount)
      .fill(0)
      .map((_, i) => (i + offset) % sourceCount);
    permutationArray.push(perm);
  }
  return permutationArray;
}

export function generateAllRuns(config: ExperimentConfig, sources: SerpResult[]): RunConfig[] {
  // Input:
  //   config.llmProviders — e.g. ['OpenAi', 'Google', 'Anthropic']
  //   config.enablePositionRotation — false = 1 permutation, true = 5
  //   sources — the 5 SERP results (you need sources.length)
  //
  // Output: flat array of RunConfig objects
  //
  // Steps:
  //   1. Get format rotations (15 arrays) from generateFormatRotationRuns
  let runs = generateFormatRotationRuns(sources.length);
  //   2. Get position permutations: if rotation enabled → 5, else → just [[0,1,2,3,4]]
  let permutations = [
    Array(sources.length)
      .fill(0)
      .map((_, i) => i),
  ];

  if (config.enablePositionRotation) {
    permutations = generatePositionPermutations(sources.length);
  }
  let runConfigs = [];
  let runNumber = 0;
  //   3. Three nested loops: providers x format rotations x permutations
  for (let provider of config.llmProviders) {
    for (let run of runs) {
      let testSourceIndex = run.findIndex((f) => f !== 'clean_html');
      for (let perm of permutations) {
        runNumber++;
        runConfigs.push({
          runNumber: runNumber,
          testSourceIndex: testSourceIndex,
          testFormat: run[testSourceIndex],
          sourceFormats: run,
          sourceOrder: perm,
          llmProvider: provider,
        });
      }
    }
  }

  return runConfigs;
}

// --- Part 2: Prompt Assembly ---

export function assemblePrompt(
  query: string,
  formattedSources: Record<ContentFormat, FormattedContent>[],
  runConfig: RunConfig,
): string {
  // Input:
  //   query — the search query, e.g. "best CRM for startups"
  //   formattedSources — array of 5 sources, each containing all 4 format versions
  //     formattedSources[0] = { raw_html: FormattedContent, clean_html: ..., markdown: ..., json_ld: ... }
  //     formattedSources[1] = { ... }
  //     ... (5 total, one per SERP result)
  //   runConfig — one RunConfig from generateAllRuns, tells you:
  //     runConfig.sourceOrder — e.g. [2,0,4,1,3] (order to place sources in prompt)
  //     runConfig.sourceFormats — e.g. ['json_ld','clean_html','clean_html','clean_html','clean_html']
  //
  // Output: the full prompt string to send to the LLM
  let prompt = `You are a product advisor. Based ONLY on the following 5 sources,
recommend the best option for: "${query}"

Rules:
- Cite sources by their [Source N] tag when making claims
- Rank your top 3 recommendations
- Explain why you chose each one

`;

  for (let position = 0; position < runConfig.sourceOrder.length; position++) {
    const originalIndex = runConfig.sourceOrder[position];
    const format = runConfig.sourceFormats[originalIndex];
    const source = formattedSources[originalIndex][format];

    prompt += `=== Source ${position + 1} (${source.url})===\n${source.content}\n\n`;
  }
  prompt += 'Provide your recommendations:';
  return prompt;
}

// --- Part 3: Experiment Orchestration ---

export async function runExperiment(config: ExperimentConfig, queryId: string): Promise<void> {
  // 1. Fetch SERP results
  await setPhase(config.id, 'fetching');
  const serpResults = await fetchSerpResults(config.query, queryId);

  // 2. Fetch HTML for each result
  const sourcesWithHtml: SerpResult[] = [];
  for (const result of serpResults) {
    try {
      const withHtml = await fetchAndExtract(result, queryId);
      sourcesWithHtml.push(withHtml);
    } catch (error) {
      console.error(`Failed to fetch HTML for ${result.url}:`, error);
      sourcesWithHtml.push(result); // keep result with empty rawHtml
    }
  }

  // 3. Convert each source to all 4 formats
  await setPhase(config.id, 'converting');
  const formattedSources = sourcesWithHtml.map((source, i) =>
    convertAllFormats(source, `source-${i}`),
  );

  // 4. Generate all run configs
  const runConfigs = generateAllRuns(config, sourcesWithHtml);

  // 5. Initialize Firestore status
  await createExperimentStatus(config.id, runConfigs.length);
  await setPhase(config.id, 'running');

  // 6. Execute each run sequentially
  for (const runConfig of runConfigs) {
    try {
      const prompt = assemblePrompt(config.query, formattedSources, runConfig);
      const llmResponse = await complete(prompt, runConfig.llmProvider);

      // Store run in PostgreSQL
      await db.insert(experimentRuns).values({
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
      });

      await incrementCompletedRuns(config.id);
      console.log(
        `Run ${runConfig.runNumber}/${runConfigs.length} completed (${runConfig.llmProvider}, ${runConfig.testFormat})`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Run ${runConfig.runNumber} failed:`, errorMsg);

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
        error: errorMsg,
      });

      await incrementFailedRuns(config.id);
    }
  }

  // 7. Mark experiment as complete
  await setPhase(config.id, 'complete');
  console.log(`Experiment ${config.id} complete: ${runConfigs.length} runs`);
}
