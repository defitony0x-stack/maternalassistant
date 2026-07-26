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

const DEMO_WORD_LIMIT = 25;

// The demo is a teaser, not the product. Full-length reports/letters are
// the paid A2MCP service on OKX AI. Truncating here (server-side, so it
// can't be bypassed from the client) keeps that boundary real.
//
// Cutting mid-sentence at exactly N words reads as broken, not enticing
// ("...I require" trailing off looks like a bug report, not a preview).
// Instead: cut at the last complete sentence that fits within the word
// budget, and label the cut explicitly so it's unambiguous this is
// intentional. Falls back to a hard word-cut only if there's no sentence
// boundary at all within budget (e.g. one long run-on).
const CONTINUE_LABEL = " [continues on OKX AI Marketplace — full version]";

function truncateToWords(value, limit) {
  if (typeof value === "string") {
    const words = value.trim().split(/\s+/);
    if (words.length <= limit) return value;

    const budget = words.slice(0, limit).join(" ");
    const sentenceEnds = [...budget.matchAll(/[.!?](?:\s|$)/g)].map((m) => m.index + 1);
    const lastSentenceEnd = sentenceEnds.length ? sentenceEnds[sentenceEnds.length - 1] : null;

    // Only use the sentence boundary if it doesn't throw away more than
    // ~40% of the word budget — otherwise a short first sentence would
    // make the preview feel stingier than the word cap actually allows.
    const text =
      lastSentenceEnd && lastSentenceEnd > budget.length * 0.6 ? budget.slice(0, lastSentenceEnd).trim() : budget;

    return text + CONTINUE_LABEL;
  }
  if (value && typeof value === "object") {
    const out = Array.isArray(value) ? [] : {};
    for (const key of Object.keys(value)) {
      out[key] = truncateToWords(value[key], limit);
    }
    return out;
  }
  return value;
}

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
    const fullContent =
      mode === "letter"
        ? await draftLetter("demo request", "professional", syntheticEntry)
        : await generateReport(syntheticEntry);

    const content = truncateToWords(fullContent, DEMO_WORD_LIMIT);

    await query(
      `INSERT INTO demo_sessions (session_id, scenario, mode, result_json)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, scenario, mode || "report", JSON.stringify(content)]
    );

    res.json({
      content,
      demo: true,
      banner: `Demo preview, capped at ${DEMO_WORD_LIMIT} words per field. Full-length reports and letters run through the OKX AI Marketplace listing.`,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
