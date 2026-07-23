import { Router } from "express";
import { requireAuth } from "../auth.js";
import { query } from "../db.js";
import { generateReport } from "../services/reportService.js";
import { draftLetter } from "../services/letterService.js";
import { generatePrepSheet } from "../services/prepService.js";

const router = Router();

async function recentEntries(userId, limit = 20) {
  const result = await query(
    `SELECT id, type, content, created_at FROM entries
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

router.post("/report", requireAuth, async (req, res) => {
  try {
    const entries = await recentEntries(req.userId);
    const content = await generateReport(entries);

    const saved = await query(
      `INSERT INTO reports (user_id, entry_ids, content_json)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [req.userId, entries.map((e) => e.id), JSON.stringify(content)]
    );

    res.json({ id: saved.rows[0].id, created_at: saved.rows[0].created_at, content });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/prep", requireAuth, async (req, res) => {
  try {
    const entries = await recentEntries(req.userId);
    const content = await generatePrepSheet(entries);
    res.json({ content });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/letter", requireAuth, async (req, res) => {
  const { purpose, tone } = req.body;
  if (!purpose) return res.status(400).json({ error: "purpose is required" });

  try {
    const entries = await recentEntries(req.userId);
    const content = await draftLetter(purpose, tone, entries);

    const saved = await query(
      `INSERT INTO letters (user_id, purpose, draft_content, approved)
       VALUES ($1, $2, $3, false) RETURNING id, created_at`,
      [req.userId, purpose, JSON.stringify(content)]
    );

    res.json({ id: saved.rows[0].id, created_at: saved.rows[0].created_at, content });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
