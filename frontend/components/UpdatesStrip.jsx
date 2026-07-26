import { SOCIAL_LINKS } from "./SocialLinks";

// Tailornova's version is a working email-capture form backed by a mailing-
// list service. There's no backend endpoint for that yet (no route, no
// provider wired up), so rather than ship a form that silently does
// nothing on submit, this links straight to the X account you already use
// for updates. Swap this for a real form once a /newsletter/subscribe
// route exists.
export default function UpdatesStrip() {
  return (
    <section className="updates-strip">
      <div className="container" style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 24, color: "#fff", marginBottom: 8 }}>
          Join the conversation
        </h2>
        <p style={{ color: "rgba(255,255,255,0.9)", marginBottom: 20 }}>
          New tools ship often. Follow along for updates as they go live.
        </p>
        <a href={SOCIAL_LINKS.twitter}>
          <button className="btn-secondary updates-btn">Follow updates on X</button>
        </a>
      </div>
    </section>
  );
}
