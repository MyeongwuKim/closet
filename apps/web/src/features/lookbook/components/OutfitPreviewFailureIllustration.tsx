/** AI 룩 이미지 생성 실패를 사진 카드와 X 배지로 표시한다. */
export function OutfitPreviewFailureIllustration({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 180 170">
      <ellipse cx="90" cy="155" rx="58" ry="6" fill="var(--color-line)" />

      <rect
        x="46"
        y="27"
        width="94"
        height="117"
        rx="8"
        fill="var(--color-sage)"
        stroke="var(--color-ink)"
        strokeWidth="3"
        transform="rotate(8 93 85.5)"
      />

      <g transform="rotate(-6 81 86)">
        <rect
          x="30"
          y="26"
          width="102"
          height="121"
          rx="8"
          fill="var(--color-surface)"
          stroke="var(--color-ink)"
          strokeWidth="3"
        />
        <rect
          x="42"
          y="39"
          width="78"
          height="74"
          rx="4"
          fill="var(--color-canvas)"
          stroke="var(--color-ink)"
          strokeWidth="2.5"
        />
        <circle
          cx="62"
          cy="59"
          r="8"
          fill="var(--color-sage)"
          stroke="var(--color-ink)"
          strokeWidth="2.5"
        />
        <path
          d="m42 97 22-22 20 21 13-13 23 23v3a4 4 0 0 1-4 4H46a4 4 0 0 1-4-4V97Z"
          fill="var(--color-sage)"
          stroke="var(--color-ink)"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <path
          d="M46 127h33m-33 8h22"
          fill="none"
          stroke="var(--color-ink)"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      </g>

      <path
        d="M137 35c5-1 8-4 9-9 1 5 4 8 9 9-5 1-8 4-9 9-1-5-4-8-9-9Z"
        fill="var(--color-accent)"
      />
      <circle
        cx="132"
        cy="124"
        r="23"
        fill="var(--color-sage)"
        stroke="var(--color-ink)"
        strokeWidth="3"
      />
      <path
        d="m124 116 16 16m0-16-16 16"
        fill="none"
        stroke="var(--color-accent)"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  )
}
