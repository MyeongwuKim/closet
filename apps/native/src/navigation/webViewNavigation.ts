export const WEB_VIEW_NAVIGATION_DELIVERED = 'closet:web-navigation-delivered'

/** 마지막 이동 요청을 앱의 전경·웹 준비 상태에서 전달하고, 웹이 수신을 확인하면 제거한다. */
export function createWebViewNavigationQueue() {
  let nextId = 0
  let pending: { id: number; path: string } | null = null
  return {
    enqueue(path: string) { pending = { id: ++nextId, path } },
    flush({ isReady, isActive }: { isReady: boolean; isActive: boolean }, deliver: (path: string, id: number) => void) {
      if (pending && isReady && isActive) deliver(pending.path, pending.id)
    },
    acknowledge(id: number) {
      if (pending?.id === id) pending = null
    },
  }
}

/** 알림·딥 링크의 내부 경로를 현재 WebView 문서에서 라우터에 전달한다. */
export function createWebViewNavigationScript(path: string, navigationId?: number) {
  return `
    (function () {
      var path = ${JSON.stringify(path)};
      var mode = window.ClosetRuntimeConfig && window.ClosetRuntimeConfig.routerMode;
      var destination = mode === 'hash' ? '#' + path : path;
      var currentDestination = mode === 'hash' ? window.location.hash : window.location.pathname + window.location.search + window.location.hash;

      if (currentDestination !== destination) {
        // React Router는 방문 순번으로 이동 거리를 계산하고 키로 스크롤 위치를 복원한다.
        var currentIndex = window.history.state && window.history.state.idx;
        var entry = {
          idx: Number.isInteger(currentIndex) ? currentIndex + 1 : 1,
          key: Math.random().toString(36).slice(2, 10),
          usr: null
        };

        // location.hash 대입은 iOS WebView에서 새 로딩 시작 이벤트를 발생시킨다.
        window.history.pushState(entry, '', destination);
        window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
      }

      var navigationId = ${JSON.stringify(navigationId ?? null)};
      if (navigationId !== null && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: ${JSON.stringify(WEB_VIEW_NAVIGATION_DELIVERED)},
          id: navigationId,
          loadKey: window.__closetBundleLoadKey
        }));
      }
    })();
    true;
  `
}
