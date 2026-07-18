/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Events
   事件总线 + 事件名常量
   ═══════════════════════════════════════════════════ */

/** Shared event bus — all cross-module communication goes through this */
export const bus = new EventTarget();

/** Event name constants — import these, don't hardcode strings */
export const EVENTS = {
  NAVIGATE:        'app:navigate',        // { hash: string, params?: object }
  PAGE_MOUNTED:    'app:page-mounted',     // { page: string }
  STATE_CHANGED:   'app:state-changed',    // { key: string, value: any }
  TOAST_SHOW:      'ui:toast-show',        // { type, title, message, duration? }
  MODAL_OPEN:      'ui:modal-open',        // ModalOptions object
  MODAL_CLOSE:     'ui:modal-close',        // void
  SIDEBAR_STATUS:  'ui:sidebar-status',    // { status, detail? }
  TRAINING_START:   'training:start',       // { config }
  TRAINING_PROGRESS:'training:progress',    // { epoch, totalEpochs, loss, ... }
  TRAINING_COMPLETE:'training:complete',    // { results }
  TRAINING_ERROR:   'training:error',       // { error }
};
