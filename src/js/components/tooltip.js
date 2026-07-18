/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Tooltip Manager
   声明式: data-tooltip="text" 属性
   编程式: createTooltip(triggerElement, contentHTML)
   ═══════════════════════════════════════════════════ */

export class TooltipManager {
  constructor() {
    this.tooltip = null;
    this.currentTrigger = null;
    this._initDeclarative();
  }

  /* ── Declarative: data-tooltip attribute ── */

  _initDeclarative() {
    document.addEventListener('mouseenter', (e) => {
      const trigger = e.target.closest('[data-tooltip]');
      if (!trigger) return;
      const text = trigger.getAttribute('data-tooltip');
      if (text) {
        this.show(trigger, text);
      }
    }, true); // capturing to work with dynamically added elements

    document.addEventListener('mouseleave', (e) => {
      const trigger = e.target.closest('[data-tooltip]');
      if (!trigger) return;
      this.hide();
    }, true);
  }

  /* ── Programmatic API ── */

  /**
   * Show a tooltip near a trigger element.
   * @param {HTMLElement} trigger
   * @param {string} contentHTML
   */
  show(trigger, contentHTML) {
    // Don't re-create if same trigger
    if (this.currentTrigger === trigger && this.tooltip) return;

    this.hide();

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = contentHTML;
    document.body.appendChild(tooltip);

    // Position relative to trigger
    const rect = trigger.getBoundingClientRect();
    const ttRect = tooltip.getBoundingClientRect();

    let top = rect.bottom + 6;
    let left = rect.left + rect.width / 2 - ttRect.width / 2;

    // Flip if off-screen
    if (left < 8) left = 8;
    if (left + ttRect.width > window.innerWidth - 8) {
      left = window.innerWidth - ttRect.width - 8;
    }
    if (top + ttRect.height > window.innerHeight - 8) {
      top = rect.top - ttRect.height - 6; // show above
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Arrow
    const arrow = document.createElement('div');
    arrow.className = 'tooltip__arrow';
    const arrowLeft = rect.left + rect.width / 2 - left;
    arrow.style.left = `${Math.max(8, Math.min(arrowLeft, ttRect.width - 8))}px`;
    tooltip.appendChild(arrow);

    this.tooltip = tooltip;
    this.currentTrigger = trigger;

    // Show animation
    requestAnimationFrame(() => {
      tooltip.classList.add('tooltip--visible');
    });
  }

  /**
   * Hide the current tooltip.
   */
  hide() {
    if (this.tooltip) {
      this.tooltip.classList.remove('tooltip--visible');
      const tt = this.tooltip;
      setTimeout(() => {
        if (tt.parentNode) tt.remove();
      }, 150);
      this.tooltip = null;
    }
    this.currentTrigger = null;
  }
}
