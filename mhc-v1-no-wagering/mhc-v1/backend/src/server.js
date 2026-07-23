import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import usersRoutes from "./routes/users.js";
import ingestRoutes from "./routes/ingest.js";
import generateRoutes from "./routes/generate.js";
import predictionsRoutes from "./routes/predictions.js";
import anchorRoutes from "./routes/anchor.js";
import demoRoutes from "./routes/demo.js";
import statsRoutes from "./routes/stats.js";

const app = express();

const rawOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);

if (rawOrigins.length === 0) {
  if (process.env.NODE_ENV === "production") {
    // Fail loudly at boot instead of silently blocking every request.
    // A missing CORS_ORIGIN used to produce allowedOrigins = [""], which
    // rejects every browser request with no clue why in the response.
    console.error("CORS_ORIGIN is not set. Refusing to start in production without it.");
    process.exit(1);
  }
  console.warn("CORS_ORIGIN is not set, defaulting to http://localhost:3001 for local dev.");
  rawOrigins.push("http://localhost:3001");
}

app.use(cors({ origin: rawOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/users", usersRoutes);
app.use("/ingest", ingestRoutes);
app.use("/generate", generateRoutes);
app.use("/predictions", predictionsRoutes);
app.use("/anchor", anchorRoutes);
app.use("/demo", demoRoutes);
app.use("/stats", statsRoutes);

// This same generate/report and generate/letter logic is what the OKX
// A2MCP handler will call once the ASP is registered on OKX AI Marketplace.
// Add that handler as its own route later, calling the services in
// src/services directly, same as generate.js does.

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MHC backend listening on ${PORT}`));
