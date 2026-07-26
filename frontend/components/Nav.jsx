"use client";

import { useState } from "react";
import { SOCIAL_LINKS, TwitterIcon, GithubIcon } from "./SocialLinks";
import Logo from "./Logo";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/tools", label: "All tools" },
  { href: "/#demo", label: "Try the demo" },
  { href: "/#predictions", label: "Live predictions" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="nav">
      <div className="nav-logo">
        <Logo size={26} />
        <span>MHC</span>
      </div>

      {/* Full menu — hidden on narrow screens via CSS, not JS, so it
          never flashes visible before hydration. */}
      <div className="nav-links">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
        <a href={SOCIAL_LINKS.okxListing} className="nav-cta">
          Agent Hub on OKX AI
        </a>
        <a href={SOCIAL_LINKS.twitter} aria-label="X / Twitter">
          <TwitterIcon className="nav-icon" />
        </a>
        <a href={SOCIAL_LINKS.github} aria-label="GitHub">
          <GithubIcon className="nav-icon" />
        </a>
      </div>

      <button
        className="nav-hamburger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6L18 18M6 18L18 6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7H20M4 12H20M4 17H20" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="nav-mobile-panel">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a href={SOCIAL_LINKS.okxListing} className="nav-cta" onClick={() => setOpen(false)}>
            Agent Hub on OKX AI
          </a>
          <div className="nav-mobile-social">
            <a href={SOCIAL_LINKS.twitter} aria-label="X / Twitter">
              <TwitterIcon className="nav-icon" />
            </a>
            <a href={SOCIAL_LINKS.github} aria-label="GitHub">
              <GithubIcon className="nav-icon" />
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
