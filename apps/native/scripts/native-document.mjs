// These constraints belong to the app bundle; the browser build keeps its normal zoom behavior.
export function constrainNativeDocument(html) {
  const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />'
  return html
    .replace(/<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>\s*/gi, '')
    .replace(/<\/head>/i, `${viewport}
    <style data-closet-native-interactions>
      html, body { touch-action: pan-x pan-y; }
      html { overscroll-behavior: none; }
      body {
        overflow-x: clip;
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
      input, textarea, [contenteditable]:not([contenteditable="false"]) {
        -webkit-user-select: text;
        user-select: text;
        -webkit-touch-callout: default;
      }
      img, a { -webkit-user-drag: none; }
      [class~="overflow-y-auto"] { overscroll-behavior-y: none; }
    </style>
    <script data-closet-native-interactions>
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
        document.addEventListener(type, function (event) {
          event.preventDefault();
        }, { passive: false });
      });
      ['dblclick', 'contextmenu', 'selectstart', 'dragstart'].forEach(function (type) {
        document.addEventListener(type, function (event) {
          var target = event.target;
          if (target && target.nodeType === 3) target = target.parentElement;
          if (target && (target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName))) return;
          event.preventDefault();
        }, { passive: false });
      });
    </script>
  </head>`)
}
