import { Router } from "express";
import { query } from "../db.js";

const router = Router();
const CACHE_TTL_MINUTES = 30;

// Read-only, no auth, no consent flow. Informational only, clearly labeled.
// Pulls from Polymarket's public gamma API and caches results, same pattern
// used in the earlier Sports Prediction Market Arb Engine work.
router.get("/info", async (req, res) => {
  const topic = (req.query.topic || "maternity leave").toString();

  const cached = await query(
    `SELECT topic, data_json, fetched_at FROM predictions_cache
     WHERE topic = $1 AND fetched_at > NOW() - INTERVAL '${CACHE_TTL_MINUTES} minutes'
     ORDER BY fetched_at DESC LIMIT 1`,
    [topic]
  );

  if (cached.rows.length) {
    return res.json({
      topic,
      source: "cache",
      markets: cached.rows[0].data_json,
      disclaimer: "Informational only. Not financial advice.",
    });
  }

  try {
    const url = `https://gamma-api.polymarket.com/markets?closed=false&search=${encodeURIComponent(
      topic
    )}&limit=5`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Polymarket API returned ${resp.status}`);
    const markets = await resp.json();

    await query(
      `INSERT INTO predictions_cache (topic, data_json, fetched_at)
       VALUES ($1, $2, NOW())`,
      [topic, JSON.stringify(markets)]
    );

    res.json({
      topic,
      source: "live",
      markets,
      disclaimer: "Informational only. Not financial advice.",
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
