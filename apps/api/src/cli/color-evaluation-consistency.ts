import { deltaE76 } from './color-evaluation-metrics.js'

interface CapturedPhoto { id: string; garmentId?: string; scene?: string; expectedColors: string[] }
interface CapturedResult {
  result?: { colorName: string; colorHex: string; colorRgb: number[]; colorMode: string }
  referenceRgb?: number[]
}

/**
 * 같은 실물 옷의 서로 다른 촬영 결과를 묶어 색 계열·단색/패턴 유지 여부와 최대 사진 간 색차를 비교한다.
 * 사진 픽셀 색차와 AI 결과 색차는 따로 기록하며, 이 값만으로 실제 원단 색 복원 정확도를 판정하지 않는다.
 * 분석 실패도 그룹에 남겨 완료 사진끼리만 비교한 결과가 전체 성공으로 보이지 않도록 한다.
 */
export function evaluateColorConsistency(photos: CapturedPhoto[], records: Record<string, CapturedResult>) {
  const groups = new Map<string, CapturedPhoto[]>()
  for (const photo of photos) {
    if (!photo.garmentId) continue
    groups.set(photo.garmentId, [...(groups.get(photo.garmentId) ?? []), photo])
  }
  const maxDifference = (colors: number[][]) => {
    const differences = colors.flatMap((color, index) => colors.slice(index + 1).map((other) => deltaE76(color, other)))
    return differences.length ? Math.max(...differences) : null
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1).map(([garmentId, group]) => {
    const completed = group.filter((photo) => records[photo.id]?.result)
    const results = completed.map((photo) => records[photo.id].result!)
    return {
      garmentId, photos: group.map(({ id, scene }) => ({ id, scene })), completed: completed.length, total: group.length,
      colorNames: results.map((result) => result.colorName), hexes: results.map((result) => result.colorHex),
      allExpectedColorFamilies: completed.length === group.length && completed.every((photo) => photo.expectedColors.includes(records[photo.id].result!.colorName)),
      colorFamilyStable: completed.length === group.length && new Set(results.map((result) => result.colorName)).size === 1,
      compositionStable: completed.length === group.length && new Set(results.map((result) => result.colorMode)).size === 1,
      maxEstimatedDeltaE76: maxDifference(results.map((result) => result.colorRgb)),
      maxPhotoPixelDeltaE76: maxDifference(completed.flatMap((photo) => records[photo.id].referenceRgb ? [records[photo.id].referenceRgb!] : [])),
    }
  })
}
