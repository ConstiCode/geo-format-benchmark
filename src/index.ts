import express from "express";
import { experimentsRouter } from "./routes/experiments.js";
import { queriesRouter } from "./routes/queries.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.use("/api/experiments", experimentsRouter);
app.use("/api/queries", queriesRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
