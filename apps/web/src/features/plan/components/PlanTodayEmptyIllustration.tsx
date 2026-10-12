/** 플래너 하루 보기에서 비어 있는 날짜를 달력에 걸린 옷으로 표현한다. 장식용 그림이며 카드 링크의 접근성 이름에는 포함하지 않는다. */
export function PlanTodayEmptyIllustration() {
  return (
    <svg
      aria-hidden="true"
      className="plan-today-empty-illustration mb-5 w-40 shrink-0"
      viewBox="0 0 200 184"
    >
      <circle cx="100" cy="89" r="75" fill="var(--color-canvas)" />
      <ellipse cx="101" cy="166" rx="62" ry="6" fill="var(--color-line)" />

      <rect
        x="50"
        y="37"
        width="113"
        height="120"
        rx="13"
        fill="var(--color-sage)"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
        transform="rotate(7 106.5 97)"
      />
      <rect
        x="39"
        y="30"
        width="119"
        height="127"
        rx="13"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
      />
      <path
        d="M52 30h93a13 13 0 0 1 13 13v19H39V43a13 13 0 0 1 13-13Z"
        fill="var(--color-sage)"
      />
      <path d="M39 62h119" stroke="var(--color-ink)" strokeWidth="2.5" />
      <path
        d="M69 23v16m59-16v16"
        stroke="var(--color-ink)"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <circle cx="69" cy="48" r="3" fill="var(--color-accent)" />
      <circle cx="128" cy="48" r="3" fill="var(--color-accent)" />

      <path
        d="M92 80c0-5 8-6 8-1 0 3-4 4-4 8"
        fill="none"
        stroke="var(--color-ink)"
        strokeLinecap="round"
        strokeWidth="2.8"
      />
      <path
        d="M96 87 67 105h58L96 87Z"
        fill="none"
        stroke="var(--color-ink)"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="m80 101-11 4-13 16 10 9 8-7v20h44v-20l8 7 10-9-13-16-11-4-8 9H88l-8-9Z"
        fill="var(--color-sage)"
        stroke="var(--color-ink)"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="m88 110 8 7 8-7"
        fill="none"
        stroke="var(--color-wood)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />

      <circle
        cx="151"
        cy="140"
        r="19"
        fill="var(--color-accent)"
        stroke="var(--color-surface)"
        strokeWidth="4"
      />
      <path
        d="M151 133v14m-7-7h14"
        stroke="var(--color-surface)"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <path
        d="M24 78c4 1 6 3 7 7 1-4 3-6 7-7-4-1-6-3-7-7-1 4-3 6-7 7Z"
        fill="var(--color-accent)"
      />
    </svg>
  )
}
