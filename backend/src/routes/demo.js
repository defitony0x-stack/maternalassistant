import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { query } from "../db.js";
import { generateReport } from "../services/reportService.js";
import { draftLetter } from "../services/letterService.js";

const router = Router();

// Unauthenticated, rate-limited, never touches users/entries/reports tables.
const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demo limit reached. Sign up on OKX AI to continue." },
});

router.post("/generate", demoLimiter, async (req, res) => {
  const { scenario, mode } = req.body; // mode: "report" | "letter"
  if (!scenario) return res.status(400).json({ error: "scenario is required" });

  let sessionId = req.cookies?.mhc_demo_session;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.cookie("mhc_demo_session", sessionId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
  }

  const syntheticEntry = [{ type: "text", content: scenario, created_at: new Date().toISOString() }];

  try {
    const content =
      mode === "letter"
        ? await draftLetter("demo request", "professional", syntheticEntry)
        : await generateReport(syntheticEntry);

    await query(
      `INSERT INTO demo_sessions (session_id, scenario, mode, result_json)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, scenario, mode || "report", JSON.stringify(content)]
    );

    res.json({
      content,
      demo: true,
      banner: "Demo mode. Nothing here is saved. Continue on OKX AI to keep your history.",
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
