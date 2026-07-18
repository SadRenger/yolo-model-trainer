/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Collapsible Section
   ▶ / ▼ toggle with CSS max-height transition
   ═══════════════════════════════════════════════════ */

/**
 * Create a collapsible section inside a given container.
 *
 * @param {{
 *   container: HTMLElement,
 *   title: string,
 *   subtitle?: string,
 *   defaultOpen?: boolean,
 *   content: HTMLElement | string,
 * }} options
 * @returns {{ toggle: () => void, open: () => void, close: () => void, element: HTMLElement }}
 */
export function createCollapsible(options) {
  const {
    container,
    title,
    subtitle = '',
    defaultOpen = false,
    content,
  } = options;

  const wrapper = document.createElement('div');
  wrapper.className = 'collapsible' + (defaultOpen ? ' collapsible--open' : '');

  // Header
  const header = document.createElement('div');
  header.className = 'collapsible__header';

  const toggle = document.createElement('span');
  toggle.className = 'collapsible__toggle';
  toggle.textContent = defaultOpen ? '▼' : '▶';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'collapsible__title';
  titleSpan.textContent = title;

  header.appendChild(toggle);
  header.appendChild(titleSpan);

  if (subtitle) {
    const subtitleSpan = document.createElement('span');
    subtitleSpan.className = 'collapsible__subtitle';
    subtitleSpan.textContent = subtitle;
    header.appendChild(subtitleSpan);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'collapsible__body';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'collapsible__content';
  if (typeof content === 'string') {
    contentDiv.innerHTML = content;
  } else {
    contentDiv.appendChild(content);
  }
  body.appendChild(contentDiv);

  wrapper.appendChild(header);
  wrapper.appendChild(body);

  // Toggle on click
  const toggleFn = () => {
    const isOpen = wrapper.classList.toggle('collapsible--open');
    toggle.textContent = isOpen ? '▼' : '▶';
  };

  header.addEventListener('click', toggleFn);

  // Append
  container.appendChild(wrapper);

  return {
    element: wrapper,
    toggle: toggleFn,
    open() {
      wrapper.classList.add('collapsible--open');
      toggle.textContent = '▼';
    },
    close() {
      wrapper.classList.remove('collapsible--open');
      toggle.textContent = '▶';
    },
  };
}
