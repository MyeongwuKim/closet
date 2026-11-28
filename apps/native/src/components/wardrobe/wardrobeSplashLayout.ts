/** 전체 창 중앙에 놓인 iOS 런치 이미지와 안전 영역 안의 옷장 중심을 맞춘다. */
export function getWardrobeSplashOffset(windowHeight: number, viewportTop: number, localCenter: number) {
  return windowHeight / 2 - viewportTop - localCenter
}
