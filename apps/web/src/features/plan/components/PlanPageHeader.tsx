/**
 * 사용 위치: 플래너 화면 → 상단 제목 영역
 *
 * 용도:
 * 옷장·코디북과 같은 제목 규격으로 플래너 이름과 주간 편집 버튼을 표시한다.
 * 제목 옆의 작은 날씨 배지에서 오늘의 기온을 보여주고 자세한 날씨를 열 수 있다.
 *
 * 구조:
 * 오늘·주간·월간 모두 같은 제목과 조작을 제공한다. 주간 편집을 열 기준 날짜는 부모 화면에서 정한다.
 */
import { CalendarDays } from 'lucide-react'
import { CollectionHeading } from '../../../components/CollectionHeading'
import { PlanTodayWeather } from './PlanTodayWeather'

interface PlanPageHeaderProps {
  today: string
  onEditWeek: () => void
}

export function PlanPageHeader({
  today,
  onEditWeek,
}: PlanPageHeaderProps) {
  return (
    <div>
      <CollectionHeading
        title="플래너"
        label="My outfit planner"
        description="미리 골라두는 나의 옷차림"
        titleAccessory={<PlanTodayWeather date={today} />}
        actions={
          <button
            type="button"
            onClick={onEditWeek}
            data-primary
            className="collection-action plan-week-edit"
            aria-label="일주일 코디 설정"
            title="일주일 코디 설정"
          >
            <CalendarDays size={14} strokeWidth={1.8} />
            <span>주간 편집</span>
          </button>
        }
      />
    </div>
  )
}
