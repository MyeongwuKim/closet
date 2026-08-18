import { Plus } from 'lucide-react'
import { PageTitle } from '../../../components/PageTitle'

interface PlanPageHeaderProps {
  viewMode: 'week' | 'month'
  onEditWeek: () => void
}

export function PlanPageHeader({
  viewMode,
  onEditWeek,
}: PlanPageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 sm:items-end">
      <div className="min-w-0 [&_p]:hidden sm:[&_p]:block">
        <PageTitle
          title="플래너"
          description={
            viewMode === 'week'
              ? '이번 주에 입을 코디를 요일별로 미리 정리해보세요.'
              : '한 달의 코디 계획과 비어 있는 날짜를 함께 확인해보세요.'
          }
        />
      </div>
      <button
        type="button"
        onClick={onEditWeek}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 sm:size-11"
        aria-label={
          viewMode === 'week' ? '이번 주 옷 설정' : '주간 옷 설정으로 이동'
        }
        title={viewMode === 'week' ? '이번 주 옷 설정' : '주간에서 설정'}
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>
    </div>
  )
}
