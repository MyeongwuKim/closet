import type { Season, WeatherSnapshot } from '@closet/types'
import { ChevronLeft, LoaderCircle, RefreshCw } from 'lucide-react'
import type { OutfitStyle } from '../../../../../constants/styleOptions'
import { seasonLabels } from '../../../../../constants/seasons'
import {
  RecommendationAssistantMessage,
  RecommendationQuickReply,
} from '../RecommendationChatUi'
import type { SeasonChoice } from '../recommendationFlow'
import { WeatherSnapshotSummary } from '../../../../weather/components/WeatherSnapshotSummary'

interface StyleOption {
  value: OutfitStyle
  label: string
}

interface RecommendationStyleStepProps {
  season: Season
  seasonChoice: SeasonChoice
  options: StyleOption[]
  hasPreferredStyles: boolean
  isLoading: boolean
  isError: boolean
  weather: WeatherSnapshot | null
  isWeatherLoading: boolean
  weatherError: string | null
  onBack: () => void
  onRetry: () => void
  onWeatherRetry: () => void
  onSelect: (style: OutfitStyle) => void
}

export function RecommendationStyleStep({
  season,
  seasonChoice,
  options,
  hasPreferredStyles,
  isLoading,
  isError,
  weather,
  isWeatherLoading,
  weatherError,
  onBack,
  onRetry,
  onWeatherRetry,
  onSelect,
}: RecommendationStyleStepProps) {
  return (
    <section
      className="flex h-full flex-col gap-2 py-1"
      aria-live="polite"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center gap-3 py-1">
          <RecommendationAssistantMessage>
            <span className="mb-1.5 inline-flex rounded-full bg-canvas px-2.5 py-0.5 text-[10px] font-bold text-muted">
              {seasonChoice === 'current-weather'
                ? `현재 날씨 · ${seasonLabels[season]} 기준`
                : `${seasonLabels[season]} 기준`}
            </span>
            {seasonChoice === 'current-weather' && (
              weather ? <WeatherSnapshotSummary weather={weather} compact /> : null
            )}
            <p className="font-black">어떤 스타일로 추천할까요?</p>
            <p className="mt-0.5 text-muted">
              설정에 저장한 선호 스타일 중에서 골라주세요.
            </p>
          </RecommendationAssistantMessage>

          <div className="ml-10 flex flex-wrap justify-end gap-2">
            {isWeatherLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3.5 py-2 text-xs font-bold text-muted">
                <LoaderCircle className="animate-spin" size={14} /> 현재 날씨 확인 중
              </span>
            ) : weatherError ? (
              <div className="flex max-w-[17rem] flex-col items-end gap-2">
                <p className="text-right text-[11px] leading-4 text-muted" role="alert">
                  {weatherError}
                </p>
                <button
                  type="button"
                  onClick={onWeatherRetry}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-bold"
                >
                  <RefreshCw size={14} /> 위치·날씨 다시 확인
                </button>
              </div>
            ) : isLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3.5 py-2 text-xs font-bold text-muted">
                <LoaderCircle className="animate-spin" size={14} /> 스타일 불러오는 중
              </span>
            ) : isError ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-bold"
              >
                <RefreshCw size={14} /> 다시 시도
              </button>
            ) : (
              <>
                {!hasPreferredStyles && (
                  <p className="w-full text-right text-[11px] leading-4 text-muted">
                    저장한 스타일이 없어 전체 스타일을 보여드려요.
                  </p>
                )}
                {options.map((option, index) => (
                  <RecommendationQuickReply
                    key={option.value}
                    delayMs={80 + index * 45}
                    onClick={() => onSelect(option.value)}
                  >
                    {option.label}
                  </RecommendationQuickReply>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-end">
        <RecommendationQuickReply secondary delayMs={320} onClick={onBack}>
          <span className="inline-flex items-center gap-1">
            <ChevronLeft size={13} /> 뒤로가기
          </span>
        </RecommendationQuickReply>
      </div>
    </section>
  )
}
