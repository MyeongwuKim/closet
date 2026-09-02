interface EmptyWardrobeAnimationProps {
  className?: string
}

export function EmptyWardrobeAnimation({
  className = '',
}: EmptyWardrobeAnimationProps) {
  return (
    <svg
      viewBox="0 0 180 170"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="90" cy="156" rx="58" ry="7" fill="#dedad1" />

      <g className="empty-wardrobe-character">
        <rect
          x="38"
          y="32"
          width="104"
          height="119"
          rx="7"
          fill="#dfe6d2"
          stroke="#1b1b18"
          strokeWidth="3"
        />
        <rect
          x="48"
          y="43"
          width="84"
          height="98"
          rx="3"
          fill="#fffdf8"
          stroke="#1b1b18"
          strokeWidth="2.5"
        />
        <path
          d="M57 53h66"
          fill="none"
          stroke="#1b1b18"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="m68 65 8-5 8 5H68Zm28 0 8-5 8 5H96Z"
          fill="none"
          stroke="#757169"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M49 115h82" stroke="#1b1b18" strokeWidth="2.5" />
        <rect x="55" y="122" width="70" height="12" rx="3" fill="#f3f0e9" />
        <path
          d="M82 128h16"
          stroke="#757169"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M32 28h116l-4 10H36l-4-10Z"
          fill="#dfe6d2"
          stroke="#1b1b18"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M46 151v6M134 151v6"
          stroke="#1b1b18"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <g className="empty-wardrobe-face" stroke="#1b1b18" strokeWidth="2.5" strokeLinecap="round">
          <path d="M70 86h8M102 86h8" />
          <path d="M82 105c4-6 12-6 16 0" fill="none" />
        </g>
        <path
          className="empty-wardrobe-tear"
          d="M111 91c0 0-5 6-5 10a5 5 0 0 0 10 0c0-4-5-10-5-10Z"
          fill="#70a8c7"
          stroke="#1b1b18"
          strokeWidth="1.5"
        />

        <g className="empty-wardrobe-door-left">
          <path
            d="M39 38 15 51v88l24 12V38Z"
            fill="#fffdf8"
            stroke="#1b1b18"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M22 59v69" stroke="#dedad1" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="empty-wardrobe-door-right">
          <path
            d="m141 38 24 13v88l-24 12V38Z"
            fill="#fffdf8"
            stroke="#1b1b18"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M158 59v69" stroke="#dedad1" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}
