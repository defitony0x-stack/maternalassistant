import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// Fallback window only — if Polymarket is down, serve the most recent
// snapshot rather than a hard error, but always try live first. Real-time
// is the point of this endpoint.
const FALLBACK_MAX_AGE_MINUTES = 120;

// This endpoint is public and unauthenticated, so without a whitelist
// anyone could point it at any Polymarket search term (politics, sports,
// crypto...) — off-brand for a maternal/women's health product and
// effectively a free general-purpose Polymarket proxy. The list below
// covers pregnancy/postpartum (core product focus), reproductive health
// and rights, and women's health more broadly, including policy topics
// that disproportionately affect women. Only these topics are servable;
// anything else falls back to the default rather than erroring, so a
// slightly-off request still gets a sensible, on-topic response.
const ALLOWED_TOPICS = [
  // Pregnancy & postpartum — core product focus
  "maternity leave",
  "pregnancy",
  "postpartum",
  "postpartum depression",
  "maternal health",
  "maternal mortality",
  "IVF",
  "fertility",
  "childcare",
  "paid family leave",
  "family and medical leave act",

  // Reproductive health & rights / policy
  "reproductive health",
  "reproductive rights",
  "abortion rights",
  "abortion access",
  "abortion legislation",
  "birth control",
  "contraception",
  "Title X",
  "Roe v Wade",

  // Women's health more broadly
  "women's health",
  "women's healthcare",
  "women's health policy",
  "menopause",
  "menstrual health",
  "endometriosis",
  "PCOS",
  "breast cancer",
  "cervical cancer",
  "ovarian cancer",
  "gender health equity",

  // Health policy that disproportionately affects women/mothers
  "healthcare policy",
  "health insurance policy",
  "Medicaid",
  "Affordable Care Act",
  "paid sick leave",
  "domestic violence",
];
const DEFAULT_TOPIC = "maternity leave";

function resolveTopic(rawTopic) {
  const requested = (rawTopic || DEFAULT_TOPIC).toString().trim().toLowerCase();
  const match = ALLOWED_TOPICS.find((t) => t.toLowerCase() === requested);
  return match || DEFAULT_TOPIC;
}

// Read-only, no auth, no consent flow. Informational only, clearly labeled.
// Always hits Polymarket's public gamma API live; predictions_cache is
// write-through history for /stats and a fallback if the live call fails,
// never a read-first cache.
router.get("/info", async (req, res) => {
  const topic = resolveTopic(req.query.topic);

  try {
    // NOTE: gamma-api.polymarket.com/markets?search=... does NOT do free-text
    // search — it silently ignores the param and returns default/trending
    // markets, which is why this endpoint used to show unrelated markets
    // (album drops, GTA VI, politics) no matter what topic was requested.
    // /public-search is Polymarket's actual full-text search endpoint and
    // returns matching *events* (each with their own markets nested inside),
    // not a flat markets array, so we flatten events -> our own market shape
    // below rather than passing the raw response through.
    const url = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(
      topic
    )}&limit_per_type=5&events_status=active`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Polymarket API returned ${resp.status}`);
    const searchResults = await resp.json();

    const markets = (searchResults.events || []).slice(0, 5).map((e) => ({
      id: e.id,
      question: e.title,
      slug: e.slug,
    }));

    await query(
      `INSERT INTO predictions_cache (topic, data_json, fetched_at)
       VALUES ($1, $2, NOW())`,
      [topic, JSON.stringify(markets)]
    );

    res.json({
      topic,
      source: "live",
      fetched_at: new Date().toISOString(),
      markets,
      disclaimer: "Informational only. Not financial advice.",
    });
  } catch (err) {
    const fallback = await query(
      `SELECT data_json, fetched_at FROM predictions_cache
       WHERE topic = $1 AND fetched_at > NOW() - INTERVAL '${FALLBACK_MAX_AGE_MINUTES} minutes'
       ORDER BY fetched_at DESC LIMIT 1`,
      [topic]
    );

    if (fallback.rows.length) {
      return res.json({
        topic,
        source: "stale_fallback",
        fetched_at: fallback.rows[0].fetched_at,
        markets: fallback.rows[0].data_json,
        disclaimer: "Informational only. Not financial advice. Live fetch failed; showing last known data.",
      });
    }

    res.status(502).json({ error: err.message });
  }
});

export default router;
