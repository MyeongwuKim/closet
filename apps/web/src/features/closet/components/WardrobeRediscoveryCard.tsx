import type { WardrobeRediscovery } from '@closet/types'
import { ArrowUpRight, Thermometer } from 'lucide-react'
import { ClosetItemVisual } from './ClosetItemVisual'
import { useRediscoveryImpression } from '../hooks/useRediscoveryImpression'
import { WardrobeWearPreferenceControl } from './WardrobeWearPreferenceSheet'

interface Props {
  entry: WardrobeRediscovery['items'][number]
  day: string
  viewerId: string
  active: boolean
  enabled: boolean
  position: string
  onOpen: () => void
  onRecommend: () => void
}

/** 한 벌의 큰 사진과 마지막 착용일·그날 평균 기온을 표시한다. 현재 카드만 조작·노출 확인할 수 있으며 AI는 추천 버튼 이후 기존 흐름에서 실행한다. */
export function WardrobeRediscoveryCard({ entry, day, viewerId, active, enabled, position, onOpen, onRecommend }: Props) {
  const ref = useRediscoveryImpression(viewerId, day, entry.item.id, enabled && active)
  const temperature = entry.lastWornTemperatureC
  return (
    <article ref={ref} className="rediscovery-card" data-rediscovery-card role="group" aria-roledescription="슬라이드" aria-label={`${position} · ${entry.item.name}`} inert={!active}>
      <button type="button" onClick={onOpen} aria-label={`${entry.item.name} 다시 보기`} className="rediscovery-card-visual focus-visible:outline-2 focus-visible:outline-accent">
        <ClosetItemVisual item={entry.item} />
      </button>
      <div className="rediscovery-card-content px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
        <button type="button" onClick={onOpen} className="line-clamp-2 break-words text-left text-lg font-semibold leading-7 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent" title={entry.item.name}>{entry.item.name}</button>
        <p className="mt-2 text-sm text-muted">
          {entry.reason === 'no_wear_record' ? '아직 착용 기록이 없어요' : <>마지막 착용 기록 <strong className="font-semibold text-ink">{entry.daysSinceLastWorn}일 전</strong></>}
        </p>
        {entry.reason === 'long_unworn' && temperature != null && Number.isFinite(temperature) && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted" title="마지막 착용일에 기록된 하루 평균 기온이에요.">
            <Thermometer size={14} strokeWidth={1.5} aria-hidden="true" /> 그날 평균 기온 <span className="font-medium tabular-nums">{Math.round(temperature * 10) / 10}℃</span>
          </p>
        )}
        <button type="button" onClick={onRecommend} aria-label={`${entry.item.name} 코디 추천`} className="rediscovery-recommend mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          이 옷으로 코디 만들기 <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <div className="flex justify-center"><WardrobeWearPreferenceControl item={entry.item} onRecommend={onRecommend} label="당분간 안 보기" /></div>
      </div>
    </article>
  )
}
