/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Tooltip Manager (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  App.components = App.components || {};

  App.components.TooltipManager = function() {
    this.tooltip = null;
    this.currentTrigger = null;
    this._initDeclarative();
  };

  App.components.TooltipManager.prototype._initDeclarative = function() {
    var self = this;
    document.addEventListener('mouseenter', function(e) {
      var trigger = e.target.closest('[data-tooltip]');
      if (!trigger) return;
      var text = trigger.getAttribute('data-tooltip');
      if (text) self.show(trigger, text);
    }, true);

    document.addEventListener('mouseleave', function(e) {
      var trigger = e.target.closest('[data-tooltip]');
      if (!trigger) return;
      self.hide();
    }, true);
  };

  App.components.TooltipManager.prototype.show = function(trigger, contentHTML) {
    if (this.currentTrigger === trigger && this.tooltip) return;
    this.hide();

    var tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = contentHTML;
    document.body.appendChild(tooltip);

    var rect = trigger.getBoundingClientRect();
    var ttRect = tooltip.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = rect.left + rect.width / 2 - ttRect.width / 2;
    if (left < 8) left = 8;
    if (left + ttRect.width > window.innerWidth - 8) left = window.innerWidth - ttRect.width - 8;
    if (top + ttRect.height > window.innerHeight - 8) top = rect.top - ttRect.height - 6;

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';

    var arrow = document.createElement('div');
    arrow.className = 'tooltip__arrow';
    var arrowLeft = rect.left + rect.width / 2 - left;
    arrow.style.left = Math.max(8, Math.min(arrowLeft, ttRect.width - 8)) + 'px';
    tooltip.appendChild(arrow);

    this.tooltip = tooltip;
    this.currentTrigger = trigger;
    var self = this;
    requestAnimationFrame(function() { tooltip.classList.add('tooltip--visible'); });
  };

  App.components.TooltipManager.prototype.hide = function() {
    if (this.tooltip) {
      this.tooltip.classList.remove('tooltip--visible');
      var tt = this.tooltip;
      setTimeout(function() { if (tt.parentNode) tt.remove(); }, 150);
      this.tooltip = null;
    }
    this.currentTrigger = null;
  };
})();
