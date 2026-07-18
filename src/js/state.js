/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Observable State Store
   ═══════════════════════════════════════════════════ */

import { bus, EVENTS } from './events.js';

/**
 * Creates a simple observable state store.
 * set() → dispatches STATE_CHANGED on the shared bus.
 * subscribe() → listen for changes to a specific key.
 */
export function createStore(initialState = {}) {
  /** @type {Record<string, any>} */
  let state = { ...initialState };

  const store = {
    /**
     * Get a top-level key's value.
     * @param {string} key
     * @returns {any}
     */
    get(key) {
      return state[key];
    },

    /**
     * Set a top-level key and dispatch STATE_CHANGED.
     * Does nothing if value is identical (===).
     * @param {string} key
     * @param {any} value
     */
    set(key, value) {
      if (state[key] === value) return;
      state[key] = value;
      bus.dispatchEvent(new CustomEvent(EVENTS.STATE_CHANGED, {
        detail: { key, value }
      }));
    },

    /**
     * Subscribe to changes on a specific key.
     * @param {string} key
     * @param {(value: any) => void} callback
     * @returns {() => void} unsubscribe function
     */
    subscribe(key, callback) {
      const handler = (e) => {
        if (e.detail.key === key) {
          callback(e.detail.value);
        }
      };
      bus.addEventListener(EVENTS.STATE_CHANGED, handler);
      return () => bus.removeEventListener(EVENTS.STATE_CHANGED, handler);
    },

    /**
     * Return a snapshot of the full state (shallow copy).
     * @returns {Record<string, any>}
     */
    getAll() {
      return { ...state };
    }
  };

  return store;
}
