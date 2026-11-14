interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/** 등록·정보 수정에서 현재 보관 장소를 선택적으로 입력한다. 저장과 정규화는 부모와 서버가 담당한다. */
export function WardrobeStorageLocationField({ value, onChange, disabled }: Props) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      보관 위치 <span className="text-xs font-normal text-muted">선택</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}
        maxLength={40} placeholder="예: 본가 옷장, 침대 아래 겨울옷 박스"
        className="h-12 min-w-0 rounded-xl border border-line bg-white px-3 text-ink outline-none focus:border-accent disabled:opacity-60" />
      <span className="text-xs font-normal text-muted">옷장 검색에서도 보관 위치로 찾을 수 있어요.</span>
    </label>
  )
}
