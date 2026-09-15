/**
 * 용도:
 * 옷장과 코디북의 빈 상태를 같은 옷장 아이콘 계열로 보여준다.
 *
 * 구조:
 * 공통으로 열린 옷장을 사용하고 옷장은 흔들리는 옷걸이,
 * 코디북은 겹쳐지는 코디 카드로 내부 장면만 다르게 표현한다.
 */
interface WardrobeEmptyStateIllustrationProps {
  className?: string
  variant?: 'closet' | 'lookbook'
}

export function WardrobeEmptyStateIllustration({
  className = '',
  variant = 'closet',
}: WardrobeEmptyStateIllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 180 170"
    >
      <ellipse cx="90" cy="157" rx="59" ry="7" fill="#dedad1" />

      <g className="brand-empty-wardrobe">
        <rect
          x="43"
          y="29"
          width="94"
          height="122"
          rx="7"
          fill="#dfe6d2"
          stroke="#1b1b18"
          strokeWidth="3"
        />
        <rect
          x="52"
          y="40"
          width="76"
          height="78"
          rx="2"
          fill="#fffdf8"
          stroke="#1b1b18"
          strokeWidth="2.5"
        />
        <path
          d="M59 51h62"
          fill="none"
          stroke="#1b1b18"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <rect
          x="52"
          y="118"
          width="76"
          height="24"
          fill="#dfe6d2"
          stroke="#1b1b18"
          strokeWidth="2.5"
        />
        <path
          d="M83 130h14"
          fill="none"
          stroke="#1b1b18"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d="M52 151v6M128 151v6"
          stroke="#1b1b18"
          strokeLinecap="round"
          strokeWidth="4"
        />

        {variant === 'closet' ? (
          <g className="brand-empty-hanger">
            <path
              d="M86 68c0-6 8-7 8-1 0 3-4 4-4 8"
              fill="none"
              stroke="#1b1b18"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <path
              d="m89 74-24 20c-3 3-1 7 3 7h44c4 0 6-4 3-7L91 74"
              fill="#f05a3c"
              stroke="#1b1b18"
              strokeLinejoin="round"
              strokeWidth="3"
            />
          </g>
        ) : (
          <g className="brand-empty-lookbook-card">
            <rect
              x="66"
              y="60"
              width="47"
              height="49"
              rx="5"
              fill="#dfe6d2"
              stroke="#1b1b18"
              strokeWidth="2.5"
              transform="rotate(-7 89.5 84.5)"
            />
            <rect
              x="62"
              y="57"
              width="50"
              height="53"
              rx="5"
              fill="#fffdf8"
              stroke="#1b1b18"
              strokeWidth="2.5"
            />
            <path
              d="m74 68 7-4 7 4 7-4 7 4-5 12H79l-5-12Z"
              fill="#f05a3c"
              stroke="#1b1b18"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d="M78 87h18l3 14H75l3-14Z"
              fill="#bdc8ad"
              stroke="#1b1b18"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </g>
        )}

        <g className="brand-empty-sparkle">
          <path
            d="M119 64c4 1 6 3 7 7 1-4 3-6 7-7-4-1-6-3-7-7-1 4-3 6-7 7Z"
            fill="#f05a3c"
          />
        </g>

        <g className="brand-empty-door-left">
          <path
            d="M44 36 14 22v121l30 9V36Z"
            fill="#e8eddc"
            stroke="#1b1b18"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M25 71v38"
            stroke="#1b1b18"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </g>
        <g className="brand-empty-door-right">
          <path
            d="m136 36 30-14v121l-30 9V36Z"
            fill="#e8eddc"
            stroke="#1b1b18"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M155 71v38"
            stroke="#1b1b18"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </g>
      </g>
    </svg>
  )
}
