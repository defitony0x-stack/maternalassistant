import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import UpdatesStrip from "../../components/UpdatesStrip";
import ToolsShowcase from "../../components/ToolsShowcase";

export const metadata = {
  title: "All tools — Maternal Health Companion",
  description: "All 25 tools that turn pregnancy and postpartum notes into reports, checklists, and drafts.",
};

export default function ToolsPage() {
  return (
    <>
      <Nav />

      <section className="tools-header">
        <div className="container">
          <span className="eyebrow">25 tools, one set of notes</span>
          <h1 className="display tools-header-h1">Every tool, in one place</h1>
          <p className="sub" style={{ maxWidth: 620 }}>
            Each tool below runs on the same notes you already typed once —
            no separate forms, no re-entering your situation five different
            ways. Available individually or bundled through the OKX AI
            Marketplace listing.
          </p>
        </div>
      </section>

      <main className="container" style={{ paddingTop: 32, paddingBottom: 20 }}>
        <ToolsShowcase />

        <p className="disclaimer" style={{ marginTop: 32 }}>
          This is an informational and productivity tool. It is not a
          medical device, does not diagnose, and does not replace your
          healthcare provider. Letters are drafts only and not legal advice.
        </p>
      </main>

      <UpdatesStrip />

      <Footer />
    </>
  );
}
