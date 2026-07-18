/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Events (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;

  App.bus = new EventTarget();

  App.EVENTS = {
    NAVIGATE:        'app:navigate',
    PAGE_MOUNTED:    'app:page-mounted',
    STATE_CHANGED:   'app:state-changed',
    TOAST_SHOW:      'ui:toast-show',
    MODAL_OPEN:      'ui:modal-open',
    MODAL_CLOSE:     'ui:modal-close',
    SIDEBAR_STATUS:  'ui:sidebar-status',
    TRAINING_START:   'training:start',
    TRAINING_PROGRESS:'training:progress',
    TRAINING_COMPLETE:'training:complete',
    TRAINING_ERROR:   'training:error',
  };
})();
