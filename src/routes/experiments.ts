import { Router } from "express";

export const experimentsRouter = Router();

experimentsRouter.get("/", (_req, res) => {
  res.json({ experiments: [] });
});
