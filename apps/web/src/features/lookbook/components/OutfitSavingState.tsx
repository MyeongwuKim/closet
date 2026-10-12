interface OutfitSavingStateProps {
  /** 실제 저장 요청에서만 옷을 접어 선반에 넣는 움직임을 반복한다. */
  isPersisting: boolean
}

/**
 * 코디 저장창의 대기 장면을 표시한다. 착용 기록 확인과 실제 저장 요청을 문구로 구분하며,
 * 저장 중에는 소매와 밑단을 접은 한 벌이 선반으로 들어가는 장식 움직임을 반복한다.
 * 요청·완료 판단은 부모에 맡기며, 움직임 자체가 저장 진행률이나 완료를 나타내지는 않는다.
 */
export function OutfitSavingState({ isPersisting }: OutfitSavingStateProps) {
  return (
    <div
      className="flex min-h-96 flex-col items-center justify-center py-6 text-center text-ink"
      role="status"
      aria-live="polite"
    >
      <p className="text-[10px] tracking-[.16em] text-muted">MY OUTFIT SHELF</p>
      <svg
        viewBox="0 0 300 230"
        className="lookbook-folding-scene mt-4 w-full max-w-72"
        data-folding={isPersisting}
        aria-hidden="true"
      >
        <ellipse cx="156" cy="206" rx="124" ry="6" fill="var(--color-line)" opacity=".45" />
        <rect x="161" y="35" width="112" height="164" rx="4" fill="var(--color-wood)" />
        <rect x="169" y="44" width="96" height="146" rx="1" fill="var(--color-surface)" />
        <path d="M170 45v145h94" fill="none" stroke="var(--color-line)" strokeWidth="3" />
        <rect x="179" y="161" width="49" height="10" rx="3" fill="var(--color-sage)" stroke="var(--color-line)" />
        <rect x="182" y="154" width="45" height="9" rx="3" fill="var(--color-wood)" />
        <path d="M190 158h28" stroke="var(--color-surface)" strokeWidth="1" opacity=".45" />
        <rect x="169" y="119" width="96" height="6" fill="var(--color-wood)" />
        <rect x="169" y="174" width="96" height="6" fill="var(--color-wood)" />
        <path d="M168 199v5m98-5v5" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" />
        <rect x="27" y="167" width="106" height="5" rx="2" fill="var(--color-wood)" />
        <g className="lookbook-folded-outfit">
          <g className="lookbook-shirt-left-sleeve">
            <path d="m57 79-16 4-20 24 15 10 22-12Z" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="1" strokeLinejoin="round" />
          </g>
          <g className="lookbook-shirt-right-sleeve">
            <path d="m103 79 16 4 20 24-15 10-22-12Z" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="1" strokeLinejoin="round" />
          </g>
          <rect className="lookbook-shirt-body" x="56" y="79" width="48" height="39" rx="3" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="1" />
          <path d="M69 79c1 6 4 9 11 9s10-3 11-9" fill="var(--color-surface)" opacity=".85" />
          <g className="lookbook-shirt-bottom">
            <path d="M56 118h48v33a3 3 0 0 1-3 3H59a3 3 0 0 1-3-3Z" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="1" />
            <path d="M61 148h38" stroke="var(--color-surface)" strokeWidth="1" opacity=".35" />
          </g>
        </g>
      </svg>
      <h3 className="mt-4 text-base font-semibold tracking-[-.025em]">
        {isPersisting ? '한 벌을 차곡차곡 넣고 있어요' : '저장할 코디를 확인하고 있어요'}
      </h3>
      <p className="mt-2 max-w-60 text-xs leading-6 text-muted">
        {isPersisting
          ? '고른 옷과 코디 이름을 함께 저장하고 있어요.'
          : '최근에 입은 옷인지 먼저 살펴볼게요.'}
      </p>
    </div>
  )
}
