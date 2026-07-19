/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Application Bootstrap (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;

  /* ── Global state ── */
  var store = App.createStore({
    currentPage: 'new-training',
    routeParams: {},
    sidebarStatus: 'ready',
    sidebarStatusDetail: '',
    diskSpace: { total: 0, free: 0 },
  });

  /* ── Instantiate singletons ── */
  var sidebar = new App.components.Sidebar(document.getElementById('sidebar-container'));
  var router = new App.Router(document.getElementById('content-area'));
  var toastContainer = new App.components.ToastContainer(document.getElementById('toast-container'));
  var modalManager = new App.components.ModalManager(document.getElementById('modal-root'));
  var tooltipManager = new App.components.TooltipManager();

  // Store modal manager reference for pages to use
  App._modalManager = modalManager;

  /* ── Wire event listeners ── */

  // NAVIGATE handled by router itself (router.init registers its own listener)

  App.bus.addEventListener(App.EVENTS.PAGE_MOUNTED, function(e) {
    store.set('currentPage', e.detail.page);
    sidebar.setActiveByPage(e.detail.page);
  });

  App.bus.addEventListener(App.EVENTS.SIDEBAR_STATUS, function(e) {
    store.set('sidebarStatus', e.detail.status);
    sidebar.setStatus(e.detail.status, e.detail.detail || '');
  });

  App.bus.addEventListener(App.EVENTS.TOAST_SHOW, function(e) {
    toastContainer.show(e.detail.type, e.detail.title, e.detail.message, e.detail.duration);
  });

  App.bus.addEventListener(App.EVENTS.MODAL_OPEN, function(e) {
    modalManager.show(e.detail);
  });

  /* ── Initialize ── */

  App.api.checkEnvironment().then(function(env) {
    sidebar.setDiskSpace(env.disk.system_free + ' GB');
    App._envCache = env; // cached for dynamic GPU dropdown
  });

  router.init();
  sidebar.setActiveByPage(store.get('currentPage'));

  /* ── Global training lifecycle listeners (survive page switches) ── */
  if (window.__TAURI_INTERNALS__ && App.tauri) {
    // Parse train:line for T-104 progress → sidebar percentage
    App.tauri.listen('train:line', function(event) {
      var payload = event.payload;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch(_) {} }
      if (!payload || payload.code !== 'T-104') return;
      var pct = payload.epoch && payload.total_epochs
        ? Math.round((payload.epoch / payload.total_epochs) * 100) : 0;
      App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TRAINING_PROGRESS, {
        detail: { epoch: payload.epoch, totalEpochs: payload.total_epochs, pct: pct }
      }));
    });

    App.tauri.listen('train:completed', function() {
      App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'completed' } }));
    });
    App.tauri.listen('train:stopped', function() {
      App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'ready' } }));
    });
    App.tauri.listen('train:error', function() {
      App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'ready' } }));
    });
  }

  /* ── Expose for debugging ── */
  window.__app = { store: store, router: router, sidebar: sidebar, toastContainer: toastContainer, modalManager: modalManager, tooltipManager: tooltipManager };
  // Disable browser autocomplete on all inputs (desktop app, not web)
  document.querySelectorAll('input').forEach(function(el) { el.autocomplete = 'off'; });
  // Also catch dynamically created inputs
  var observer = new MutationObserver(function() {
    document.querySelectorAll('input:not([autocomplete])').forEach(function(el) {
      el.setAttribute('autocomplete', 'off');
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('YOLO Model Trainer initialized');
})();
