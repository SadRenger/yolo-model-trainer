/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Tauri Bridge (global namespace)
   Thin wrapper around __TAURI_INTERNALS__ (no @tauri-apps/api needed).
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  App.tauri = App.tauri || {};

  var INTERNALS = window.__TAURI_INTERNALS__;
  var HAS_TAURI = !!INTERNALS;

  if (!HAS_TAURI) {
    // Running in a regular browser — all methods will reject
    App.tauri.invoke = function() { return Promise.reject(new Error('Not in Tauri')); };
    App.tauri.listen = function() { return Promise.resolve(function() {}); };
    return;
  }

  /* ── invoke(cmd, args) ── */
  App.tauri.invoke = function(cmd, args) {
    args = args || {};
    return INTERNALS.invoke(cmd, args);
  };

  /* ── listen(eventName, handler) → Promise<unlistenFn> ── */
  App.tauri.listen = function(eventName, handler) {
    // Create a callback token from the handler
    var callbackId = INTERNALS.transformCallback(handler, false);

    // Register the event listener via the event plugin
    return INTERNALS.invoke('plugin:event|listen', {
      event: eventName,
      target: { kind: 'Any' },
      handler: callbackId,
    }).then(function(eventId) {
      return function() {
        // Unregister
        if (window.__TAURI_EVENT_PLUGIN_INTERNALS__) {
          window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(eventName, eventId);
        }
        return INTERNALS.invoke('plugin:event|unlisten', {
          event: eventName,
          eventId: eventId,
        });
      };
    });
  };
})();
