interface CenteredScrollTopInput {
  currentScrollTop: number
  containerTop: number
  containerHeight: number
  itemTop: number
  itemHeight: number
}

export function getCenteredScrollTop({
  currentScrollTop,
  containerTop,
  containerHeight,
  itemTop,
  itemHeight,
}: CenteredScrollTopInput) {
  return Math.max(
    0,
    currentScrollTop +
      itemTop -
      containerTop -
      (containerHeight - itemHeight) / 2,
  )
}
