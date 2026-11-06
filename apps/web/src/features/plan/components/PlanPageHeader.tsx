/**
 * 사용 위치: 플래너 화면 → 상단 제목 영역
 *
 * 용도:
 * 옷장·코디북과 같은 제목 규격으로 플래너 이름을 표시한다.
 * 제목 옆 날씨 배지는 오늘의 기온을 보여준다. 내일 예보가 본문에 있는 동안에는 배지를 생략한다.
 *
 * 구조:
 * 주간 보기에서 편집 콜백을 받으면 주간 편집 버튼을 표시한다.
 */
import { CalendarDays } from 'lucide-react'
import { CollectionHeading } from '../../../components/CollectionHeading'
import { PlanTodayWeather } from './PlanTodayWeather'

interface PlanPageHeaderProps {
  today?: string
  onEditWeek?: () => void
}

export function PlanPageHeader({
  today,
  onEditWeek,
}: PlanPageHeaderProps) {
  return (
    <div>
      <CollectionHeading
        title="플래너"
        titleAccessory={today && <PlanTodayWeather date={today} />}
        actions={onEditWeek && (
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
        )}
      />
    </div>
  )
}
