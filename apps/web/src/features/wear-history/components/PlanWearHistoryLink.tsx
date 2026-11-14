import { usePlannerLocationWeather } from '../../plan/hooks/usePlannerLocationWeather'
import { getKoreaPlannerTomorrow } from '../../plan/utils/plannerWear'
import { WearHistoryLink } from './WearHistoryLink'

function ForecastHistoryLink({ date }: { date: string }) {
  const { weather, isEnabled } = usePlannerLocationWeather(date)
  return <WearHistoryLink planner date={date} from={`/plan?view=today&date=${date}`} temperature={isEnabled ? weather?.meanTemperatureC : null} />
}

/** 오늘·내일은 기존에 허용된 위치의 예보 평균을 사용한다. 다른 날짜는 기온을 추정하지 않고 전체 기록으로 연다. */
export function PlanWearHistoryLink({ date, today }: { date: string; today: string }) {
  return date === today || date === getKoreaPlannerTomorrow(today)
    ? <ForecastHistoryLink key={date} date={date} />
    : <WearHistoryLink planner date={date} from={`/plan?view=today&date=${date}`} />
}
