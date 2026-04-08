import { Router } from 'express';

export const queriesRouter = Router();

queriesRouter.get('/', (_req, res) => {
  res.json({ queries: [] });
});
