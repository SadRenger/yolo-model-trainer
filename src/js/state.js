/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Observable State Store (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;

  App.createStore = function(initialState) {
    var state = Object.assign({}, initialState);

    return {
      get: function(key) { return state[key]; },
      set: function(key, value) {
        if (state[key] === value) return;
        state[key] = value;
        App.bus.dispatchEvent(new CustomEvent(App.EVENTS.STATE_CHANGED, {
          detail: { key: key, value: value }
        }));
      },
      subscribe: function(key, callback) {
        var handler = function(e) {
          if (e.detail.key === key) callback(e.detail.value);
        };
        App.bus.addEventListener(App.EVENTS.STATE_CHANGED, handler);
        return function() { App.bus.removeEventListener(App.EVENTS.STATE_CHANGED, handler); };
      },
      getAll: function() { return Object.assign({}, state); }
    };
  };
})();
