import { config } from '../config.js';
import { SerpResult } from '../models/types.js';
import { z } from 'zod';
import { db } from '../models/db.js';
import { serpResults as serpResultsTable } from '../models/schema.js';

// The Serp API has a free tier limit of 2500 queries

const SerperOrganicSchema = z.object({
  title: z.string(),
  link: z.string(),
  snippet: z.string(),
  position: z.number(),
});

const SerperResponseSchema = z.object({
  organic: z.array(SerperOrganicSchema),
});

export async function fetchSerpResults(query: string, queryId: string): Promise<SerpResult[]> {
  if (!config.SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY is required');
  }
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': config.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });

  if (response.status == 401) {
    throw new Error('Invalid SERPER_API_KEY');
  }

  if (response.status == 429) {
    throw new Error('Rate Limit reached please retry');
  }

  if (!response.ok) {
    throw new Error('There was an error fetching series results.');
  }

  const data = await response.json();
  const parsed = SerperResponseSchema.parse(data);

  const serpResults = parsed.organic.map((item) => ({
    url: item.link,
    title: item.title,
    metaDescription: item.snippet,
    rawHtml: '',
    position: item.position,
  }));

  console.log(`SERP: "${query}" returned ${serpResults.length} results`);

  // write the results into the db
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
