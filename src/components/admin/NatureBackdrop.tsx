export function NatureBackdrop() {
  return (
    <svg
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="focus-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="45%" stopColor="#3d5a80" />
          <stop offset="75%" stopColor="#e0a458" />
          <stop offset="100%" stopColor="#c9622f" />
        </linearGradient>
        <radialGradient id="focus-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe6b3" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffe6b3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="600" fill="url(#focus-sky)" />
      <circle cx="600" cy="220" r="160" fill="url(#focus-sun)" />
      <circle cx="600" cy="220" r="55" fill="#ffe9c2" />
      <path d="M0 420 L120 300 L230 380 L340 260 L430 400 L560 300 L650 390 L800 320 L800 600 L0 600 Z" fill="#16324f" opacity="0.55" />
      <path d="M0 480 L150 400 L260 460 L390 380 L520 470 L650 400 L800 460 L800 600 L0 600 Z" fill="#0d2338" opacity="0.75" />
      <path d="M0 540 L180 480 L320 520 L470 460 L620 520 L800 480 L800 600 L0 600 Z" fill="#081726" />
    </svg>
  )
}
