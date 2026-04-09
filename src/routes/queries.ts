import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../models/db.js';
import { queries, serpResults, experiments, experimentRuns, citations } from '../models/schema.js';

export const queriesRouter = Router();

const createQuerySchema = z.object({
  query: z.string().min(1, 'Query must not be empty'),
});

// POST /api/queries — create a new query
queriesRouter.post('/', async (req, res) => {
  const parsed = createQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const [query] = await db.insert(queries).values({ queryText: parsed.data.query }).returning();

  res.status(201).json(query);
});

// GET /api/queries — list all queries with experiment count
queriesRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const results = await db
    .select({
      id: queries.id,
      queryText: queries.queryText,
      createdAt: queries.createdAt,
      experimentCount: sql<number>`count(${experiments.id})::int`,
    })
    .from(queries)
    .leftJoin(experiments, eq(queries.id, experiments.queryId))
    .groupBy(queries.id)
    .orderBy(desc(queries.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(queries);

  res.json({
    queries: results,
    pagination: { page, limit, total: count },
  });
});

// GET /api/queries/:id — single query with SERP results and experiments
queriesRouter.get('/:id', async (req, res) => {
  const [query] = await db.select().from(queries).where(eq(queries.id, req.params.id));

  if (!query) {
    res.status(404).json({ error: 'Query not found' });
    return;
  }

  const serpResultsList = await db
    .select()
    .from(serpResults)
    .where(eq(serpResults.queryId, query.id));

  const experimentsList = await db
    .select()
    .from(experiments)
    .where(eq(experiments.queryId, query.id))
    .orderBy(desc(experiments.createdAt));

  res.json({
    ...query,
    serpResults: serpResultsList,
    experiments: experimentsList,
  });
});

// DELETE /api/queries/:id — cascade delete query and all related data
queriesRouter.delete('/:id', async (req, res) => {
  const queryId = req.params.id;

  const [query] = await db.select().from(queries).where(eq(queries.id, queryId));
  if (!query) {
    res.status(404).json({ error: 'Query not found' });
    return;
  }

  // Get experiment IDs for this query
  const exps = await db
    .select({ id: experiments.id })
    .from(experiments)
    .where(eq(experiments.queryId, queryId));
  const expIds = exps.map((e) => e.id);

  if (expIds.length > 0) {
    // Get run IDs for these experiments
    const runs = await db
      .select({ id: experimentRuns.id })
      .from(experimentRuns)
      .where(sql`${experimentRuns.experimentId} IN ${expIds}`);
    const runIds = runs.map((r) => r.id);

    // Delete citations for these runs
    if (runIds.length > 0) {
      await db.delete(citations).where(sql`${citations.runId} IN ${runIds}`);
    }

    // Delete runs
    await db.delete(experimentRuns).where(sql`${experimentRuns.experimentId} IN ${expIds}`);

    // Delete experiments
    await db.delete(experiments).where(eq(experiments.queryId, queryId));
  }

  // Delete SERP results
  await db.delete(serpResults).where(eq(serpResults.queryId, queryId));

  // Delete query
  await db.delete(queries).where(eq(queries.id, queryId));

  res.status(204).send();
});
