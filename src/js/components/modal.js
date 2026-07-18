/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Modal Manager (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  App.components = App.components || {};

  App.components.ModalManager = function(root) {
    this.root = root;
    this.currentModal = null;
    this._options = null;
    this._resolve = null;
    this._keyHandler = null;
    this._setupOverlay();
  };

  App.components.ModalManager.prototype._setupOverlay = function() {
    var self = this;
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.addEventListener('click', function(e) {
      if (e.target === self.overlay && self._options && self._options.closeOnBackdrop !== false) {
        self._resolve(false);
        self._close();
      }
    });
    this.root.appendChild(this.overlay);
  };

  App.components.ModalManager.prototype.show = function(options) {
    var self = this;
    if (this.currentModal) { this._resolve(false); this._close(); }
    this._options = options;

    var title = options.title || '';
    var body = options.body || '';
    var icon = options.icon || '';
    var primaryLabel = options.primaryLabel || '确认';
    var primaryClass = options.primaryClass || 'btn--primary';
    var secondaryLabel = options.secondaryLabel || '取消';
    var width = options.width || 480;

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = width + 'px';
    modal.innerHTML =
      '<div class="modal__header">' +
        (icon ? '<span class="modal__icon">' + icon + '</span>' : '') +
        '<h2 class="modal__title">' + title + '</h2>' +
        '<button class="modal__close-btn btn--icon" aria-label="关闭">&times;</button>' +
      '</div>' +
      '<div class="modal__body">' + body + '</div>' +
      '<div class="modal__footer">' +
        (secondaryLabel ? '<button class="btn btn--ghost modal__btn-secondary">' + secondaryLabel + '</button>' : '') +
        '<button class="btn ' + primaryClass + ' modal__btn-primary">' + primaryLabel + '</button>' +
      '</div>';

    modal.querySelector('.modal__close-btn').addEventListener('click', function() {
      self._resolve(false); self._close();
    });

    var primaryBtn = modal.querySelector('.modal__btn-primary');
    var secondaryBtn = modal.querySelector('.modal__btn-secondary');
    if (primaryBtn) {
      primaryBtn.addEventListener('click', function() {
        if (options.onPrimary) options.onPrimary();
        self._resolve(true); self._close();
      });
    }
    if (secondaryBtn) {
      secondaryBtn.addEventListener('click', function() {
        if (options.onSecondary) options.onSecondary();
        self._resolve(false); self._close();
      });
    }

    this._keyHandler = function(e) {
      if (e.key === 'Escape') { self._resolve(false); self._close(); }
    };
    document.addEventListener('keydown', this._keyHandler);

    this.overlay.appendChild(modal);
    this.overlay.classList.add('active');
    this.root.classList.add('active');
    this.currentModal = modal;
    if (primaryBtn) primaryBtn.focus();

    return new Promise(function(resolve) { self._resolve = resolve; });
  };

  App.components.ModalManager.prototype._close = function() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this.currentModal) {
      this.currentModal.classList.add('modal--hiding');
      var cm = this.currentModal;
      setTimeout(function() { if (cm.parentNode) cm.remove(); }, 200);
      this.currentModal = null;
      this._options = null;
    }
    this.overlay.classList.remove('active');
    this.root.classList.remove('active');
    App.bus.dispatchEvent(new CustomEvent(App.EVENTS.MODAL_CLOSE));
  };
})();
