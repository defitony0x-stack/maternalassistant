// PLACEHOLDER COPY — swap these three for real quotes (with permission)
// before this goes live. Shipping invented testimonials as if they're from
// real users is misleading to visitors; leaving this comment so it doesn't
// get missed on the next pass.
const TESTIMONIALS = [
  {
    quote: "Replace with a real quote from a mother who used the report or letter tool.",
    name: "Name, context",
  },
  {
    quote: "Replace with a real quote about the appointment prep sheet.",
    name: "Name, context",
  },
  {
    quote: "Replace with a real quote about a postpartum or newborn tool.",
    name: "Name, context",
  },
];

export default function Testimonials() {
  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 22, marginBottom: 16 }}>What mothers say</h2>
      <div className="testimonials-grid">
        {TESTIMONIALS.map((t) => (
          <div className="card" key={t.name}>
            <p style={{ margin: 0, fontSize: 14, fontStyle: "italic", color: "var(--ink)" }}>
              "{t.quote}"
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted)" }}>{t.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
