import type { SerpResult, FormattedContent, ContentFormat } from '../models/types.js';
import { extractMainContent } from './html-extractor.js';
import TurndownService from 'turndown';

const turndownService = new TurndownService();

/* Converter functions that convert the fetched html into the required types for testing */

export function toRawHtml(serpResult: SerpResult, sourceId: string): FormattedContent {
  return {
    sourceId: sourceId, // unique ID for this source
    url: serpResult.url, // the page URL
    title: serpResult.title, // page title
    format: 'raw_html' as const, // 'raw_html' | 'clean_html' | 'markdown' | 'json_ld'
    content: serpResult.rawHtml, // the actual content in that format
  };
}

export function toCleanHtml(serpResult: SerpResult, sourceId: string): FormattedContent {
  const cleanHtmlContent = extractMainContent(serpResult.rawHtml, serpResult.url);
  return {
    sourceId: sourceId, // unique ID for this source
    url: serpResult.url, // the page URL
    title: cleanHtmlContent.title, // page title
    format: 'clean_html' as const, // 'raw_html' | 'clean_html' | 'markdown' | 'json_ld'
    content: cleanHtmlContent.content, // the actual content in that format
  };
}

export function toMarkDown(serpResult: SerpResult, sourceId: string): FormattedContent {
  const cleanHtml = toCleanHtml(serpResult, sourceId);
  const markdown = turndownService.turndown(cleanHtml.content);

  return {
    sourceId: sourceId, // unique ID for this source
    url: cleanHtml.url, // the page URL
    title: cleanHtml.title, // page title
    format: 'markdown' as const, // 'raw_html' | 'clean_html' | 'markdown' | 'json_ld'
    content: markdown, // the actual content in that format
  };
}

export function toJsonLd(serpResult: SerpResult, sourceId: string): FormattedContent {
  const mainContent = extractMainContent(serpResult.rawHtml, serpResult.url);
  const textContent = mainContent.textContent;

  const mentions = textContent.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g) || [];

  const json = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    name: mainContent.title,
    url: serpResult.url,
    description: serpResult.metaDescription,
    articleBody: mainContent.textContent,
    mentions: mentions.map((name) => ({ '@type': 'Thing', name: name })),
  };

  return {
    sourceId: sourceId, // unique ID for this source
    url: serpResult.url, // the page URL
    title: mainContent.title, // page title
    format: 'json_ld' as const, // 'raw_html' | 'clean_html' | 'markdown' | 'json_ld'
    content: JSON.stringify(json, null, 2), // the actual content in that format
  };
}

export function convertAllFormats(
  serpResult: SerpResult,
  sourceId: string,
): Record<ContentFormat, FormattedContent> {
  const rawHtml = toRawHtml(serpResult, sourceId);
  const cleanHtml = toCleanHtml(serpResult, sourceId);
  const markDown = toMarkDown(serpResult, sourceId);
  const jsonLd = toJsonLd(serpResult, sourceId);
  return {
    raw_html: rawHtml,
    clean_html: cleanHtml,
    markdown: markDown,
    json_ld: jsonLd,
  };
}

export function convertToFormat(
  serpResult: SerpResult,
  sourceId: string,
  format: ContentFormat,
): FormattedContent {
  const funcMap = {
    raw_html: toRawHtml,
    clean_html: toCleanHtml,
    markdown: toMarkDown,
    json_ld: toJsonLd,
  };
  const method = funcMap[format];
  return method(serpResult, sourceId);
}
