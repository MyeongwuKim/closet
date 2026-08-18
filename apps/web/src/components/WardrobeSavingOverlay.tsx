export function WardrobeSavingOverlay() {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-canvas/90 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="옷장에 새 옷을 추가하고 있습니다"
    >
      <div className="text-center">
        <svg
          viewBox="0 0 180 180"
          className="mx-auto size-44"
          aria-hidden="true"
        >
          <rect
            x="10"
            y="10"
            width="160"
            height="160"
            rx="48"
            fill="#fffdf8"
          />
          <ellipse cx="90" cy="158" rx="64" ry="7" fill="#dedad1" />

          <g className="wardrobe-saving-closet">
            <rect
              x="38"
              y="50"
              width="104"
              height="103"
              rx="7"
              fill="#dfe6d2"
              stroke="#1b1b18"
              strokeWidth="3"
            />
            <rect
              x="48"
              y="61"
              width="84"
              height="82"
              rx="3"
              fill="#fffdf8"
              stroke="#1b1b18"
              strokeWidth="2.5"
            />
            <path
              d="M57 70h66"
              fill="none"
              stroke="#1b1b18"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="m62 78 10-6 10 6H62Zm36 0 10-6 10 6H98Z"
              fill="none"
              stroke="#757169"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M49 116h82" stroke="#1b1b18" strokeWidth="2.5" />
            <rect x="55" y="123" width="70" height="13" rx="3" fill="#f3f0e9" />
            <path d="M82 129h16" stroke="#757169" strokeWidth="2" strokeLinecap="round" />
            <path
              d="M32 46h116l-4 10H36l-4-10Z"
              fill="#dfe6d2"
              stroke="#1b1b18"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M46 153v6M134 153v6" stroke="#1b1b18" strokeWidth="4" strokeLinecap="round" />
          </g>

          <g className="wardrobe-saving-shirt">
            <path
              d="M76 22 83 19c1.5 5 4 7 7 7s5.5-2 7-7l7 3 10 9-8 9-6-5v25H80V35l-6 5-8-9 10-9Z"
              fill="#f05a3c"
              stroke="#1b1b18"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M83 19c1.5 5 4 7 7 7s5.5-2 7-7"
              fill="none"
              stroke="#fffdf8"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>

          <g className="wardrobe-saving-closet">
            <path
              d="M39 55 15 68v75l24 10V55Z"
              fill="#fffdf8"
              stroke="#1b1b18"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="m141 55 24 13v75l-24 10V55Z"
              fill="#fffdf8"
              stroke="#1b1b18"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M22 75v58M158 75v58"
              fill="none"
              stroke="#dedad1"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>

          <g className="wardrobe-saving-sparkle" fill="#f05a3c">
            <path d="m151 35 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" />
            <circle cx="29" cy="38" r="4" />
          </g>
        </svg>

        <h3 className="mt-1 text-xl font-black">옷장에 차곡차곡 넣고 있어요</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          잠시만 기다리면 새 옷이 옷장에 쏙 들어가요.
        </p>
      </div>
    </div>
  )
}
