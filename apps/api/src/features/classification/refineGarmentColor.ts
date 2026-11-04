import type { ColorMode } from '@closet/types'
import { colorHexToRgb, normalizeColorHex } from './color.js'

/** 원본 사진의 좌상단을 기준으로 0~1로 정규화한, 배경·봉제선·그림자를 피한 원단 영역이다. */
export interface ColorSampleRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface ColorReferencePatch {
  id: string
  region: ColorSampleRegion
  colorHex: string
}

interface GarmentColor {
  colorName: string
  colorDetailName: string
  colorHex: string
}

type Rgb = [number, number, number]
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

/** 원단 영역의 유한한 좌표·크기와 사진 범위 안에 들어오는지를 검사한다. */
function isColorSampleRegion(value: unknown): value is ColorSampleRegion {
  if (!value || typeof value !== 'object') return false
  const region = value as ColorSampleRegion
  return [region.x, region.y, region.width, region.height].every(Number.isFinite) &&
    region.x >= 0 && region.y >= 0 && region.width >= 0.01 && region.width <= 0.12 &&
    region.height >= 0.01 && region.height <= 0.12 && region.x + region.width <= 1 && region.y + region.height <= 1
}

async function readPixels(imageBuffer: Buffer, mimeType: string) {
  const { RawImage } = await import('@huggingface/transformers')
  const image = await RawImage.fromBlob(new Blob([Uint8Array.from(imageBuffer)], { type: mimeType }))
  return image.toSharp().rotate().resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}

/** 사진을 8×8로 나눈 각 셀 중심의 작은 영역에서 대표색을 계산해, AI가 좌표 대신 표본 ID를 선택하게 한다. */
export async function createColorReferencePatches(imageBuffer: Buffer, mimeType: string): Promise<ColorReferencePatch[]> {
  try {
    const { data, info } = await readPixels(imageBuffer, mimeType)
    const patches: ColorReferencePatch[] = []
    for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
      const region = { x: (column + 0.5) / 8 - 0.03, y: (row + 0.5) / 8 - 0.03, width: 0.06, height: 0.06 }
      const pixels: Rgb[] = []
      const left = Math.floor(region.x * info.width)
      const top = Math.floor(region.y * info.height)
      const right = Math.floor((region.x + region.width) * info.width)
      const bottom = Math.floor((region.y + region.height) * info.height)
      if (right - left < 4 || bottom - top < 4) continue
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const offset = (y * info.width + x) * info.channels
        if (data[offset + 3] > 240) pixels.push([data[offset], data[offset + 1], data[offset + 2]])
      }
      if (pixels.length < (right - left) * (bottom - top) * 0.9) continue
      const rgb = [0, 1, 2].map((channel) => median(pixels.map((pixel) => pixel[channel])))
      patches.push({ id: `r${row}c${column}`, region, colorHex: `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}` })
    }
    return patches
  } catch {
    return []
  }
}

/** 원단 표본 ID를 사진의 8×8 위치에 표시한 AI 참조용 이미지를 만든다. 색 표본 계산은 표시가 없는 원본에서만 수행한다. */
export async function createColorReferenceGuide(imageBuffer: Buffer, mimeType: string): Promise<Buffer | null> {
  try {
    const { RawImage } = await import('@huggingface/transformers')
    const image = await RawImage.fromBlob(new Blob([Uint8Array.from(imageBuffer)], { type: mimeType }))
    const { info } = await image.toSharp().rotate().resize({ width: 1024, height: 1024, fit: 'inside' }).png().toBuffer({ resolveWithObject: true })
    const labels: string[] = []
    for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
      const x = column * info.width / 8
      const y = row * info.height / 8
      const centerX = (column + 0.5) * info.width / 8
      const centerY = (row + 0.5) * info.height / 8
      labels.push(`<rect x="${x}" y="${y}" width="${info.width / 8}" height="${info.height / 8}" fill="none" stroke="white" stroke-opacity="0.65"/><rect x="${centerX - info.width * 0.03}" y="${centerY - info.height * 0.03}" width="${info.width * 0.06}" height="${info.height * 0.06}" fill="none" stroke="#26C78A" stroke-width="1.5"/><text x="${x + 4}" y="${y + 17}" font-family="Arial" font-size="14" fill="black" stroke="white" stroke-width="3" paint-order="stroke">r${row}c${column}</text>`)
    }
    const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">${labels.join('')}</svg>`
    return image.toSharp().rotate().resize({ width: 1024, height: 1024, fit: 'inside' })
      .composite([{ input: Buffer.from(overlay) }]).png().toBuffer()
  } catch {
    return null
  }
}

