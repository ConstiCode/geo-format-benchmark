import type { Citation, RunConfig, Sentiment } from '../models/types.js';

// --- Citation Extraction ---

export function extractCitations(response: string, runConfig: RunConfig): Citation[] {
  const regexp = /\[Source\s*(\d+)/gi;

  const matches = [...response.matchAll(regexp)];
  const citations: Citation[] = [];

  const rank = extractCitationRank(response);
  let existingCitations: Citation[] = [];

  for (const match of matches) {
    const sourceIndex = parseInt(match[1]);
    const originalIndex = runConfig.sourceOrder[sourceIndex - 1];

    if (existingCitations[originalIndex]) {
      continue;
    }

    const matchIndex = match.index;
    const citationRank = rank.get(sourceIndex) ?? 4;
    const context = extractContext(response, matchIndex);
    const sentiment = analyzeSentiment(context);
    let citation = {
      runId: '',
      sourceIndex: originalIndex,
      citationRank: citationRank,
      sentiment: sentiment,
      contextSnippet: context,
    };
    existingCitations[originalIndex] = citation;
    citations.push(citation);
  }
  return citations;
}

// --- Citation Rank Extraction ---

export function extractCitationRank(response: string): Map<number, number> {
  const sections = response.split(/(?=\b[1-3][.)]\s)/);
  const citationRankMap = new Map<number, number>();

  for (let i = 0; i < sections.length; i++) {
    const citations = sections[i].match(/\[Source\s*(\d+)/i);
    if (!citations) {
      continue;
    }
    const sourceIndex = parseInt(citations[1]);
    citationRankMap.set(sourceIndex, i + 1);
  }

  return citationRankMap;
}

// --- Sentiment Analysis ---

export function analyzeSentiment(contextSnippet: string): Sentiment {
  const lower = contextSnippet.toLowerCase();

  const positive = [
    'best',
    'excellent',
    'recommended',
    'top',
    'great',
    'ideal',
    'strong',
    'outstanding',
    'superior',
    'leading',
    'perfect',
    'favorite',
  ];
  const negative = [
    'worst',
    'avoid',
    'weak',
    'limited',
    'lacks',
    'poor',
    'downside',
    'drawback',
    'inferior',
    'disappointing',
    'expensive',
  ];

  if (positive.some((word) => lower.includes(word))) return 'positive';
  if (negative.some((word) => lower.includes(word))) return 'negative';
  return 'neutral';
}

// --- Context Extraction Helper ---

export function extractContext(response: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - 50);
  const end = Math.min(response.length, matchIndex + 50);

  return response.slice(start, end).trim();
}
