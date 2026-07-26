import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// Fallback window only — if Polymarket is down, serve the most recent
// snapshot rather than a hard error, but always try live first. Real-time
// is the point of this endpoint.
const FALLBACK_MAX_AGE_MINUTES = 120;

// A single narrow keyword (e.g. just "abortion rights") is too thin —
// Polymarket's coverage of any one specific term fluctuates and can come
// back empty on a given day. Default to a small set of terms actually
// relevant to this product's audience, fetched in parallel and merged, so
// the section reliably has real content instead of "no markets right now."
const DEFAULT_TOPICS = ["abortion", "reproductive rights", "women's health"];
const CACHE_KEY = "women's health"; // single row key for the merged default fetch

// This endpoint is public and unauthenticated, so without a whitelist
// anyone could point it at any Polymarket search term (politics, sports,
// crypto...) — off-brand for a maternal/women's health product and
// effectively a free general-purpose Polymarket proxy. An explicit
// ?topic= must match one of these to be used on its own; anything else
// falls back to the default set rather than erroring or passing an
// arbitrary string through to Polymarket.
const ALLOWED_TOPICS = [
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
  "reproductive health",
  "reproductive rights",
  "abortion",
  "abortion rights",
  "abortion access",
  "abortion legislation",
  "birth control",
  "contraception",
  "Title X",
  "Roe v Wade",
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
  "healthcare policy",
  "health insurance policy",
  "Medicaid",
  "Affordable Care Act",
  "paid sick leave",
  "domestic violence",
];

function resolveTopics(rawTopic) {
  if (!rawTopic) return { topics: DEFAULT_TOPICS, cacheKey: CACHE_KEY };
  const requested = rawTopic.toString().trim().toLowerCase();
  const match = ALLOWED_TOPICS.find((t) => t.toLowerCase() === requested);
  return match
    ? { topics: [match], cacheKey: match }
    : { topics: DEFAULT_TOPICS, cacheKey: CACHE_KEY };
}

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

// NOTE: gamma-api.polymarket.com/markets?search=... does NOT do free-text
// search — it silently ignores the param and returns default/trending
// markets regardless of topic. /public-search is Polymarket's actual
// full-text search endpoint and returns matching *events* (each with their
// own markets nested inside), not a flat markets array, so we flatten
// events -> our own {id, question, slug} shape below.
//
// Polymarket's search is also fuzzy/relevance-ranked, not exact — for a
// low-volume topic it can fall back to a loosely-ranked, functionally
// unrelated result (e.g. an esports match) rather than returning nothing.
// We require the topic's own words to actually appear in the event before
// trusting it, since showing an unrelated result is worse than showing
// none for that particular topic (the multi-topic merge above is what
// keeps the section populated overall).
async function fetchTopic(topic) {
  const url = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(
    topic
  )}&limit_per_type=5&events_status=active`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Polymarket API returned ${resp.status} for "${topic}"`);
  const searchResults = await resp.json();

  const topicWords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const isRelevant = (event) => {
    const haystack = `${event.title || ""} ${event.description || ""}`.toLowerCase();
    return topicWords.some((w) => haystack.includes(w));
  };

  return (searchResults.events || []).filter(isRelevant).map((e) => ({
    id: e.id,
    question: e.title,
    slug: e.slug,
  }));
}

// Read-only, no auth, no consent flow. Informational only, clearly labeled.
// Always hits Polymarket's public gamma API live; predictions_cache is
// write-through history for /stats and a fallback if the live call fails,
// never a read-first cache.
router.get("/info", async (req, res) => {
  const { topics, cacheKey } = resolveTopics(req.query.topic);

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
