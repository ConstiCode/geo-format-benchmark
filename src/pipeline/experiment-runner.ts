import type { RunConfig, ExperimentConfig, SerpResult, ContentFormat } from '../models/types.js';

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
