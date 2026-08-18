export function normalizeColorHex(value: string) {
  return value.trim().toUpperCase()
}

export function isColorHex(value: string) {
  return /^#[0-9A-F]{6}$/.test(normalizeColorHex(value))
}

export function colorHexToRgb(
  value: string | null | undefined,
): [number, number, number] | null {
  if (!value || !isColorHex(value)) return null

  const hex = normalizeColorHex(value).slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}
