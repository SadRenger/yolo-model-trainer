/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Collapsible Section (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  App.components = App.components || {};

  App.components.createCollapsible = function(options) {
    var container = options.container;
    var title = options.title;
    var subtitle = options.subtitle || '';
    var defaultOpen = options.defaultOpen || false;
    var content = options.content;

    var wrapper = document.createElement('div');
    wrapper.className = 'collapsible' + (defaultOpen ? ' collapsible--open' : '');

    var header = document.createElement('div');
    header.className = 'collapsible__header';

    var toggle = document.createElement('span');
    toggle.className = 'collapsible__toggle';
    toggle.textContent = defaultOpen ? '▼' : '▶';

    var titleSpan = document.createElement('span');
    titleSpan.className = 'collapsible__title';
    titleSpan.textContent = title;

    header.appendChild(toggle);
    header.appendChild(titleSpan);

    if (subtitle) {
      var subtitleSpan = document.createElement('span');
      subtitleSpan.className = 'collapsible__subtitle';
      subtitleSpan.textContent = subtitle;
      header.appendChild(subtitleSpan);
    }

    var body = document.createElement('div');
    body.className = 'collapsible__body';
    var contentDiv = document.createElement('div');
    contentDiv.className = 'collapsible__content';
    if (typeof content === 'string') {
      contentDiv.innerHTML = content;
    } else {
      contentDiv.appendChild(content);
    }
    body.appendChild(contentDiv);

    wrapper.appendChild(header);
    wrapper.appendChild(body);

    var toggleFn = function() {
      var isOpen = wrapper.classList.toggle('collapsible--open');
      toggle.textContent = isOpen ? '▼' : '▶';
    };
    header.addEventListener('click', toggleFn);
    container.appendChild(wrapper);

    return {
      element: wrapper,
      toggle: toggleFn,
      open: function() { wrapper.classList.add('collapsible--open'); toggle.textContent = '▼'; },
      close: function() { wrapper.classList.remove('collapsible--open'); toggle.textContent = '▶'; }
    };
  };
})();
