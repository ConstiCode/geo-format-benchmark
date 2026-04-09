import { fetchSerpResults } from '../pipeline/serp-fetcher.js';
import { fetchAndExtract } from '../pipeline/html-extractor.js';
import { convertAllFormats } from '../pipeline/format-converter.js';
import { db } from '../models/db.js';
import { queries } from '../models/schema.js';
import { writeFileSync } from 'fs';

async function main() {
  // 1. Create a real query in the DB so FK works
  const [query] = await db
    .insert(queries)
    .values({ queryText: 'Besten Deutschen Fahrrad Onlineshops' })
    .returning();
  console.log(`Created query: ${query.id}`);

  // 2. Fetch SERP results
  const results = await fetchSerpResults('Besten Deutschen Fahrrad Onlineshops', query.id);
  console.log(`Got ${results.length} SERP results`);
  writeFileSync('data/test-serp-results.json', JSON.stringify(results, null, 2));

  // 3. Fetch HTML for the first result
  console.log(`\nFetching HTML for: ${results[0].url}`);
  const withHtml = await fetchAndExtract(results[0], query.id);
  console.log(`HTML length: ${withHtml.rawHtml.length} chars`);

  // 4. Convert to all 4 formats
  const formats = convertAllFormats(withHtml, 'test-source-1');
  for (const [format, content] of Object.entries(formats)) {
    console.log(`\n=== ${format} (${content.content.length} chars) ===`);
    console.log(content.content.substring(0, 500));
    console.log('...');
  }

  // Save full output for inspection
  writeFileSync('data/test-formats.json', JSON.stringify(formats, null, 2));

  console.log('\nDone! Check data/test-serp-results.json and data/test-formats.json');
  process.exit(0);
}

main();
