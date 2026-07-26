import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// Fallback window only — if Polymarket is down, serve the most recent
// snapshot rather than a hard error, but always try live first. Real-time
// is the point of this endpoint.
const FALLBACK_MAX_AGE_MINUTES = 120;

// A single narrow keyword (e.g. just "maternity leave") is too thin —
// Polymarket's coverage of any one specific term fluctuates and can come
// back empty on a given day. Default to a small set of terms actually
// relevant to this product's audience (reproductive rights / abortion
// policy / women's health), fetched in parallel and merged, so the
// section reliably has real content instead of "no markets right now."
// A caller can still override with ?topic=<single term> for a narrower
// look.
const DEFAULT_TOPICS = ["abortion", "reproductive rights", "women's health"];
const CACHE_KEY = "women's health"; // single row key for the merged default fetch

function dedupeMarkets(marketArrays) {
  const seen = new Set();
  const merged = [];
  for (const markets of marketArrays) {
    for (const m of markets) {
      const key = m.id || m.slug || m.question;
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(m);
      }
    }
  }
  return merged;
}

async function fetchTopic(topic) {
  const url = `https://gamma-api.polymarket.com/markets?closed=false&search=${encodeURIComponent(topic)}&limit=5`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Polymarket API returned ${resp.status} for "${topic}"`);
  return resp.json();
}

// Read-only, no auth, no consent flow. Informational only, clearly labeled.
// Always hits Polymarket's public gamma API live; predictions_cache is
// write-through history for /stats and a fallback if the live call fails,
// never a read-first cache.
router.get("/info", async (req, res) => {
  const explicitTopic = req.query.topic ? req.query.topic.toString() : null;
  const topics = explicitTopic ? [explicitTopic] : DEFAULT_TOPICS;
  const cacheKey = explicitTopic || CACHE_KEY;

  try {
    const results = await Promise.allSettled(topics.map(fetchTopic));
    const succeededMarkets = results.filter((r) => r.status === "fulfilled").map((r) => r.value);

    if (succeededMarkets.length === 0) {
      // Every topic's live fetch failed — treat this the same as the
      // outer catch, fall through to cache.
      throw new Error(results[0].reason?.message || "All live fetches failed");
    }

    const markets = dedupeMarkets(succeededMarkets).slice(0, 8);

    await query(
      `INSERT INTO predictions_cache (topic, data_json, fetched_at)
       VALUES ($1, $2, NOW())`,
      [cacheKey, JSON.stringify(markets)]
    );

    res.json({
      topic: cacheKey,
      topics_searched: topics,
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
      [cacheKey]
    );

    if (fallback.rows.length) {
      return res.json({
        topic: cacheKey,
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