function toHsv(rgb: Rgb) {
  const [r, g, b] = rgb.map((channel) => channel / 255)
  const max = Math.max(r, g, b)
  const difference = max - Math.min(r, g, b)
  let hue = 0
  if (difference > 0) {
    hue = max === r ? (g - b) / difference : max === g ? (b - r) / difference + 2 : (r - g) / difference + 4
    hue = (hue * 60 + 360) % 360
  }
  return { hue, saturation: max === 0 ? 0 : difference / max, value: max }
}

function hueFamily(hue: number) {
  if (hue < 20 || hue >= 345) return 'red'
  if (hue < 45) return 'orange'
  if (hue < 75) return 'yellow'
  if (hue < 175) return 'green'
  if (hue < 205) return 'cyan'
  if (hue < 265) return 'blue'
  if (hue < 315) return 'purple'
  return 'pink'
}

function fromHsv(hue: number, saturation: number, value: number): Rgb {
  const chroma = value * saturation
  const x = chroma * (1 - Math.abs(hue / 60 % 2 - 1))
  const offset = value - chroma
  const channels = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x]
    : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x]
  return channels.map((channel) => Math.round((channel + offset) * 255)) as Rgb
}

function isCoolNeutralFabricPixel(pixel: Rgb) {
  const hsv = toHsv(pixel)
  return hsv.value >= 96 / 255 && hsv.saturation <= 0.12 && pixel[2] >= pixel[0] - 3 && pixel[2] >= pixel[1] - 3
}

/**
 * AI가 고른 서로 다른 원단 표본 세 곳이 일치할 때, 인접 색 계열과 어두운 무채색의 오인식을 보완한다.
 * 패턴은 밝은 크림 추정의 바탕 세 곳에 노란 기운이 없을 때만 화이트로 보완한다. 단색용 색상 축 교정은 적용하지 않는다.
 * 표본이 불안정하거나 다색이면 원래 분석을 유지하고, 큰 색상 충돌도 자동 보정하지 않는다.
 * 밝기를 그대로 복사하지 않도록 AI 추정의 밝기는 유지한다. 저채도 원단은 중립화하고 유채색은 색상 축만 교정한다.
 */
