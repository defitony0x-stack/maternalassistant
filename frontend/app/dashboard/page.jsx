"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";

function LoginForm({ onSignedIn }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("/users/session/request", { email });
      setStep("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("/users/session/verify", { email, code });
      onSignedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ paddingTop: 56 }}>
      <p style={{ marginBottom: 16 }}>
        Full account access happens through the OKX AI Marketplace listing.
        This form is for testing during build, not the production sign-in path.
      </p>

      {step === "email" && (
        <div className="card">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary" style={{ marginTop: 10 }} disabled={busy || !email} onClick={requestCode}>
            Send code
          </button>
        </div>
      )}

      {step === "code" && (
        <div className="card">
          <p style={{ fontSize: 13, color: "#6b5f7a" }}>
            Code sent to {email}. In local dev, check the backend console log.
          </p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn-primary" style={{ marginTop: 10 }} disabled={busy || code.length !== 6} onClick={verifyCode}>
            Verify and sign in
          </button>
        </div>
      )}

      {error && <p style={{ color: "#b3261e", marginTop: 10 }}>{error}</p>}
    </main>
  );
}

export default function Dashboard() {
  const [entries, setEntries] = useState([]);
  const [note, setNote] = useState("");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  async function loadEntries() {
    try {
      const data = await apiGet("/ingest?limit=10");
      setEntries(data.entries);
      setSignedIn(true);
    } catch {
      setSignedIn(false);
    } finally {
      setChecked(true);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  async function addEntry() {
    if (!note) return;
    setBusy(true);
    try {
      await apiPost("/ingest", { type: "text", content: note });
      setNote("");
      await loadEntries();
    } finally {
      setBusy(false);
    }
  }

  async function generateReport() {
    setBusy(true);
    try {
      const data = await apiPost("/generate/report", {});
      setReport(data.content);
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  if (!signedIn) {
    return <LoginForm onSignedIn={loadEntries} />;
  }

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: 26 }}>Your history</h1>

      <div className="card" style={{ marginTop: 20 }}>
        <textarea
          rows={3}
          placeholder="Add a note (symptom, visit summary, anything worth tracking)..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn-primary" style={{ marginTop: 10 }} disabled={busy || !note} onClick={addEntry}>
          Add entry
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn-secondary" disabled={busy || entries.length === 0} onClick={generateReport}>
          Generate report from recent entries
        </button>
      </div>

      {report && (
        <pre style={{ whiteSpace: "pre-wrap", background: "#fff", border: "1px solid #e4d7cd", borderRadius: 10, padding: 16, marginTop: 20 }}>
{JSON.stringify(report, null, 2)}
        </pre>
      )}

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Recent entries</h2>
      <ul>
        {entries.map((e) => (
          <li key={e.id} style={{ marginBottom: 8 }}>
            <span style={{ color: "#6b5f7a", fontSize: 13 }}>{new Date(e.created_at).toLocaleString()}</span>
            <br />
            {e.content}
          </li>
        ))}
      </ul>
    </main>
  );
}
