"use client";

import { useState } from "react";
import { apiPost } from "../lib/api";
import { SOCIAL_LINKS } from "./SocialLinks";

const SCENARIOS = [
  { label: "28 weeks, mild headaches", value: "I'm 28 weeks pregnant and have had mild headaches for the past 3 days, worse in the afternoon. Sleeping okay, drinking less water than usual.", mode: "report" },
  { label: "6 weeks postpartum, need a leave extension letter", value: "I'm 6 weeks postpartum and my doctor recommended 2 more weeks before returning to work due to a slow-healing C-section incision.", mode: "letter" },
];

export default function DemoBox() {
  const [customText, setCustomText] = useState("");
  const [mode, setMode] = useState("report");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runDemo(scenarioText, scenarioMode) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost("/demo/generate", {
        scenario: scenarioText,
        mode: scenarioMode,
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" id="demo">
      <p style={{ marginTop: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>
        Try it now. No account, nothing saved.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            className="pill"
            style={{ border: "none" }}
            onClick={() => runDemo(s.value, s.mode)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <textarea
        rows={3}
        placeholder="Or describe your own situation..."
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: "auto" }}>
          <option value="report">Generate a report</option>
          <option value="letter">Draft a letter</option>
        </select>
        <button
          className="btn-primary"
          disabled={!customText || loading}
          onClick={() => runDemo(customText, mode)}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && <p style={{ color: "#a33", marginTop: 12 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <DemoResult content={result.content} mode={mode} />
          <div className="banner-demo">{result.banner}</div>
          <a href={SOCIAL_LINKS.okxListing}>
            <button className="btn-secondary" style={{ marginTop: 12 }}>
              Access full usage via OKX Marketplace
            </button>
          </a>
        </div>
      )}
    </div>
  );
}

// Renders the demo's actual fields instead of dumping raw JSON at a
// first-time visitor — that reads as broken, not as a preview. Falls
// back to a plain-text rendering (never raw braces) if the shape doesn't
// match what's expected, so a future field change degrades gracefully
// instead of showing nothing.
function DemoResult({ content, mode }) {
  const box = {
    background: "var(--mist)",
    padding: 16,
    borderRadius: 10,
    border: "1px solid var(--line)",
  };

  if (mode === "letter" && content?.subject) {
    return (
      <div style={box}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{content.subject}</p>
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {content.body}
        </p>
        {content.tone_notes && (
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
            {content.tone_notes}
          </p>
        )}
        {content.disclaimer && (
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 11, color: "var(--muted)" }}>{content.disclaimer}</p>
        )}
      </div>
    );
  }

  if (content?.summary) {
    return (
      <div style={box}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{content.summary}</p>
        {Array.isArray(content.insights) && content.insights.length > 0 && (
          <ul style={{ marginTop: 12, marginBottom: 0, paddingLeft: 18, fontSize: 13.5 }}>
            {content.insights.map((i, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>
                <strong>{i.type}:</strong> {i.text}
              </li>
            ))}
          </ul>
        )}
        {typeof content.flagged_for_provider === "boolean" && (
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, fontWeight: 600, color: "var(--rosedeep)" }}>
            {content.flagged_for_provider ? "⚑ Flagged for provider" : "No flags for provider"}
          </p>
        )}
        {content.disclaimer && (
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 11, color: "var(--muted)" }}>{content.disclaimer}</p>
        )}
      </div>
    );
  }

  // Last-resort fallback — still never shows raw braces/quotes.
  return (
    <div style={box}>
      {Object.entries(content || {}).map(([key, value]) => (
        <p key={key} style={{ margin: "0 0 8px", fontSize: 14 }}>
          <strong>{key.replace(/_/g, " ")}:</strong> {typeof value === "string" ? value : JSON.stringify(value)}
        </p>
      ))}
    </div>
  );
}
