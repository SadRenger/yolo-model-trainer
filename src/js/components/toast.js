/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Toast Notification (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  App.components = App.components || {};

  var TOAST_ICONS = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
  var TOAST_DURATION = { success: 3000, info: 3000, warning: 5000, error: 5000 };
  var MAX_TOASTS = 5;

  App.components.ToastContainer = function(container) {
    this.container = container;
  };

  App.components.ToastContainer.prototype.show = function(type, title, message, duration) {
    var self = this;
    var existing = this.container.querySelectorAll('.toast');
    if (existing.length >= MAX_TOASTS) existing[0].remove();

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.innerHTML =
      '<span class="toast__icon">' + (TOAST_ICONS[type] || '') + '</span>' +
      '<div class="toast__body">' +
        '<span class="toast__title">' + title + '</span>' +
        (message ? '<span class="toast__message">' + message + '</span>' : '') +
      '</div>' +
      '<button class="toast__close" aria-label="关闭">&times;</button>';

    toast.querySelector('.toast__close').addEventListener('click', function() {
      self._dismiss(toast);
    });

    var dur = duration || TOAST_DURATION[type] || 3000;
    toast._timer = setTimeout(function() { self._dismiss(toast); }, dur);

    toast.addEventListener('mouseenter', function() {
      if (toast._timer) { clearTimeout(toast._timer); toast._timer = null; }
    });
    toast.addEventListener('mouseleave', function() {
      if (!toast._timer) toast._timer = setTimeout(function() { self._dismiss(toast); }, dur);
    });

    this.container.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('toast--visible'); });
  };

  App.components.ToastContainer.prototype._dismiss = function(toast) {
    if (toast._dismissing) return;
    toast._dismissing = true;
    if (toast._timer) { clearTimeout(toast._timer); toast._timer = null; }
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--hiding');
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 250);
  };
})();
