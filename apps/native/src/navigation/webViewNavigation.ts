/** 알림·딥 링크의 내부 경로를 현재 WebView 문서에서 라우터에 전달한다. */
export function createWebViewNavigationScript(path: string) {
  return `
    (function () {
      var path = ${JSON.stringify(path)};
      var mode = window.ClosetRuntimeConfig && window.ClosetRuntimeConfig.routerMode;
      var destination = mode === 'hash' ? '#' + path : path;

      if (mode === 'hash' && window.location.hash === destination) return;

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
    })();
    true;
  `
}
