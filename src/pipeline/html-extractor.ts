import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { JSDOM } from 'jsdom';
import { eq } from 'drizzle-orm';
import { db } from '../models/db.js';
import { serpResults as serpResultsTable } from '../models/schema.js';
import type { SerpResult } from '../models/types.js';

const TIMEOUT_MS = 10_000;
const STRIP_TAGS = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe'];

/**
 * Fetch raw HTML from a URL with timeout and redirect handling.
 */
export async function fetchPageHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; GEOBenchmarkBot/1.0; +https://github.com/ConstiCode/geo-format-benchmark)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (response.status === 403) {
      throw new Error(`Access blocked by ${url} (403 Forbidden)`);
    }
    if (response.status === 404) {
      throw new Error(`Page not found: ${url} (404)`);
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Timeout fetching ${url} after ${TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ExtractedContent {
  title: string;
  content: string;
  textContent: string;
}

/**
 * Extract main article content from raw HTML using Readability with cheerio fallback.
 */
export function extractMainContent(rawHtml: string, url: string): ExtractedContent {
  // Try @mozilla/readability first
  const dom = new JSDOM(rawHtml, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article && article.content && article.content.trim().length > 0) {
    const cleanedHtml = stripTags(article.content);
    return {
      title: article.title || '',
      content: cleanedHtml,
      textContent: article.textContent || '',
    };
  }

  // Fallback: use cheerio to extract main content
  return extractWithCheerio(rawHtml);
}

/**
 * Cheerio fallback: extract content from <main>, <article>, or <body>.
 */
function extractWithCheerio(rawHtml: string): ExtractedContent {
  const $ = cheerio.load(rawHtml);

  // Remove unwanted tags
  STRIP_TAGS.forEach((tag) => $(tag).remove());

  // Try semantic containers in order of preference
  let contentEl = $('main');
  if (contentEl.length === 0) contentEl = $('article');
  if (contentEl.length === 0) contentEl = $('body');

  // Remove class/id attributes and inline styles
  contentEl.find('*').each((_, el) => {
    const elem = $(el);
    elem.removeAttr('class');
    elem.removeAttr('id');
    elem.removeAttr('style');
  });

  const content = contentEl.html()?.trim() || '';
  const textContent = contentEl.text()?.trim() || '';
  const title = $('title').text().trim() || $('h1').first().text().trim() || '';

  return { title, content, textContent };
}

/**
 * Strip unwanted tags from HTML string while preserving semantic content.
 */
function stripTags(html: string): string {
  const $ = cheerio.load(html);

  STRIP_TAGS.forEach((tag) => $(tag).remove());

  // Remove class/id attributes and inline styles
  $('*').each((_, el) => {
    const elem = $(el);
    elem.removeAttr('class');
    elem.removeAttr('id');
    elem.removeAttr('style');
  });

  // Remove empty tags (except self-closing ones like <br>, <img>)
  $('*')
    .filter((_, el) => {
      const elem = $(el);
      const tagName = (el as Element).tagName?.toLowerCase();
      const selfClosing = ['br', 'hr', 'img', 'input'];
      return !selfClosing.includes(tagName) && elem.html()?.trim() === '' && !elem.text().trim();
    })
    .remove();

  return $('body').html()?.trim() || '';
}

/**
 * Fetch page HTML, extract content, and update the SERP result in the database.
 */
export async function fetchAndExtract(
  serpResult: SerpResult,
  serpResultId: string,
): Promise<SerpResult> {
  const rawHtml = await fetchPageHtml(serpResult.url);
  const extracted = extractMainContent(rawHtml, serpResult.url);

  const updatedResult: SerpResult = {
    ...serpResult,
    rawHtml,
    title: extracted.title || serpResult.title,
  };

  // Update the serp_results row with the fetched HTML
  await db.update(serpResultsTable).set({ rawHtml }).where(eq(serpResultsTable.id, serpResultId));

  console.log(`HTML: Extracted ${extracted.content.length} chars from ${serpResult.url}`);

  return updatedResult;
}
