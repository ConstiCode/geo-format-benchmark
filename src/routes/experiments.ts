import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '../models/db.js';
import { experiments, experimentRuns, citations, queries } from '../models/schema.js';
import { LlmProvider } from '../models/types.js';
import { runExperiment } from '../pipeline/experiment-runner.js';
import { calculateAllMetrics, type RunWithCitations } from '../analysis/metrics.js';
import type { ContentFormat, LlmProvider as LlmProviderType } from '../models/types.js';
import { randomUUID } from 'crypto';

export const experimentsRouter = Router();

// --- Validation schemas ---

const createExperimentSchema = z.object({
  queryId: z.string().uuid(),
  llmProviders: z.array(LlmProvider).min(1),
  enablePositionRotation: z.boolean().default(false),
});

// --- POST /api/experiments ---
experimentsRouter.post('/', async (req, res) => {
  // Create a new experiment and trigger it asynchronously.
  const parsed = createExperimentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  let totalRuns =
    15 * (parsed.data.enablePositionRotation ? 5 : 1) * parsed.data.llmProviders.length;

  const [experiment] = await db
    .insert(experiments)
    .values({
      id: randomUUID(),
      queryId: parsed.data.queryId,
      llmProviders: parsed.data.llmProviders,
      enablePositionRotation: parsed.data.enablePositionRotation,
      totalRuns: totalRuns,
      status: 'pending',
    })
    .returning();

  const [queryRecord] = await db.select().from(queries).where(eq(queries.id, parsed.data.queryId));

  const config = {
    id: experiment.id,
    query: queryRecord.queryText,
    llmProviders: parsed.data.llmProviders,
    enablePositionRotation: parsed.data.enablePositionRotation,
    createdAt: new Date(),
  };

  runExperiment(config, parsed.data.queryId);

  res.status(201).json({
    id: experiment.id,
    status: 'pending',
    totalRuns: totalRuns,
  });
  return;
});

// --- GET /api/experiments ---
experimentsRouter.get('/', async (req, res) => {
  // --- GET /api/experiments ---
  // List all experiments, ordered by created_at DESC.
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const allExperiments = await db.select({ count: sql<number>`count(*)::int` }).from(experiments);

  const offset = (page - 1) * limit;

  const result = await db
    .select()
    .from(experiments)
    .orderBy(desc(experiments.createdAt))
    .limit(limit)
    .offset(offset);

  res.status(200).json({
    experiments: result,
    pagination: { page, limit, total: allExperiments[0].count },
  });

  return;
});

// --- GET /api/experiments/:id ---
experimentsRouter.get('/:id', async (req, res) => {
  const id = req.params.id;

  const [experiment] = await db.select().from(experiments).where(eq(experiments.id, id));
  const [{ count: completedCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(experimentRuns)
    .where(and(eq(experimentRuns.experimentId, id), eq(experimentRuns.status, 'completed')));

  if (!experiment) {
    res.status(404).json({ error: 'Experiment not found' });
    return;
  }
  res.status(200).json({
    id: id,
    record: experiment,
    completed: completedCount,
  });
  return;
});

// --- GET /api/experiments/:id/runs ---
experimentsRouter.get('/:id/runs', async (req, res) => {
  const id = req.params.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  // Build filter conditions
  const conditions = [eq(experimentRuns.experimentId, id)];
  if (req.query.llm) conditions.push(eq(experimentRuns.llmProvider, req.query.llm as string));
  if (req.query.format) conditions.push(eq(experimentRuns.testFormat, req.query.format as string));
  if (req.query.status) conditions.push(eq(experimentRuns.status, req.query.status as string));

  const runs = await db
    .select()
    .from(experimentRuns)
    .where(and(...conditions))
    .orderBy(experimentRuns.runNumber)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(experimentRuns)
    .where(and(...conditions));

  res.json({
    runs,
    pagination: { page, limit, total: count },
  });
});

// --- GET /api/experiments/:id/metrics ---
experimentsRouter.get('/:id/metrics', async (req, res) => {
  const id = req.params.id;

  const [experiment] = await db.select().from(experiments).where(eq(experiments.id, id));
  if (!experiment) {
    res.status(404).json({ error: 'Experiment not found' });
    return;
  }
  if (experiment.status !== 'completed') {
    res.status(404).json({ error: 'Experiment not yet complete' });
    return;
  }

  // Get all completed runs
  const runs = await db
    .select()
    .from(experimentRuns)
    .where(and(eq(experimentRuns.experimentId, id), eq(experimentRuns.status, 'completed')));

  // Build RunWithCitations[]
  const runsWithCitations: RunWithCitations[] = [];
  for (const run of runs) {
    const cits = await db.select().from(citations).where(eq(citations.runId, run.id));

    // Reconstruct sourceFormats from testSourceIndex + testFormat
    const sourceFormats: ContentFormat[] = Array(5).fill('clean_html');
    sourceFormats[run.testSourceIndex] = run.testFormat as ContentFormat;

    runsWithCitations.push({
      runConfig: {
        runNumber: run.runNumber,
        testSourceIndex: run.testSourceIndex,
        testFormat: run.testFormat as ContentFormat,
        sourceFormats,
        sourceOrder: run.sourceOrder,
        llmProvider: run.llmProvider as LlmProviderType,
      },
      citations: cits.map((c) => ({
        runId: c.runId,
        sourceIndex: c.sourceIndex,
        citationRank: c.citationRank,
        sentiment: c.sentiment as 'positive' | 'neutral' | 'negative',
        contextSnippet: c.contextSnippet ?? '',
      })),
    });
  }

  const metrics = calculateAllMetrics(runsWithCitations);
  res.json(metrics);
});
