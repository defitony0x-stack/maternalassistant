import Link from "next/link";
import { SOCIAL_LINKS, TwitterIcon, GithubIcon } from "./SocialLinks";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav-logo">
        <span>🩷</span>
        <span>MHC</span>
      </div>
      <div className="nav-links">
        <Link href="/dashboard">Dashboard</Link>
        <a href={SOCIAL_LINKS.okxListing}>Agent Hub</a>
        <a href={SOCIAL_LINKS.twitter} aria-label="X / Twitter">
          <TwitterIcon className="nav-icon" />
        </a>
        <a href={SOCIAL_LINKS.github} aria-label="GitHub">
          <GithubIcon className="nav-icon" />
        </a>
      </div>
    </nav>
  );
}
