import { config } from '../config.js';
import { SerpResult } from '../models/types.js';
import { z } from 'zod';
import { db } from '../models/db.js';
import { serpResults as serpResultsTable } from '../models/schema.js';

// SerpApi free tier: 100 searches/month

const SerpApiOrganicSchema = z.object({
  title: z.string(),
  link: z.string(),
  snippet: z.string().optional().default(''),
  position: z.number(),
});

const SerpApiResponseSchema = z.object({
  organic_results: z.array(SerpApiOrganicSchema),
});

export async function fetchSerpResults(query: string, queryId: string): Promise<SerpResult[]> {
  if (!config.SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY is required');
  }

  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    num: '5',
    api_key: config.SERPER_API_KEY,
  });

  const response = await fetch(`https://serpapi.com/search.json?${params}`);

  if (response.status === 401) {
    throw new Error('Invalid SerpApi API key');
  }

  if (response.status === 429) {
    throw new Error('Rate limit reached, please retry');
  }

  if (!response.ok) {
    throw new Error(`SerpApi error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const parsed = SerpApiResponseSchema.parse(data);

  const serpResults = parsed.organic_results.slice(0, 5).map((item, index) => ({
    url: item.link,
    title: item.title,
    metaDescription: item.snippet,
    rawHtml: '',
    position: item.position ?? index + 1,
  }));

  console.log(`SERP: "${query}" returned ${serpResults.length} results`);

  await db.insert(serpResultsTable).values(
    serpResults.map((result) => ({
      queryId: queryId,
      url: result.url,
      title: result.title,
      metaDescription: result.metaDescription,
      rawHtml: result.rawHtml,
      serpPosition: result.position,
    })),
  );

  return serpResults;
}
