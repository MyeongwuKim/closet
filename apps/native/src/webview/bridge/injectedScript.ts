export const CLOSET_WEBVIEW_BRIDGE_SCRIPT = `
  (function () {
    if (window.ClosetNative) {
      return true;
    }

    var pendingRequests = {};
    var requestSequence = 0;

    function request(type, payload, timeoutMs) {
      if (!window.ReactNativeWebView) {
        return Promise.reject(new Error('Native bridge is not available'));
      }

      var id = 'closet-native-' + Date.now() + '-' + requestSequence++;

      return new Promise(function (resolve, reject) {
        var timeoutId = setTimeout(function () {
          delete pendingRequests[id];
          reject(new Error('Native bridge request timed out'));
        }, timeoutMs || 15000);

        pendingRequests[id] = {
          resolve: resolve,
          reject: reject,
          timeoutId: timeoutId
        };

        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({
          type: type,
          id: id
        }, payload || {})));
      });
    }

    window.__CLOSET_NATIVE_BRIDGE_RESPONSE__ = function (id, response) {
      var pending = pendingRequests[id];
      if (!pending) return;

      clearTimeout(pending.timeoutId);
      delete pendingRequests[id];

      if (!response || !response.ok) {
        pending.reject(new Error(response && response.error || 'Native bridge failed'));
        return;
      }

      pending.resolve(response.data);
    };

    window.ClosetNative = {
      getAppInfo: function () {
        return request('closet:native-app-info');
      },
      openAppSettings: function () {
        return request('closet:native-open-app-settings');
      },
      requestPermission: function (permission) {
        return request('closet:native-request-permission', {
          permission: permission
        }, 120000);
      },
      openExternalUrl: function (url) {
        return request('closet:native-open-external-url', { url: url });
      },
      setAuthSession: function (accessToken) {
        return request('closet:native-auth-session', {
          accessToken: accessToken || null
        });
      }
    };

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'closet:native-bridge-ready'
      }));
    }

    return true;
  })();
  true;
`
