/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Toast Notification System
   ═══════════════════════════════════════════════════ */

const TOAST_ICONS = {
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
};

const TOAST_DURATION = {
  success: 3000,
  info: 3000,
  warning: 5000,
  error: 5000,
};

const MAX_TOASTS = 5;

export class ToastContainer {
  constructor(container) {
    this.container = container;
  }

  /**
   * Show a toast notification.
   * @param {'success'|'warning'|'error'|'info'} type
   * @param {string} title
   * @param {string} [message]
   * @param {number} [duration] - ms, defaults to type-based duration
   */
  show(type, title, message = '', duration) {
    // Enforce max visible toasts
    const existing = this.container.querySelectorAll('.toast');
    if (existing.length >= MAX_TOASTS) {
      existing[0].remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    toast.innerHTML = `
      <span class="toast__icon">${TOAST_ICONS[type] || ''}</span>
      <div class="toast__body">
        <span class="toast__title">${title}</span>
        ${message ? `<span class="toast__message">${message}</span>` : ''}
      </div>
      <button class="toast__close" aria-label="关闭">&times;</button>
    `;

    // Close button
    toast.querySelector('.toast__close').addEventListener('click', () => {
      this._dismiss(toast);
    });

    // Auto-dismiss
    const dur = duration || TOAST_DURATION[type] || 3000;
    toast._timer = setTimeout(() => {
      this._dismiss(toast);
    }, dur);

    // Pause timer on hover
    toast.addEventListener('mouseenter', () => {
      if (toast._timer) { clearTimeout(toast._timer); toast._timer = null; }
    });
    toast.addEventListener('mouseleave', () => {
      if (!toast._timer) {
        toast._timer = setTimeout(() => this._dismiss(toast), dur);
      }
    });

    this.container.appendChild(toast);

    // Entrance animation
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });
  }

  /* ── Private ── */

  _dismiss(toast) {
    if (toast._dismissing) return;
    toast._dismissing = true;

    if (toast._timer) { clearTimeout(toast._timer); toast._timer = null; }

    toast.classList.remove('toast--visible');
    toast.classList.add('toast--hiding');

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 250);
  }
}

/**
 * Convenience: show a toast via the global bus.
 * Dispatch EVENTS.TOAST_SHOW with detail: { type, title, message, duration? }
 */
export function showToast(type, title, message, duration) {
  const { bus, EVENTS } = await import('../events.js'); // not needed — consumer should import
}
