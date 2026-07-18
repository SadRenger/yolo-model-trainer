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
  });

  router.init();
  sidebar.setActiveByPage(store.get('currentPage'));

  /* ── Expose for debugging ── */
  window.__app = { store: store, router: router, sidebar: sidebar, toastContainer: toastContainer, modalManager: modalManager, tooltipManager: tooltipManager };
  console.log('YOLO Model Trainer initialized');
})();
