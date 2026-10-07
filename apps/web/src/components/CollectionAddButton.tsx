import type { Ref } from 'react'
import { LoaderCircle, Plus } from 'lucide-react'

interface CollectionAddButtonProps {
  label: string
  title?: string
  onClick: () => void
  isLoading?: boolean
  buttonRef?: Ref<HTMLButtonElement>
}

/** 옷장·코디북의 추가 버튼을 같은 색상·크기·아이콘으로 표시한다. isLoading 동안 클릭을 막고 로딩 아이콘만 바꾸며 버튼의 색상과 투명도는 유지한다. */
export function CollectionAddButton({
  label,
  title,
  onClick,
  isLoading = false,
  buttonRef,
}: CollectionAddButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => {
        if (!isLoading) onClick()
      }}
      data-primary
      className={`collection-action ${isLoading ? 'cursor-wait' : ''}`}
      aria-label={label}
      aria-disabled={isLoading}
      aria-live="polite"
      title={title ?? label}
    >
      {isLoading ? (
        <LoaderCircle className="animate-spin" size={20} />
      ) : (
        <Plus size={22} />
      )}
    </button>
  )
}
