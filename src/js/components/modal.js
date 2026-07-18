/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Modal Manager
   单例，管理遮罩 + 模态框堆栈
   show() 返回 Promise<boolean>（true=主按钮, false=次按钮/关闭）
   ═══════════════════════════════════════════════════ */

import { bus, EVENTS } from '../events.js';

export class ModalManager {
  constructor(root) {
    this.root = root;
    this.currentModal = null;
    this._setupOverlay();
  }

  _setupOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.addEventListener('click', (e) => {
      // Close on backdrop click
      if (e.target === this.overlay && this._options && this._options.closeOnBackdrop !== false) {
        this._resolve(false);
        this._close();
      }
    });
    this.root.appendChild(this.overlay);
  }

  /**
   * Show a modal dialog.
   *
   * @param {{
   *   title: string,
   *   body: string,
   *   icon?: string,
   *   primaryLabel?: string,
   *   primaryClass?: string,      // 'btn--primary' | 'btn--danger' (default: 'btn--primary')
   *   secondaryLabel?: string,
   *   width?: number,             // px, default 480
   *   closeOnBackdrop?: boolean,  // default true
   *   onPrimary?: () => void,
   *   onSecondary?: () => void,
   * }} options
   * @returns {Promise<boolean>} resolves true for primary, false for secondary/close
   */
  show(options) {
    // Close any existing modal first
    if (this.currentModal) {
      this._resolve(false);
      this._close();
    }

    this._options = options;

    const {
      title = '',
      body = '',
      icon = '',
      primaryLabel = '确认',
      primaryClass = 'btn--primary',
      secondaryLabel = '取消',
      width = 480,
    } = options;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = `${width}px`;

    modal.innerHTML = `
      <div class="modal__header">
        ${icon ? `<span class="modal__icon">${icon}</span>` : ''}
        <h2 class="modal__title">${title}</h2>
        <button class="modal__close-btn btn--icon" aria-label="关闭">&times;</button>
      </div>
      <div class="modal__body">${body}</div>
      <div class="modal__footer">
        ${secondaryLabel ? `<button class="btn btn--ghost modal__btn-secondary">${secondaryLabel}</button>` : ''}
        <button class="btn ${primaryClass} modal__btn-primary">${primaryLabel}</button>
      </div>
    `;

    // Wire close button
    modal.querySelector('.modal__close-btn').addEventListener('click', () => {
      this._resolve(false);
      this._close();
    });

    // Wire buttons
    const primaryBtn = modal.querySelector('.modal__btn-primary');
    const secondaryBtn = modal.querySelector('.modal__btn-secondary');

    if (primaryBtn) {
      primaryBtn.addEventListener('click', () => {
        if (options.onPrimary) options.onPrimary();
        this._resolve(true);
        this._close();
      });
    }

    if (secondaryBtn) {
      secondaryBtn.addEventListener('click', () => {
        if (options.onSecondary) options.onSecondary();
        this._resolve(false);
        this._close();
      });
    }

    // Escape key
    this._keyHandler = (e) => {
      if (e.key === 'Escape') {
        this._resolve(false);
        this._close();
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    // Mount
    this.overlay.appendChild(modal);
    this.overlay.classList.add('active');
    this.root.classList.add('active');
    this.currentModal = modal;

    // Focus trap
    if (primaryBtn) primaryBtn.focus();

    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  _close() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }

    if (this.currentModal) {
      this.currentModal.classList.add('modal--hiding');
      setTimeout(() => {
        if (this.currentModal && this.currentModal.parentNode) {
          this.currentModal.remove();
        }
        this.currentModal = null;
        this._options = null;
      }, 200);
    }

    this.overlay.classList.remove('active');
    this.root.classList.remove('active');

    bus.dispatchEvent(new CustomEvent(EVENTS.MODAL_CLOSE));
  }
}
