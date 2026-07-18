/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Sidebar Component
   固定左侧导航 + 底部状态指示器 + 磁盘空间
   ═══════════════════════════════════════════════════ */

import { bus, EVENTS } from '../events.js';

const NAV_ITEMS = [
  { hash: '#/new-training', icon: '📊', label: '新建训练', page: 'new-training' },
  { hash: '#/history',      icon: '📂', label: '训练历史', page: 'training-history' },
  { hash: '#/inference',    icon: '🔍', label: '推理测试', page: 'inference' },
  { hash: '#/settings',     icon: '⚙️', label: '设置', page: 'settings' },
];

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.activeHash = null;
    this._build();
  }

  /* ── DOM Construction ── */

  _build() {
    this.container.innerHTML = '';

    // Brand
    const brand = this._el('div', 'sidebar__brand');
    brand.innerHTML = `<span class="sidebar__logo">🧠</span><span class="sidebar__title">YOLO Trainer</span>`;
    this.container.appendChild(brand);

    // Navigation
    this.nav = this._el('nav', 'sidebar__nav');
    NAV_ITEMS.forEach(item => {
      const a = this._el('a', 'sidebar__nav-item');
      a.href = item.hash;
      a.dataset.hash = item.hash;
      a.dataset.page = item.page;
      a.innerHTML = `<span class="sidebar__nav-icon">${item.icon}</span><span class="sidebar__nav-label">${item.label}</span>`;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        bus.dispatchEvent(new CustomEvent(EVENTS.NAVIGATE, {
          detail: { hash: item.hash }
        }));
      });
      this.nav.appendChild(a);
    });
    this.container.appendChild(this.nav);

    // Divider
    this.container.appendChild(this._el('hr', 'sidebar__divider'));

    // Status area
    this.statusArea = this._el('div', 'sidebar__status');
    this.statusArea.setAttribute('role', 'button');
    this.statusArea.setAttribute('tabindex', '0');
    this.statusDot = this._el('span', 'sidebar__status-dot status-dot--ready');
    this.statusText = this._el('span', 'sidebar__status-text');
    this.statusText.textContent = '环境就绪';
    this.statusArea.appendChild(this.statusDot);
    this.statusArea.appendChild(this.statusText);

    // Click on red status → navigate to settings
    this.statusArea.addEventListener('click', () => {
      if (this._currentStatus === 'error') {
        bus.dispatchEvent(new CustomEvent(EVENTS.NAVIGATE, {
          detail: { hash: '#/settings' }
        }));
      }
    });
    this.container.appendChild(this.statusArea);

    // Disk space
    this.diskArea = this._el('div', 'sidebar__disk');
    this.diskText = this._el('span', 'sidebar__disk-text');
    this.diskText.textContent = '存储: -- GB 可用';
    this.diskArea.appendChild(this.diskText);
    this.container.appendChild(this.diskArea);

    this._currentStatus = 'ready';
  }

  /* ── Public API ── */

  /**
   * Highlight the active nav item by hash.
   * @param {string} hash - e.g. "#/new-training"
   */
  setActive(hash) {
    this.activeHash = hash;
    const items = this.nav.querySelectorAll('.sidebar__nav-item');
    items.forEach(item => {
      const isActive = item.dataset.hash === hash;
      item.classList.toggle('sidebar__nav-item--active', isActive);
    });
  }

  /**
   * Highlight by page name instead of hash.
   * @param {string} pageName
   */
  setActiveByPage(pageName) {
    const item = this.nav.querySelector(`[data-page="${pageName}"]`);
    if (item) {
      this.setActive(item.dataset.hash);
    }
  }

  /**
   * Update the status indicator.
   * @param {'ready'|'training'|'error'} status
   * @param {string} [detail] - task name or error count
   */
  setStatus(status, detail = '') {
    this._currentStatus = status;
    this.statusDot.className = 'sidebar__status-dot';
    this.statusArea.classList.remove('sidebar__status--clickable');

    switch (status) {
      case 'ready':
        this.statusDot.classList.add('status-dot--ready');
        this.statusText.textContent = '环境就绪';
        break;
      case 'training':
        this.statusDot.classList.add('status-dot--training');
        this.statusText.textContent = detail ? `训练中: ${detail}` : '训练中';
        break;
      case 'error':
        this.statusDot.classList.add('status-dot--error');
        this.statusText.textContent = detail ? `${detail} 项环境异常` : '环境异常';
        this.statusArea.classList.add('sidebar__status--clickable');
        break;
    }
  }

  /**
   * Update disk space display.
   * @param {string} freeText - e.g. "234.5 GB"
   */
  setDiskSpace(freeText) {
    this.diskText.textContent = `存储: ${freeText} 可用`;
  }

  /* ── Helpers ── */

  _el(tag, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }
}
