import { LlmProvider, LlmResponse } from '../models/types.js';
import OpenAI from 'openai';
import { config } from '../config.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

const openAi = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const genAI = new GoogleGenerativeAI(String(config.GOOGLE_AI_API_KEY));
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const anthropic = new Anthropic({ apiKey: String(config.ANTHROPIC_API_KEY) });

const perplexity = new OpenAI({
  apiKey: config.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai',
});

async function callOpenAi(prompt: string): Promise<LlmResponse> {
  const start = Date.now();

  const response = await openAi.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const usage = response.usage;

  return {
    content: response.choices[0].message.content ?? '',
    provider: 'OpenAi',
    model: 'gpt-4o-mini',
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - start,
  };
}

async function callGemini(prompt: string): Promise<LlmResponse> {
  const start = Date.now();

  const response = await model.generateContent(prompt);

  return {
    content: response.response.text(),
    provider: 'Google',
    model: 'gemini-flash',
    inputTokens: response.response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.response.usageMetadata?.candidatesTokenCount ?? 0,
    latencyMs: Date.now() - start,
  };
}

async function callClaude(prompt: string): Promise<LlmResponse> {
  const start = Date.now();

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    content: response.content[0].type === 'text' ? response.content[0].text : '',
    provider: 'Anthropic',
    model: 'claude-haiku',
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    latencyMs: Date.now() - start,
  };
}

async function callPerplexity(prompt: string): Promise<LlmResponse> {
  const start = Date.now();

  const response = await perplexity.chat.completions.create({
    model: 'sonar',
    temperature: 0,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const usage = response.usage;

  return {
    content: response.choices[0].message.content ?? '',
    provider: 'Perplexity',
    model: 'perplexity-sonar',
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - start,
  };
}

export async function complete(prompt: string, provider: LlmProvider): Promise<LlmResponse> {
  const funcMap = {
    OpenAi: callOpenAi,
    Google: callGemini,
    Anthropic: callClaude,
    Perplexity: callPerplexity,
  };

  const method = funcMap[provider];
  return method(prompt);
}
