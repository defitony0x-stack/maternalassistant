// Mirrors the backend's 25 MCP skills (src/routes/mcp.js) so this list only
// ever needs to grow when a new service is added there. Grouped by the job
// the mother is trying to do, not by data type, since that's how someone
// scanning this at 2am will actually search it.
const TOOL_GROUPS = [
  {
    category: "Reports & advocacy",
    tools: [
      { label: "Report", blurb: "Notes → a plain-language summary with a provider flag." },
      { label: "Appointment prep sheet", blurb: "Key points and questions to bring to your next visit." },
      { label: "Advocacy letter", blurb: "Draft a leave, accommodation, or insurance-appeal letter." },
      { label: "Action items", blurb: "What's urgent, this week, and worth raising later." },
      { label: "Question bank", blurb: "8–12 categorized questions, built from what you've logged." },
      { label: "Visit debrief", blurb: "Turn notes fresh from an appointment into a clean recap." },
    ],
  },
  {
    category: "Pregnancy planning",
    tools: [
      { label: "Trimester plan", blurb: "Groups your notes into first/second/third trimester." },
      { label: "Birth plan", blurb: "A printable plan built only from preferences you've stated." },
      { label: "Hospital bag checklist", blurb: "Packing list built from your situation, not a generic PDF." },
      { label: "Nutrition guide", blurb: "Combines your logged meals with established nutrition basics." },
      { label: "Travel health guide", blurb: "A prep checklist for traveling while pregnant." },
    ],
  },
  {
    category: "Postpartum & baby",
    tools: [
      { label: "Postpartum checklist", blurb: "Physical, emotional, feeding, and logistics, in one place." },
      { label: "Pelvic floor recovery guide", blurb: "Organizes symptoms and flags what to bring to a specialist." },
      { label: "Feeding support summary", blurb: "Breastfeeding/pumping/bottle logs, flagged for a lactation consultant." },
      { label: "Newborn care guide", blurb: "A checklist grounded in what you've actually logged." },
      { label: "Infant growth tracker", blurb: "Chronological measurements with direction of change." },
      { label: "Vaccination checklist", blurb: "What's logged for mother and baby, and what to confirm." },
    ],
  },
  {
    category: "Medications & records",
    tools: [
      { label: "Medication summary", blurb: "Doses, frequency, and tolerance notes, organized." },
      { label: "Medication log check", blurb: "Flags duplicate or unclear entries to raise with a pharmacist." },
      { label: "Symptom timeline", blurb: "Per-symptom history with an improving/worsening read." },
      { label: "Lab results organizer", blurb: "Logged values organized exactly as reported." },
    ],
  },
  {
    category: "Insurance & cost",
    tools: [
      { label: "Insurance claim summary", blurb: "Care events organized into a claim-support summary." },
      { label: "Insurance eligibility guide", blurb: "Questions worth asking your insurer, from your own events." },
      { label: "Cost breakdown", blurb: "Line-items organized from costs you've already mentioned." },
    ],
  },
  {
    category: "Language",
    tools: [
      { label: "Medical translation", blurb: "Notes or provider instructions, translated both ways." },
    ],
  },
];

export default function ToolsShowcase() {
  return (
    <div id="tools">
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>All 25 tools</h2>
      <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 0, marginBottom: 20 }}>
        Every tool below runs on the same notes you already typed once. Available
        individually or bundled through the OKX AI Marketplace listing.
      </p>

      <div className="tools-grid">
        {TOOL_GROUPS.map((group) => (
          <div key={group.category} className="tools-group">
            <span className="pill tools-group-label">{group.category}</span>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {group.tools.map((t) => (
                <div className="card tools-card" key={t.label}>
                  <strong style={{ fontSize: 14 }}>{t.label}</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                    {t.blurb}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
