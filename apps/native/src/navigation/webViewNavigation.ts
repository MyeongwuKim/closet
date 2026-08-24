export function createWebViewNavigationScript(path: string) {
  return `
    (function () {
      var path = ${JSON.stringify(path)};
      var mode = window.ClosetRuntimeConfig && window.ClosetRuntimeConfig.routerMode;

      if (mode === 'hash') {
        window.location.hash = path;
        return;
      }

      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    })();
    true;
  `
}
