import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { useWardrobeItemsQuery } from '../../closet/api/wardrobeQueries'
import { OutfitDetailModal } from '../../lookbook/components/OutfitDetailModal'
import { OutfitSlotEditor } from '../../lookbook/components/OutfitSlotEditor'
import { getOutfitCompletionMessage } from '../../lookbook/utils/outfitComposition'
import { getSavedOutfitItems } from '../../lookbook/utils/savedOutfitItems'
import { usePlannerOutfitAssignment } from '../../plan/hooks/usePlannerOutfitAssignment'
import { readWearHistoryDate } from '../utils/temperatureHistory'
import type { WearHistoryGroup } from '../types'
import { useKoreaPlannerToday } from '../../plan/hooks/useKoreaPlannerToday'
import { PlannerSaveIntent } from '../../plan/components/PlannerSaveIntent'
import { WearHistoryRecords } from './WearHistoryRecords'

/** 과거 구성과 날짜별 착용을 보여준다. 체감·기온은 원본 날짜에서 수정하고 옷 구성은 새 날짜에 복사한다. */
export function WearHistoryDetail({ group, initialDate, onClose }: { group: WearHistoryGroup; initialDate: string; onClose: () => void }) {
  const originalItems = getSavedOutfitItems(group.outfit, [])
  const [selectedItems, setSelectedItems] = useState(originalItems)
  const [isEditing, setIsEditing] = useState(false)
  const [date, setDate] = useState(initialDate)
  const today = useKoreaPlannerToday()
  const [saveAsWorn, setSaveAsWorn] = useState(false)
  const wardrobe = useWardrobeItemsQuery()
  const confirmWorn = Boolean(date && date <= today && saveAsWorn)
  const assignment = usePlannerOutfitAssignment(group.outfit, date, selectedItems, confirmWorn)
  const activeItems = wardrobe.data?.filter(item => !item.archivedAt) ?? []
  const hasUnavailable = selectedItems.some(item => item.archivedAt || !activeItems.some(active => active.id === item.id))
  const missingItems = selectedItems.length !== group.outfit.layers.length && !isEditing
  const completionMessage = getOutfitCompletionMessage(selectedItems)
  const protectedDate = Boolean(assignment.target.data?.some(entry => entry.date === date && entry.wornAt))
  const isLocked = assignment.isBusy || Boolean(assignment.replacement)
  const canAssign = date && !wardrobe.isPending && !wardrobe.isError && !hasUnavailable && !missingItems && !completionMessage && !protectedDate && !assignment.target.isPending && !assignment.target.isError

  const actions = <>
        <div className="mx-auto max-w-3xl">
          <label className="flex items-center gap-3 text-sm font-semibold"><CalendarDays size={18} strokeWidth={1.6} aria-hidden="true" /><span>담을 날짜</span><input type="date" aria-label="담을 날짜" value={date} onChange={event => setDate(readWearHistoryDate(event.target.value, ''))} disabled={isLocked} className="ml-auto min-h-11 min-w-0 max-w-44 rounded-xl border border-line bg-canvas px-3 text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
          {date && !protectedDate && <PlannerSaveIntent date={date} today={today} confirmWorn={confirmWorn}
            disabled={isLocked || assignment.target.isPending || assignment.target.isError} onChange={setSaveAsWorn} />}
          <div className="mt-2 min-h-5 text-xs leading-5 text-muted" role="status">
            {wardrobe.isError ? <span>옷장을 불러오지 못했어요. <button type="button" onClick={() => void wardrobe.refetch()} className="font-semibold text-accent underline">다시 시도</button></span>
              : assignment.target.isError ? <span>이 날짜의 코디를 확인하지 못했어요. <button type="button" onClick={() => void assignment.target.refetch()} className="font-semibold text-accent underline">다시 시도</button></span>
              : protectedDate ? '착용 완료한 날짜예요. 다른 날짜를 골라주세요.'
              : wardrobe.isPending ? '현재 옷장에 있는 옷을 확인하고 있어요.'
              : hasUnavailable || missingItems ? '삭제된 옷은 교체한 뒤 담을 수 있어요.'
              : completionMessage ?? (isEditing ? '바꾼 구성은 새 날짜에만 저장돼요.' : '과거 기록을 유지하고 새 날짜에 복사해요.')}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={isLocked || wardrobe.isPending || wardrobe.isError} onClick={() => { if (isEditing) setSelectedItems(originalItems); setIsEditing(!isEditing) }} className="min-h-12 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-40">{isEditing ? '변경 취소' : '옷 바꿔서 담기'}</button>
            <button type="button" disabled={isLocked || !canAssign} onClick={() => void assignment.assign()} className="min-h-12 rounded-xl bg-accent px-3 text-sm font-semibold text-white disabled:opacity-40">{assignment.isBusy ? '저장 중…' : confirmWorn ? '입은 코디로 기록' : '이 날짜에 담기'}</button>
          </div>
        </div>
      {assignment.replacement && <ConfirmDialog title="이날 코디를 바꿀까요?" description={`${assignment.replacement.title || '저장된 코디'} 대신 선택한 코디를 담아요.`} confirmLabel="코디 바꾸기" pendingLabel="날짜에 담는 중…" isPending={assignment.isBusy} onCancel={assignment.cancelReplacement} onConfirm={() => void assignment.assign(assignment.replacement?.outfitId)} />}
  </>

  return <OutfitDetailModal
    outfit={group.outfit}
    items={activeItems}
    onClose={onClose}
    backLabel="착용 기록 상세 닫기"
    readOnly
    isReadOnlyBusy={isLocked}
    readActions={actions}
    readComposition={isEditing ? <div inert={isLocked}>
      <OutfitSlotEditor className="mx-auto h-[28rem] w-full max-w-xl md:h-[34rem]" items={activeItems}
        selectedItems={selectedItems} onChange={setSelectedItems} showArchivedStatus />
    </div> : undefined}
    readDetails={!isEditing && <div inert={isLocked}><WearHistoryRecords records={group.records} /></div>}
  />
}
