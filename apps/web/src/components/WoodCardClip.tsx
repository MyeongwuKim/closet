/** 목록의 가로 봉에 걸린 고리와 사진 테두리를 잡는 원목 집게를 표시한다. 사진 속 옷이나 사람에 직접 닿지 않도록 사진 프레임 위에 배치한다. */
export function WoodCardClip() {
  return (
    <svg className="collection-card-clip" viewBox="0 0 160 44" fill="none" aria-hidden="true" focusable="false">
      <path d="M80 18V10c0-6 3-8 7-8s7 3 7 7" stroke="#8d8579" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M15 24h130" stroke="#a69c8d" strokeWidth="1.4" />
      <rect x="29" y="17" width="102" height="11" rx="2" fill="#dcc29c" stroke="#c2a47d" strokeWidth=".7" />
      <path d="M32 19h96" stroke="#f0dec1" strokeWidth="1" strokeLinecap="round" />
      <path d="M19 20h8v12h-8M133 20h8v12h-8" stroke="#a69c8d" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="12" y="20" width="13" height="22" rx="2" fill="#d2b68e" stroke="#bfa079" strokeWidth=".7" />
      <rect x="135" y="20" width="13" height="22" rx="2" fill="#d2b68e" stroke="#bfa079" strokeWidth=".7" />
      <path d="M14 23v14M137 23v14" stroke="#ecdbbb" strokeWidth="1" strokeLinecap="round" />
      <path d="M15 32h7M138 32h7" stroke="#b19470" strokeWidth=".8" />
    </svg>
  )
}
