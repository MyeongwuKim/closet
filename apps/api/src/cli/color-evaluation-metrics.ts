/** 화면 sRGB를 D65 CIELAB으로 바꾼다. CIE 정의: https://cie.co.at/eilv/157. 실제 원단 측색은 아니다. */
export function rgbToLab(rgb: readonly number[]): [number, number, number] {
  const [red, green, blue] = rgb.map((value) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const transform = (value: number) => value > (6 / 29) ** 3 ? Math.cbrt(value) : value / (3 * (6 / 29) ** 2) + 4 / 29
  const x = transform((0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / 0.95047)
  const y = transform(0.2126729 * red + 0.7151522 * green + 0.072175 * blue)
  const z = transform((0.0193339 * red + 0.119192 * green + 0.9503041 * blue) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

/** CIE76 색차를 반환한다. 0이면 같은 화면 색이다. 정의: https://cie.co.at/eilvterm/17-23-077. */
export function deltaE76(left: readonly number[], right: readonly number[]) {
  const a = rgbToLab(left)
  const b = rgbToLab(right)
  return Math.hypot(...a.map((value, index) => value - b[index]))
}

/** 그림자·주름의 극단값 영향을 줄이기 위해 정렬한 표본의 중앙값을 사용한다. */
export function median(values: number[]) {
  if (values.length === 0) throw new Error('색 표본이 비어 있습니다.')
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}
