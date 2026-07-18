/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Application Bootstrap
   ═══════════════════════════════════════════════════ */

import { Router } from './router.js';
import { createStore } from './state.js';
import { Sidebar } from './components/sidebar.js';
import { ToastContainer } from './components/toast.js';
import { ModalManager } from './components/modal.js';
import { TooltipManager } from './components/tooltip.js';
import { bus, EVENTS } from './events.js';
import * as api from './api.js';

/* ── Global state ── */
const initialState = {
  currentPage: 'new-training',
  routeParams: {},
  sidebarStatus: 'ready',      // 'ready' | 'training' | 'error'
  sidebarStatusDetail: '',      // task name or error count
  diskSpace: { total: 0, free: 0 },
};

const store = createStore(initialState);

/* ── Instantiate singletons ── */
const sidebar = new Sidebar(document.getElementById('sidebar-container'));
const router = new Router(document.getElementById('content-area'));
const toastContainer = new ToastContainer(document.getElementById('toast-container'));
const modalManager = new ModalManager(document.getElementById('modal-root'));
const tooltipManager = new TooltipManager();

/* ── Wire event listeners ── */

// Sidebar NAVIGATE → router
bus.addEventListener(EVENTS.NAVIGATE, (e) => {
  router.navigate(e.detail.hash, e.detail.params);
});

// Page mounted → update sidebar active + store
bus.addEventListener(EVENTS.PAGE_MOUNTED, (e) => {
  store.set('currentPage', e.detail.page);
  sidebar.setActiveByPage(e.detail.page);
});

// Sidebar status updates
bus.addEventListener(EVENTS.SIDEBAR_STATUS, (e) => {
  const { status, detail } = e.detail;
  store.set('sidebarStatus', status);
  sidebar.setStatus(status, detail || '');
});

// Toast
bus.addEventListener(EVENTS.TOAST_SHOW, (e) => {
  const { type, title, message, duration } = e.detail;
  toastContainer.show(type, title, message, duration);
});

// Modal
bus.addEventListener(EVENTS.MODAL_OPEN, (e) => {
  modalManager.show(e.detail);
});

/* ── Initialize ── */

// Load initial disk space (mock)
api.checkEnvironment().then(env => {
  store.set('diskSpace', {
    total: parseFloat(env.disk.system_free) + 100, // rough mock
    free: parseFloat(env.disk.system_free),
  });
  sidebar.setDiskSpace(env.disk.system_free + ' GB');
});

// Start router
router.init();

// Set initial sidebar active
sidebar.setActiveByPage(store.get('currentPage'));

/* ── Expose for debugging ── */
if (typeof window !== 'undefined') {
  window.__app = { store, router, sidebar, toastContainer, modalManager, tooltipManager, api, bus, EVENTS };
}

console.log('YOLO Model Trainer — Frontend shell initialized');
