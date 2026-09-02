export const CLOSET_WEBVIEW_BRIDGE_SCRIPT = `
  (function () {
    if (window.ClosetNative) {
      return true;
    }

    var pendingRequests = {};
    var requestSequence = 0;

    function request(type, payload, timeoutMs, signal) {
      if (!window.ReactNativeWebView) {
        return Promise.reject(new Error('Native bridge is not available'));
      }
      if (signal && signal.aborted) {
        return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      }

      var id = 'closet-native-' + Date.now() + '-' + requestSequence++;

      return new Promise(function (resolve, reject) {
        function cleanup() {
          clearTimeout(timeoutId);
          delete pendingRequests[id];
          if (signal) signal.removeEventListener('abort', onAbort);
        }

        function cancel(error) {
          cleanup();
          if (type === 'closet:native-graphql') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'closet:native-cancel-graphql', id: id
            }));
          }
          reject(error);
        }

        function onAbort() {
          cancel(signal.reason || new DOMException('Aborted', 'AbortError'));
        }

        var timeoutId = setTimeout(function () {
          cancel(new Error('Native bridge request timed out'));
        }, timeoutMs || 15000);

        pendingRequests[id] = {
          resolve: resolve,
          reject: reject,
          cleanup: cleanup
        };

        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({
            type: type,
            id: id
          }, payload || {})));
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
    }

    window.__CLOSET_NATIVE_BRIDGE_RESPONSE__ = function (id, response) {
      var pending = pendingRequests[id];
      if (!pending) return;

      pending.cleanup();

      if (!response || !response.ok) {
        pending.reject(new Error(response && response.error || 'Native bridge failed'));
        return;
      }

      pending.resolve(response.data);
    };

    window.ClosetNative = {
      requestGraphql: function (query, variables, signal) {
        return request('closet:native-graphql', {
          query: query, variables: variables
        }, 180000, signal);
      },
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
      getCurrentLocation: function () {
        return request('closet:native-current-location', null, 30000);
      },
      captureWardrobePhoto: function () {
        return request('closet:native-capture-wardrobe-photo', null, 180000);
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
