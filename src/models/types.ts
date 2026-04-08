import { z } from "zod";

export const ContentFormat = z.enum(["raw_html", "clean_html", "markdown", "json_ld"]);
export type ContentFormat = z.infer<typeof ContentFormat>;

export const LLMProvider = z.enum(["openai", "gemini", "claude", "perplexity"]);
export type LLMProvider = z.infer<typeof LLMProvider>;

export interface SerpResult {
  url: string;
  title: string;
  description: string;
  html: string;
}

export interface FormattedContent {
  sourceUrl: string;
  format: ContentFormat;
  content: string;
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  query: string;
  provider: LLMProvider;
  sources: FormattedContent[];
  sourceOrder: number[];
  testSourceIndex: number;
  testFormat: ContentFormat;
  response?: string;
  citations?: Citation[];
  status: "pending" | "running" | "completed" | "failed";
}

export interface Citation {
  sourceIndex: number;
  rank: number;
  sentiment: "positive" | "neutral" | "negative";
  excerpt: string;
}

export interface ExperimentResult {
  experimentId: string;
  query: string;
  runs: ExperimentRun[];
  metrics?: ExperimentMetrics;
}

export interface ExperimentMetrics {
  citationRateByFormat: Record<ContentFormat, number>;
  meanCitationPositionByFormat: Record<ContentFormat, number>;
  positionBiasScore: number;
  formatLift: Record<ContentFormat, number>;
}
