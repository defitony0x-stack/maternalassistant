// Simple, distinctive mark rather than a generic heart emoji or clipart:
// a soft circle (care, wholeness) with a heartbeat pulse running through
// it (monitoring, health data) — ties directly to what the product does,
// in the site's existing rose/blush palette. Inline SVG, not an image
// file, so it's crisp at any size and recolors with currentColor if
// ever needed.

export default function Logo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Maternal Health Companion"
      role="img"
    >
      <circle cx="16" cy="16" r="15" fill="#FFE3EC" stroke="#E85D8A" strokeWidth="1.5" />
      <path
        d="M6 16H11L13.5 9L18.5 23L21 16H26"
        stroke="#C13F6B"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