export async function refineGarmentColor(
  imageBuffer: Buffer,
  mimeType: string,
  color: GarmentColor & { colorMode: ColorMode },
  regions: ColorSampleRegion[] | null,
): Promise<GarmentColor> {
  const original = { colorName: color.colorName, colorDetailName: color.colorDetailName, colorHex: normalizeColorHex(color.colorHex) }
  const rgb = colorHexToRgb(original.colorHex)
  if (!rgb || regions?.length !== 3 || !regions.every(isColorSampleRegion)) return original
  const estimated = toHsv(rgb)
  const lightPatternBase = color.colorMode === 'patterned' && color.colorName === '크림' &&
    estimated.value >= 0.85 && estimated.saturation <= 0.16
  if (color.colorMode !== 'solid' && !lightPatternBase) return original
  for (let index = 0; index < regions.length; index++) {
    const a = regions[index]
    if (regions.slice(index + 1).some((b) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height,
    )) return original
  }

  try {
    const { data, info } = await readPixels(imageBuffer, mimeType)
    const samples: Rgb[] = []
    for (const region of regions) {
      const left = Math.floor(region.x * info.width)
      const top = Math.floor(region.y * info.height)
      const right = Math.floor((region.x + region.width) * info.width)
      const bottom = Math.floor((region.y + region.height) * info.height)
      if (right - left < 4 || bottom - top < 4) return original
      const pixels: Rgb[] = []
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const offset = (y * info.width + x) * info.channels
        if (data[offset + 3] > 240) pixels.push([data[offset], data[offset + 1], data[offset + 2]])
      }
      if (pixels.length < (right - left) * (bottom - top) * 0.9) return original
      if (lightPatternBase) {
        // 어두운 줄무늬와 가장 밝은 반사를 빼고 바탕을 확인한다. 흰 무늬 일부만 있는 크림 바탕은 전체 표본 비율로 제외한다.
        if (pixels.filter(isCoolNeutralFabricPixel).length < pixels.length * 0.6) return original
        const sorted = [...pixels].sort((a, b) => Math.max(...a) - Math.max(...b))
        const base = sorted.slice(Math.floor(sorted.length * 0.5), Math.ceil(sorted.length * 0.9))
        if (base.filter(isCoolNeutralFabricPixel).length < base.length * 0.8) return original
        samples.push([0, 1, 2].map((channel) => median(base.map((pixel) => pixel[channel]))) as Rgb)
        continue
      }
      const sampled = [0, 1, 2].map((channel) => median(pixels.map((pixel) => pixel[channel]))) as Rgb
      const hsv = toHsv(sampled)
      const stable = pixels.filter((pixel) => {
        const current = toHsv(pixel)
        return hsv.saturation < 0.25
          ? Math.max(...pixel.map((channel, index) => Math.abs(channel - sampled[index]))) <= 18
          : current.saturation >= 0.15 && hueDistance(current.hue, hsv.hue) <= 25
      }).length >= pixels.length * 0.8
      if (!stable) return original
      samples.push(sampled)
    }
    if (lightPatternBase) {
      const channel = Math.round(estimated.value * 255)
      return { colorName: '화이트', colorDetailName: '화이트 바탕', colorHex: `#${channel.toString(16).padStart(2, '0').repeat(3).toUpperCase()}` }
    }
    const sampled = toHsv([0, 1, 2].map((channel) => median(samples.map((pixel) => pixel[channel]))) as Rgb)
    // 워싱 검정의 약한 푸른 기운은 색상 축보다 저채도라는 근거를 우선한다. 실제 짙은 청록·네이비는 제외한다.
    if (estimated.value <= 0.5 && estimated.saturation <= 0.55 &&
      samples.every((pixel) => { const hsv = toHsv(pixel); return hsv.saturation <= 0.25 && hsv.value <= 0.45 }) &&
      Math.abs(estimated.value - sampled.value) <= 0.15) {
      const channel = Math.round(estimated.value * 255)
      const colorName = channel <= 64 ? '블랙' : '그레이'
      return { colorName, colorDetailName: colorName, colorHex: `#${channel.toString(16).padStart(2, '0').repeat(3).toUpperCase()}` }
    }
    if (estimated.saturation < 0.2 || samples.some((pixel) => toHsv(pixel).saturation < 0.2)) return original
    if (samples.some((pixel) => hueDistance(toHsv(pixel).hue, sampled.hue) > 18)) return original
    const difference = hueDistance(estimated.hue, sampled.hue)
    // AI와 세 원단 표본 모두 밝은 청색을 가리키면 HEX는 유지하고 넓은 색 이름을 블루로 맞춘다.
    if (color.colorName === '네이비' && estimated.value > 0.35 && sampled.value > 0.35 &&
      samples.every((pixel) => hueFamily(toHsv(pixel).hue) === 'blue') && difference <= 18) {
      return { ...original, colorName: '블루', colorDetailName: '짙은 블루' }
    }
    if (difference < 12 || difference > 45 || hueFamily(estimated.hue) === hueFamily(sampled.hue)) return original

    const family = hueFamily(sampled.hue)
    const names = { red: '레드', orange: '오렌지', yellow: '옐로', green: '그린', cyan: '블루', blue: '블루', purple: '퍼플', pink: '핑크' }
    const colorName = family === 'blue' && estimated.value < 0.45 ? '네이비' : names[family]
    const corrected = fromHsv(sampled.hue, estimated.saturation, estimated.value)
    const colorHex = `#${corrected.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
    return { colorName, colorDetailName: `${estimated.value < 0.5 ? '짙은 ' : ''}${colorName}`, colorHex }
  } catch {
    return original
  }
}
