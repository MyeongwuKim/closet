import { useClosetStore } from '../../closet/stores/useClosetStore'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { formatWearDate } from '../../../utils/wearDate'
import { usePlannerWearReview } from '../hooks/usePlannerWearReview'
import { getPlanEntryItems } from '../utils/plannerItems'
import { wearReviewRange } from '../utils/plannerWearReview'
import './PlannerWearReview.css'

/** 플래너의 오늘 화면에서 최근 예정 코디를 작은 사진과 함께 확인한다. 무응답·넘김으로 실제 착용을 추정하지 않는다. */
export function PlannerWearReview({ today }: { today: string }) {
  const review = usePlannerWearReview(today)
  const wardrobe = useClosetStore(state => state.items)
  if (!review.entry) return null
  const { entry } = review
  const items = getPlanEntryItems(entry, wardrobe).slice(0, 2)
  const when = entry.date === wearReviewRange(today).to ? '어제' : formatWearDate(entry.date)

  return (
    <section className="planner-wear-review" aria-label="미확인 착용 기록">
      <div className="planner-wear-review-photo" aria-hidden="true">
        {entry.previewImageUrl ? <img src={entry.previewImageUrl} alt="" /> : items.map(item => <ClosetItemVisual key={item.id} item={item} compact />)}
      </div>
      <div className="planner-wear-review-copy">
        <p>{when} 이 코디를 입었나요?</p>
        <span title={entry.title}>{entry.title || '계획했던 코디'}</span>
      </div>
      <div className="planner-wear-review-actions">
        <button type="button" disabled={review.isSaving} onClick={() => void review.confirm()}>{review.isSaving ? '기록 중…' : '입었어요'}</button>
        <button type="button" disabled={review.isSaving} onClick={review.dismiss}>넘기기</button>
      </div>
    </section>
  )
}
