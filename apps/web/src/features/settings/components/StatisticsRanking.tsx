import { ChevronRight, Crown, Footprints, Images, Shirt, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'

export interface StatisticRankEntry {
  key: string
  label: string
  count: number
  color?: string | null
  imageUrl?: string | null
  imageUrls?: string[]
  href?: string
  onSelect?: () => void
}

interface StatisticsRankingProps {
  entries: StatisticRankEntry[]
  kind: 'category' | 'color' | 'item' | 'outfit' | 'style'
  total?: number
  unit: string
  empty: string
}

const podiums = [
  { column: 2, className: 'h-20 border-[#e8d09a] bg-[#f8e9c5] text-[#8c641c]' },
  { column: 1, className: 'h-14 border-[#d8d9d6] bg-[#eeefec] text-[#646965]' },
  { column: 3, className: 'h-10 border-[#e3cbb9] bg-[#f2e3d8] text-[#967153]' },
]

function RankVisual({ entry, kind }: Pick<StatisticsRankingProps, 'kind'> & { entry: StatisticRankEntry }) {
  if (entry.imageUrl) {
    return <img src={entry.imageUrl} alt="" loading="lazy" decoding="async" className="size-full object-contain p-1" />
  }
  if (kind === 'outfit') {
    const images = entry.imageUrls?.slice(0, 4) ?? []
    return images.length > 0 ? (
      <span className={`grid size-full gap-0.5 p-1 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${images.length > 2 ? 'grid-rows-2' : 'grid-rows-1'}`}>
        {images.map((url, index) => <img key={`${url}-${index}`} src={url} alt="" loading="lazy" decoding="async" className="size-full min-h-0 min-w-0 rounded bg-surface object-contain" />)}
      </span>
    ) : <Images size={30} strokeWidth={1.5} className="text-ink/70" aria-hidden="true" />
  }
  if (kind === 'color') {
    return <span className="size-3/4 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: entry.color ?? '#d9d5cc' }} />
  }
  if (kind === 'category') {
    return (
      <ClothingCategoryIcon
        category={entry.key}
        size={30}
        strokeWidth={1.5}
        className="text-ink/70"
      />
    )
  }
  const Icon =
    kind === 'style'
      ? Sparkles
      : entry.key === 'shoes'
        ? Footprints
        : Shirt
  return <Icon size={30} strokeWidth={1.5} className="text-ink/70" aria-hidden="true" />
}

export function StatisticsRanking({ entries, kind, total, unit, empty }: StatisticsRankingProps) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{empty}</p>
  }

  const hasTopTie = entries.slice(0, 3).some((entry) => entries.filter((candidate) => candidate.count === entry.count).length > 1)
  const countLabel = (entry: StatisticRankEntry) => `${entry.count}${unit}`
  const percentLabel = (entry: StatisticRankEntry) => total && total > 0
    ? `${Math.round(entry.count / total * 100)}%` : null

  return (
    <>
      <ol className="mt-8 grid grid-cols-3 items-end gap-2 border-b border-line" aria-label="상위 3개 순위">
        {entries.slice(0, 3).map((entry, index) => {
          const podium = podiums[index]
          const content = (
            <>
              <span className={`relative mx-auto flex max-w-full items-center justify-center rounded-2xl bg-canvas ${
                kind === 'outfit'
                  ? index === 0 ? 'h-28 w-20 sm:h-32 sm:w-24' : 'h-24 w-16 sm:h-28 sm:w-20'
                  : index === 0 ? 'size-18 sm:size-20' : 'size-14 sm:size-16'
              }`}>
                {index === 0 && <Crown size={21} className="absolute -top-6 text-[#b18a36]" aria-label="1위" />}
                <RankVisual entry={entry} kind={kind} />
              </span>
              <strong className="mt-3 line-clamp-2 min-h-9 w-full break-keep text-center text-xs leading-[18px] [overflow-wrap:anywhere] sm:text-sm" title={entry.label}>
                {entry.label}
              </strong>
              <span className="mt-1 block text-center text-sm font-black tabular-nums">{countLabel(entry)}</span>
              {percentLabel(entry) && <span className="mt-0.5 block text-center text-[11px] text-muted">{percentLabel(entry)}</span>}
              <span className={`mt-3 flex w-full items-center justify-center rounded-t-xl border border-b-0 font-black ${podium.className}`}>
                <span className={index === 0 ? 'text-3xl' : 'text-2xl'}>{index + 1}<span className="ml-0.5 text-xs font-bold">위</span></span>
              </span>
            </>
          )
          return (
            <li key={entry.key} className="min-w-0" style={{ gridColumn: podium.column, gridRow: 1 }}>
              {entry.href ? (
                <Link to={entry.href} className="block rounded-t-2xl transition-opacity hover:opacity-75" aria-label={`${index + 1}위 ${entry.label}, ${countLabel(entry)} 상세 보기`}>
                  {content}
                </Link>
              ) : entry.onSelect ? (
                <button type="button" onClick={entry.onSelect} className="block w-full rounded-t-2xl transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-accent" aria-label={`${index + 1}위 ${entry.label}, ${countLabel(entry)} 상세 보기`}>
                  {content}
                </button>
              ) : <div>{content}</div>}
            </li>
          )
        })}
      </ol>
      {hasTopTie && <p className="mt-2 text-center text-[10px] leading-4 text-muted">동률인 항목은 이름순으로 배치했어요.</p>}
      {entries.length > 3 && (
        <ol start={4} className="mt-3 divide-y divide-line" aria-label="4위부터 나머지 순위">
          {entries.slice(3).map((entry, index) => {
            const content = (
              <>
                <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted">{index + 4}</span>
                {kind === 'item' || kind === 'outfit' ? (
                  <span className={`flex shrink-0 items-center justify-center rounded-xl bg-canvas ${kind === 'outfit' ? 'h-16 w-12' : 'size-12'}`}><RankVisual entry={entry} kind={kind} /></span>
                ) : entry.color ? <span className="size-3.5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: entry.color }} /> : null}
                <span className="min-w-0 flex-1 truncate text-sm font-bold" title={entry.label}>{entry.label}</span>
                <span className="shrink-0 text-right text-xs tabular-nums">
                  <strong className="block">{countLabel(entry)}</strong>
                  {percentLabel(entry) && <span className="mt-0.5 block text-[11px] text-muted">{percentLabel(entry)}</span>}
                </span>
                {(entry.href || entry.onSelect) && <ChevronRight size={14} className="shrink-0 text-muted" />}
              </>
            )
            return (
              <li key={entry.key}>
                {entry.href ? <Link to={entry.href} className="flex items-center gap-3 py-3">{content}</Link>
                  : entry.onSelect ? <button type="button" onClick={entry.onSelect} className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-canvas/60 focus-visible:outline-2 focus-visible:outline-accent" aria-label={`${index + 4}위 ${entry.label}, ${countLabel(entry)} 상세 보기`}>{content}</button>
                    : <div className="flex items-center gap-3 py-3">{content}</div>}
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
