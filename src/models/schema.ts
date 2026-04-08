import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

// --- Tables ---

export const queries = pgTable('queries', {
  id: uuid('id').defaultRandom().primaryKey(),
  queryText: text('query_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const serpResults = pgTable('serp_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  queryId: uuid('query_id')
    .notNull()
    .references(() => queries.id),
  url: text('url').notNull(),
  title: text('title').notNull(),
  metaDescription: text('meta_description'),
  rawHtml: text('raw_html').notNull(),
  serpPosition: integer('serp_position').notNull(),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
});

export const experiments = pgTable('experiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  queryId: uuid('query_id')
    .notNull()
    .references(() => queries.id),
  llmProviders: text('llm_providers').array().notNull(),
  enablePositionRotation: boolean('enable_position_rotation').default(false).notNull(),
  totalRuns: integer('total_runs').notNull(),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const experimentRuns = pgTable('experiment_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id')
    .notNull()
    .references(() => experiments.id),
  runNumber: integer('run_number').notNull(),
  llmProvider: text('llm_provider').notNull(),
  testSourceIndex: integer('test_source_index').notNull(),
  testFormat: text('test_format').notNull(),
  sourceOrder: integer('source_order').array().notNull(),
  prompt: text('prompt').notNull(),
  rawResponse: text('raw_response'),
  status: text('status').default('pending').notNull(),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const citations = pgTable('citations', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id')
    .notNull()
    .references(() => experimentRuns.id),
  sourceIndex: integer('source_index').notNull(),
  citationRank: integer('citation_rank').notNull(),
  sentiment: text('sentiment').notNull(),
  contextSnippet: text('context_snippet'),
  sourceUrl: text('source_url'),
  sourceFormat: text('source_format').notNull(),
});

// --- Relations ---

export const queriesRelations = relations(queries, ({ many }) => ({
  serpResults: many(serpResults),
  experiments: many(experiments),
}));

export const serpResultsRelations = relations(serpResults, ({ one }) => ({
  query: one(queries, {
    fields: [serpResults.queryId],
    references: [queries.id],
  }),
}));

export const experimentsRelations = relations(experiments, ({ one, many }) => ({
  query: one(queries, {
    fields: [experiments.queryId],
    references: [queries.id],
  }),
  runs: many(experimentRuns),
}));

export const experimentRunsRelations = relations(experimentRuns, ({ one, many }) => ({
  experiment: one(experiments, {
    fields: [experimentRuns.experimentId],
    references: [experiments.id],
  }),
  citations: many(citations),
}));

export const citationsRelations = relations(citations, ({ one }) => ({
  run: one(experimentRuns, {
    fields: [citations.runId],
    references: [experimentRuns.id],
  }),
}));
