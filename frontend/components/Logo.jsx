// A heart mark in the site's existing rose/blush palette — inline SVG,
// not an image file, so it stays crisp at any size and keeps recoloring
// via currentColor if ever needed.

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
        d="M16 24.5C16 24.5 6.5 18.2 6.5 11.8C6.5 8.4 9.1 6 12.1 6C14 6 15.5 7.1 16 8.8C16.5 7.1 18 6 19.9 6C22.9 6 25.5 8.4 25.5 11.8C25.5 18.2 16 24.5 16 24.5Z"
        fill="#C13F6B"
      />
    </svg>
  );
}
