/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Hash Router
   动态 import() 页面模块，管理 mount/destroy 生命周期
   ═══════════════════════════════════════════════════ */

import { bus, EVENTS } from './events.js';

/**
 * Route table: hash → page module name, title
 * @type {Array<{ hash: string, page: string, title: string }>}
 */
const ROUTES = [
  { hash: '#/new-training', page: 'new-training', title: '新建训练任务' },
  { hash: '#/history',      page: 'training-history', title: '训练历史' },
  { hash: '#/inference',    page: 'inference', title: '推理测试' },
  { hash: '#/settings',     page: 'settings', title: '设置' },
];

const DEFAULT_HASH = '#/new-training';

/**
 * Parse query-string-like params from a hash fragment.
 * e.g. "#/new-training?resume=task-001" → { resume: 'task-001' }
 * @param {string} hash
 * @returns {{ path: string, params: Record<string, string> }}
 */
function parseHash(hash) {
  const [path, query] = hash.split('?');
  const params = {};
  if (query) {
    query.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { path, params };
}

export class Router {
  /**
   * @param {HTMLElement} container — the #content-area element
   */
  constructor(container) {
    this.container = container;
    this.currentPage = null;
    this.currentPageName = null;
    this.currentDestroy = null; // cleanup function from mounted page
  }

  /**
   * Start listening for hash changes and handle the initial load.
   */
  init() {
    window.addEventListener('hashchange', () => this._handleRoute());

    // Listen for programmatic NAVIGATE events (from sidebar, etc.)
    bus.addEventListener(EVENTS.NAVIGATE, (e) => {
      this.navigate(e.detail.hash, e.detail.params);
    });

    // Handle initial load
    if (!window.location.hash) {
      window.location.hash = DEFAULT_HASH;
    } else {
      this._handleRoute();
    }
  }

  /**
   * Programmatic navigation.
   * @param {string} hash - e.g. "#/settings" or "#/new-training?resume=task-001"
   * @param {object} [params] - additional params merged into the URL query string
   */
  navigate(hash, params = {}) {
    const { path, params: existingParams } = parseHash(hash);
    const merged = { ...existingParams, ...params };
    const queryStr = Object.entries(merged)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    window.location.hash = queryStr ? `${path}?${queryStr}` : path;
  }

  /**
   * Get the current route info.
   * @returns {{ hash: string, page: string, title: string } | null}
   */
  getCurrentRoute() {
    const { path } = parseHash(window.location.hash);
    return ROUTES.find(r => r.hash === path) || null;
  }

  /**
   * Get the current query params.
   * @returns {Record<string, string>}
   */
  getParams() {
    const { params } = parseHash(window.location.hash);
    return params;
  }

  /* ── Private ── */

  async _handleRoute() {
    const { path, params } = parseHash(window.location.hash);
    const route = ROUTES.find(r => r.hash === path);

    if (!route) {
      // Unknown route → redirect to default
      window.location.hash = DEFAULT_HASH;
      return;
    }

    // Destroy previous page
    if (this.currentDestroy) {
      try { this.currentDestroy(); } catch (e) { console.error('Error destroying page:', e); }
      this.currentDestroy = null;
    }

    // Clear container
    this.container.innerHTML = '';

    // Show loading
    this.container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

    // Dynamic import page module
    try {
      const module = await import(`./pages/${route.page}.js`);
      const cleanup = await module.mount(this.container, params);
      if (typeof cleanup === 'function') {
        this.currentDestroy = cleanup;
      }
      this.currentPageName = route.page;

      bus.dispatchEvent(new CustomEvent(EVENTS.PAGE_MOUNTED, {
        detail: { page: route.page, title: route.title }
      }));
    } catch (err) {
      console.error(`Failed to load page "${route.page}":`, err);
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">⚠️</div>
          <div class="empty-state__text">页面加载失败</div>
          <p style="color:var(--text-muted)">${err.message}</p>
        </div>`;
    }
  }
}
