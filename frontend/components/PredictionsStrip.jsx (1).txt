"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export default function PredictionsStrip() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/predictions/info")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="card" id="predictions">
      <p style={{ marginTop: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>
        Live reproductive rights & women's health prediction markets — not financial advice
      </p>

      {error && <p style={{ color: "var(--muted)", fontSize: 14 }}>Live feed unavailable right now.</p>}

      {!data && !error && <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading live markets…</p>}

      {data && (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {(data.markets || []).slice(0, 5).map((m, i) => {
              // Events -> https://polymarket.com/event/<slug>; this is the
              // confirmed real Polymarket URL shape. There's no bare
              // /market/<slug> route to fall back to, so if a slug is ever
              // missing we just link to the Polymarket homepage instead of
              // guessing at a URL.
              const href = m.slug ? `https://polymarket.com/event/${m.slug}` : "https://polymarket.com";
              return (
                <a
                  key={m.id || i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card prediction-card"
                  style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
                >
                  <strong style={{ fontSize: 14 }}>{m.question || m.title || "Market"}</strong>
                  <span style={{ fontSize: 12, color: "var(--rosedeep)", flexShrink: 0 }}>View on Polymarket →</span>
                </a>
              );
            })}
            {(!data.markets || data.markets.length === 0) && (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>No open markets for this topic right now.</p>
            )}
          </div>
          <p className="disclaimer" style={{ marginTop: 12 }}>
            Source: {data.source === "live" ? "live from Polymarket" : "last known snapshot"}.{" "}
            {data.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
