import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { investigateCase } from "./investigation";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, agent: "sentinelgraph-investigator", graph_mode: process.env.TIGERGRAPH_HOST ? "tigergraph-rest" : "demo-adapter", tigergraph_configured: Boolean(process.env.TIGERGRAPH_HOST), policy_enforced: true });
  });

  app.post("/api/investigate", async (req, res) => {
    try {
      const caseId = String(req.body?.case_id || req.body?.transaction_id || "HHG-001");
      const trigger = String(req.body?.trigger || "analyst_request");
      res.json(await investigateCase(caseId.startsWith("HHG-") ? caseId : `HHG-${caseId.padStart(3, "0")}`, trigger));
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Investigation failed" });
    }
  });

  app.post("/api/cases/:caseId/investigate", async (req, res) => {
    try { res.json(await investigateCase(req.params.caseId, String(req.body?.trigger || "analyst_request"))); }
    catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Investigation failed" }); }
  });

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
