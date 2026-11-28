/** iOS 빌드에서 지원하는 실행 시간 연장과 옷 사진 배경 제거 기능을 웹에 노출한다. */
export function createClosetWebViewBridgeScript(supportsPreviewSubmissionInBackground: boolean, supportsWardrobeCutout = false) {
  return `
  (function () {
    if (window.ClosetNative) {
      return true;
    }

    var pendingRequests = {};
    var requestSequence = 0;

    function request(type, payload, timeoutMs, signal, onPartial) {
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
          cleanup: cleanup,
          onPartial: onPartial
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

      if (response && response.ok && response.partial) {
        try {
          if (pending.onPartial) pending.onPartial(response.data);
        } catch (error) {
          pending.cleanup();
          pending.reject(error);
        }
        return;
      }

      pending.cleanup();

      if (!response || !response.ok) {
        pending.reject(new Error(response && response.error || 'Native bridge failed'));
        return;
      }

      pending.resolve(response.data);
    };

    window.ClosetNative = {
      showRewardedAd: function (sessionId) {
        return request('closet:native-rewarded-ad', { sessionId: sessionId }, 420000);
      },
      openAdPrivacyOptions: function () {
        return request('closet:native-ad-privacy', null, 120000);
      },
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
      selectWardrobePhotos: function (onPhoto, signal) {
        return request('closet:native-select-wardrobe-photos', null, 180000, signal, onPhoto);
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

    ${supportsPreviewSubmissionInBackground ? `
    window.ClosetNative.requestPreviewStart = function (query, variables, signal) {
      return request('closet:native-graphql', {
        query: query, variables: variables, finishPreviewInBackground: true
      }, 180000, signal);
    };
    ` : ''}

    ${supportsWardrobeCutout ? `
    window.ClosetNative.removeWardrobePhotoBackground = function (imageBase64, signal) {
      return request('closet:native-wardrobe-cutout', { imageBase64: imageBase64 }, 30000, signal);
    };
    ` : ''}

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'closet:native-bridge-ready'
      }));
    }

    return true;
  })();
  true;
`
}

export const CLOSET_WEBVIEW_BRIDGE_SCRIPT = createClosetWebViewBridgeScript(false)
