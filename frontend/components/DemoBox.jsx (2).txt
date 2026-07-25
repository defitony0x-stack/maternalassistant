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
      // StatsStrip fetches /stats/public once on mount and has no other way
      // to know a demo just ran. This event is the decoupled way to tell it
      // to refetch without lifting state up into page.jsx.
      window.dispatchEvent(new Event("mhc:stats-refresh"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Renders the two known demo shapes (report, letter) as readable text
  // instead of a raw JSON dump. Falls back to JSON if the shape doesn't
  // match either — e.g. if a service's output fields ever change.
  function renderResult(content) {
    if (content && typeof content === "object" && "summary" in content) {
      return (
        <>
          <p style={{ margin: 0 }}>{content.summary}</p>
          {Array.isArray(content.insights) && content.insights.length > 0 && (
            <ul style={{ marginTop: 12, paddingLeft: 20 }}>
              {content.insights.map((insight, i) => (
                <li key={i}>{insight.text}</li>
              ))}
            </ul>
          )}
          {content.flagged_for_provider && (
            <p style={{ marginTop: 12, fontWeight: 600 }}>
              Flagged for your provider{content.flag_reason ? `: ${content.flag_reason}` : ""}
            </p>
          )}
        </>
      );
    }

    if (content && typeof content === "object" && "subject" in content && "body" in content) {
      return (
        <>
          <p style={{ margin: 0, fontWeight: 600 }}>{content.subject}</p>
          <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{content.body}</p>
          {content.disclaimer && (
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>{content.disclaimer}</p>
          )}
        </>
      );
    }

    return (
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Inter", fontSize: 14 }}>
        {JSON.stringify(content, null, 2)}
      </pre>
    );
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
          <div style={{ fontFamily: "Inter", fontSize: 14, background: "var(--mist)", padding: 14, borderRadius: 10, border: "1px solid var(--line)" }}>
            {renderResult(result.content)}
          </div>
          <div className="banner-demo">{result.banner}</div>
          <a href={SOCIAL_LINKS.okxListing}>
            <button className="btn-secondary" style={{ marginTop: 12 }}>
              Get full access on OKX AI
            </button>
          </a>
        </div>
      )}
    </div>
  );
}
