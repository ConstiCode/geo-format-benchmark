import { z } from 'zod';

// --- Enums ---

export const ContentFormat = z.enum(['raw_html', 'clean_html', 'markdown', 'json_ld']);
export type ContentFormat = z.infer<typeof ContentFormat>;

export const LlmProvider = z.enum([
  'gpt-4o-mini',
  'gemini-flash',
  'claude-haiku',
  'perplexity-sonar',
]);
export type LlmProvider = z.infer<typeof LlmProvider>;

export const ExperimentPhase = z.enum([
  'fetching',
  'converting',
  'running',
  'analyzing',
  'complete',
]);
export type ExperimentPhase = z.infer<typeof ExperimentPhase>;

export const RunStatus = z.enum(['pending', 'running', 'completed', 'failed']);
export type RunStatus = z.infer<typeof RunStatus>;

export const Sentiment = z.enum(['positive', 'neutral', 'negative']);
export type Sentiment = z.infer<typeof Sentiment>;

// --- Core Data Types ---

export const SerpResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  metaDescription: z.string(),
  rawHtml: z.string(),
  position: z.number().int().min(1).max(5),
});
export type SerpResult = z.infer<typeof SerpResultSchema>;

export const FormattedContentSchema = z.object({
  sourceId: z.string(),
  url: z.string().url(),
  title: z.string(),
  format: ContentFormat,
  content: z.string(),
});
export type FormattedContent = z.infer<typeof FormattedContentSchema>;

// --- Experiment Configuration ---

export const ExperimentConfigSchema = z.object({
  id: z.string().uuid(),
  query: z.string().min(1),
  llmProviders: z.array(LlmProvider).min(1),
  enablePositionRotation: z.boolean(),
  createdAt: z.coerce.date(),
});
export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;

// --- Experiment Run ---

export const ExperimentRunSchema = z.object({
  id: z.string(),
  experimentId: z.string().uuid(),
  runNumber: z.number().int().positive(),
  llmProvider: LlmProvider,
  testSourceIndex: z.number().int().min(0).max(4),
  testFormat: ContentFormat,
  sourceOrder: z.array(z.number().int()).length(5),
  prompt: z.string(),
  rawResponse: z.string().default(''),
  status: RunStatus,
  error: z.string().optional(),
  createdAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
});
export type ExperimentRun = z.infer<typeof ExperimentRunSchema>;

// --- Citation ---

export const CitationSchema = z.object({
  runId: z.string(),
  sourceIndex: z.number().int().min(0).max(4),
  citationRank: z.number().int().positive(),
  sentiment: Sentiment,
  contextSnippet: z.string(),
});
export type Citation = z.infer<typeof CitationSchema>;

// --- Metrics ---

export interface ExperimentMetrics {
  citationRateByFormat: Record<ContentFormat, number>;
  meanCitationPositionByFormat: Record<ContentFormat, number>;
  positionBiasScore: number;
  formatLift: Record<ContentFormat, number>;
  crossLlmConsistency: Record<LlmProvider, Record<ContentFormat, number>>;
}

// --- Live Status (Firestore) ---

export const ExperimentStatusSchema = z.object({
  experimentId: z.string().uuid(),
  totalRuns: z.number().int().nonnegative(),
  completedRuns: z.number().int().nonnegative(),
  failedRuns: z.number().int().nonnegative(),
  currentPhase: ExperimentPhase,
  updatedAt: z.coerce.date(),
});
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;
