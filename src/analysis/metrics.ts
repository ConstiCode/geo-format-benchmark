import type {
  ContentFormat,
  LlmProvider,
  ExperimentMetrics,
  Citation,
  RunConfig,
} from '../models/types.js';

// --- Types for internal use ---

export interface RunWithCitations {
  runConfig: RunConfig;
  citations: Citation[];
}

// --- 1. Citation Rate by Format ---

export function calculateCitationRate(runs: RunWithCitations[]): Record<ContentFormat, number> {
  const totalByFormat: Record<string, number> = {};
  const citedByFormat: Record<string, number> = {};

  // Track clean_html baseline: how often non-test sources (always clean_html) get cited
  let cleanHtmlTotal = 0;
  let cleanHtmlCited = 0;

  runs.forEach((run) => {
    const format = run.runConfig.testFormat;
    totalByFormat[format] = (totalByFormat[format] ?? 0) + 1;

    // Check if the test source was cited
    const wasCited = run.citations.some((c) => c.sourceIndex === run.runConfig.testSourceIndex);
    if (wasCited) {
      citedByFormat[format] = (citedByFormat[format] ?? 0) + 1;
    }

    // Check clean_html baseline: for each non-test source, was it cited?
    for (let i = 0; i < run.runConfig.sourceFormats.length; i++) {
      if (i === run.runConfig.testSourceIndex) continue; // skip test source
      cleanHtmlTotal++;
      const nonTestCited = run.citations.some((c) => c.sourceIndex === i);
      if (nonTestCited) {
        cleanHtmlCited++;
      }
    }
  });

  const result: Record<ContentFormat, number> = {
    raw_html: 0,
    clean_html: cleanHtmlTotal > 0 ? cleanHtmlCited / cleanHtmlTotal : 0,
    markdown: 0,
    json_ld: 0,
  };
  for (const format of ['json_ld', 'markdown', 'raw_html'] as ContentFormat[]) {
    result[format] = (citedByFormat[format] ?? 0) / (totalByFormat[format] ?? 1);
  }
  return result;
}

// --- 2. Mean Citation Position by Format ---

export function calculateMeanCitationPosition(
  runs: RunWithCitations[],
): Record<ContentFormat, number> {
  const ranksByFormat: Record<string, number[]> = {};

  runs.forEach((run) => {
    const format = run.runConfig.testFormat;
    const testCitation = run.citations.find((c) => c.sourceIndex === run.runConfig.testSourceIndex);
    if (testCitation) {
      if (!ranksByFormat[format]) ranksByFormat[format] = [];
      ranksByFormat[format].push(testCitation.citationRank);
    }
  });

  const result: Record<ContentFormat, number> = {
    raw_html: 0,
    clean_html: 0,
    markdown: 0,
    json_ld: 0,
  };
  for (const format of ['json_ld', 'markdown', 'raw_html'] as ContentFormat[]) {
    const ranks = ranksByFormat[format] ?? [];
    if (ranks.length > 0) {
      result[format] = ranks.reduce((sum, r) => sum + r, 0) / ranks.length;
    }
  }
  return result;
}

// --- 3. Position Bias Score ---

export function calculatePositionBias(runs: RunWithCitations[]): number {
  if (runs.length === 0) return 0;

  // Find max position count from the data
  const sourceCount = runs[0].runConfig.sourceOrder.length;

  // For each context position, calculate citation probability
  const citedAtPosition: number[] = Array(sourceCount).fill(0);
  const totalAtPosition: number[] = Array(sourceCount).fill(0);

  runs.forEach((run) => {
    const citedOriginals = new Set(run.citations.map((c) => c.sourceIndex));
    for (let position = 0; position < sourceCount; position++) {
      const originalIndex = run.runConfig.sourceOrder[position];
      totalAtPosition[position]++;
      if (citedOriginals.has(originalIndex)) {
        citedAtPosition[position]++;
      }
    }
  });

  // Citation rate per position
  const x: number[] = [];
  const y: number[] = [];
  for (let p = 0; p < sourceCount; p++) {
    x.push(p);
    y.push(totalAtPosition[p] > 0 ? citedAtPosition[p] / totalAtPosition[p] : 0);
  }

  // Pearson correlation: r = (nΣxy - ΣxΣy) / sqrt((nΣx² - (Σx)²)(nΣy² - (Σy)²))
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

// --- 4. Format Lift ---

export function calculateFormatLift(
  citationRates: Record<ContentFormat, number>,
): Record<ContentFormat, number> {
  const baseline = citationRates['clean_html'];
  if (baseline === 0) {
    return { raw_html: 0, clean_html: 0, markdown: 0, json_ld: 0 };
  }
  const result: Record<ContentFormat, number> = {
    raw_html: 0,
    clean_html: 0,
    markdown: 0,
    json_ld: 0,
  };
  for (const format of ['json_ld', 'raw_html', 'markdown'] as ContentFormat[]) {
    result[format] = (citationRates[format] - baseline) / baseline;
  }
  return result;
}

// --- 5. Cross-LLM Consistency ---

export function calculateCrossLlmConsistency(
  runs: RunWithCitations[],
): Record<LlmProvider, Record<ContentFormat, number>> {
  const result = {} as Record<LlmProvider, Record<ContentFormat, number>>;

  // Group runs by provider
  const byProvider: Record<string, RunWithCitations[]> = {};
  runs.forEach((run) => {
    const provider = run.runConfig.llmProvider;
    if (!byProvider[provider]) byProvider[provider] = [];
    byProvider[provider].push(run);
  });

  // Calculate citation rate per provider
  for (const [provider, providerRuns] of Object.entries(byProvider)) {
    result[provider as LlmProvider] = calculateCitationRate(providerRuns);
  }

  return result;
}

// --- 6. Aggregate All Metrics ---

export function calculateAllMetrics(runs: RunWithCitations[]): ExperimentMetrics {
  const citationRateByFormat = calculateCitationRate(runs);
  const meanCitationPositionByFormat = calculateMeanCitationPosition(runs);
  const positionBiasScore = calculatePositionBias(runs);
  const formatLift = calculateFormatLift(citationRateByFormat);
  const crossLlmConsistency = calculateCrossLlmConsistency(runs);

  return {
    citationRateByFormat,
    meanCitationPositionByFormat,
    positionBiasScore,
    formatLift,
    crossLlmConsistency,
  };
}
