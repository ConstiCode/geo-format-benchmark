import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/geo_benchmark"),
  FIRESTORE_PROJECT_ID: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
});

export const config = envSchema.parse(process.env);
