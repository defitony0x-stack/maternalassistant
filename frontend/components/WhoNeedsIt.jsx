const AUDIENCES = [
  "Expecting for the first time",
  "Managing a health condition through pregnancy",
  "Recovering postpartum",
  "Caring for a newborn",
  "Traveling while pregnant",
  "Coordinating care in a second language",
  "Appealing an insurance decision",
  "Prepping for any appointment, low-stakes or not",
];

export default function WhoNeedsIt() {
  return (
    <section className="who-needs-it">
      <div className="container">
        <h2 style={{ fontSize: 22, marginBottom: 20, color: "#fff" }}>Who this is for</h2>
        <div className="who-needs-it-grid">
          {AUDIENCES.map((item, i) => (
            <div className="who-needs-it-item" key={item}>
              <span className="num who-num">{i + 1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
