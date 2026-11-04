import type { ColorMode } from '@closet/types'
import { colorHexToRgb, normalizeColorHex } from './color.js'

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const distance = (left: number[], right: number[]) => Math.max(...left.map((value, index) => Math.abs(value - right[index])))

/** 배경을 뺀 연결 영역 중 가장 큰 것만 고르고, 별도 큰 물체가 있으면 보정을 포기한다. */
function largestForeground(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length)
  let largest: number[] = []
  let secondSize = 0
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue
    const component = [start]
    visited[start] = 1
    for (let cursor = 0; cursor < component.length; cursor++) {
      const index = component[cursor]
      const x = index % width
      const y = Math.floor(index / width)
      const neighbours = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1]
      for (const neighbour of neighbours) {
        if (neighbour < 0 || !mask[neighbour] || visited[neighbour]) continue
        visited[neighbour] = 1
        component.push(neighbour)
      }
    }
    if (component.length > largest.length) {
      secondSize = largest.length
      largest = component
    } else secondSize = Math.max(secondSize, component.length)
  }
  return secondSize > largest.length * 0.12 ? [] : largest
}

/**
 * 단색 검정으로 확인된 사진에서 분리 가능한 원단 픽셀의 중앙값으로 AI의 대표 HEX를 보완한다.
 * 투명 배경 또는 밝고 균일한 테두리가 있으며, 하나의 큰 어두운 저채도 영역이 확인될 때만 적용한다.
 * 패턴·다색, 어두운/복잡한 배경, 경계에 걸친 물체, 불충분한 표본 및 디코딩 실패는 원래 HEX를 유지한다.
 * 실제 원단 색이나 조명을 복원하는 보정은 아니며 사진에 기록된 밝기·색을 사용한다.
 */
export async function refineBlackColor(imageBuffer: Buffer, mimeType: string, color: {
  colorName: string
  colorMode: ColorMode
  colorHex: string
}): Promise<string> {
  const original = normalizeColorHex(color.colorHex)
  const estimated = colorHexToRgb(original)
  if (color.colorName !== '블랙' || color.colorMode !== 'solid' || !estimated ||
    Math.max(...estimated) > 90 || Math.max(...estimated) - Math.min(...estimated) > 24) return original
  try {
    const { RawImage } = await import('@huggingface/transformers')
    const image = await RawImage.fromBlob(new Blob([Uint8Array.from(imageBuffer)], { type: mimeType }))
    const { data, info } = await image.toSharp().resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width, height, channels } = info
    const rgb = (index: number) => [data[index * channels], data[index * channels + 1], data[index * channels + 2]]
    const alpha = (index: number) => data[index * channels + 3]
    const border: number[] = []
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) border.push(y * width + x)
    }
    const transparent = border.filter((index) => alpha(index) < 16).length / border.length > 0.95
    const background = [0, 1, 2].map((channel) => median(border.map((index) => rgb(index)[channel])))
    if (!transparent && (Math.min(...background) < 180 || Math.max(...background) - Math.min(...background) > 25 ||
      border.filter((index) => distance(rgb(index), background) <= 18).length / border.length < 0.95)) return original

    const mask = new Uint8Array(width * height)
    for (let index = 0; index < mask.length; index++) mask[index] = Number(alpha(index) > 240 && (transparent || distance(rgb(index), background) > 35))
    const foreground = largestForeground(mask, width, height)
    if (foreground.length < mask.length * 0.08 || foreground.length > mask.length * 0.8 ||
      foreground.some((index) => index % width < 2 || index % width >= width - 2 || index < width * 2 || index >= width * (height - 2))) return original
    const dark = foreground.filter((index) => {
      const pixel = rgb(index)
      return Math.max(...pixel) <= 100 && Math.max(...pixel) - Math.min(...pixel) <= 24
    })
    if (dark.length < foreground.length * 0.7) return original
    // 배경 경계를 피하고 작은 로고·봉제선·그림자가 대표색을 좌우하지 않도록 넓은 원단의 중앙값을 쓴다.
    const interior = dark.filter((index) => [-2, -1, 1, 2, -width * 2, -width, width, width * 2].every((offset) => mask[index + offset]))
    if (interior.length < 128) return original
    const sampled = [0, 1, 2].map((channel) => median(interior.map((index) => rgb(index)[channel])))
    if (Math.max(...sampled) > 90) return original
    return `#${sampled.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
  } catch {
    return original
  }
}
