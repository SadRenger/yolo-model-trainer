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

  App.bus.addEventListener(App.EVENTS.NAVIGATE, function(e) {
    router.navigate(e.detail.hash, e.detail.params);
  });

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
  });

  router.init();
  sidebar.setActiveByPage(store.get('currentPage'));

  /* ── Expose for debugging ── */
  window.__app = { store: store, router: router, sidebar: sidebar, toastContainer: toastContainer, modalManager: modalManager, tooltipManager: tooltipManager };

  // Clear the inline test content
  var contentArea = document.getElementById('content-area');
  // Router already replaced it, but just in case
  console.log('YOLO Model Trainer initialized');

  /* ── Quick pipe diagnostic: spawn hello.py on startup ── */
  if (window.__TAURI_INTERNALS__ && App.tauri) {
    App.tauri.listen('python:line', function(payload) {
      console.log('[python:line]', payload);
    });
    App.tauri.invoke('test_python').then(function(taskId) {
      console.log('[test_python] spawned, task:', taskId);
    }).catch(function(err) {
      console.error('[test_python] FAILED:', err);
    });
  }
})();
