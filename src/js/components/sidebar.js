/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Sidebar Component (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  App.components = App.components || {};

  var NAV_ITEMS = [
    { hash: '#/new-training', icon: '📊', label: '新建训练', page: 'new-training' },
    { hash: '#/history',      icon: '📂', label: '训练历史', page: 'training-history' },
    { hash: '#/inference',    icon: '🔍', label: '推理测试', page: 'inference' },
    { hash: '#/settings',     icon: '⚙️', label: '设置', page: 'settings' },
  ];

  App.components.Sidebar = function(container) {
    this.container = container;
    this.activeHash = null;
    this._currentStatus = 'ready';
    this._build();
  };

  App.components.Sidebar.prototype._el = function(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  };

  App.components.Sidebar.prototype._build = function() {
    var self = this;
    this.container.innerHTML = '';

    var brand = this._el('div', 'sidebar__brand');
    brand.innerHTML = '<span class="sidebar__logo">🧠</span><span class="sidebar__title">YOLO Trainer</span>';
    this.container.appendChild(brand);

    this.nav = this._el('nav', 'sidebar__nav');
    NAV_ITEMS.forEach(function(item) {
      var a = self._el('a', 'sidebar__nav-item');
      a.href = item.hash;
      a.dataset.hash = item.hash;
      a.dataset.page = item.page;
      a.innerHTML = '<span class="sidebar__nav-icon">' + item.icon + '</span><span class="sidebar__nav-label">' + item.label + '</span>';
      a.addEventListener('click', function(e) {
        e.preventDefault();
        self.setActive(item.hash); // immediate UI response
        App.bus.dispatchEvent(new CustomEvent(App.EVENTS.NAVIGATE, { detail: { hash: item.hash } }));
      });
      self.nav.appendChild(a);
    });
    this.container.appendChild(this.nav);

    this.container.appendChild(this._el('hr', 'sidebar__divider'));

    this.statusArea = this._el('div', 'sidebar__status');
    this.statusArea.setAttribute('role', 'button');
    this.statusArea.setAttribute('tabindex', '0');
    this.statusDot = this._el('span', 'sidebar__status-dot status-dot--ready');
    this.statusText = this._el('span', 'sidebar__status-text');
    this.statusText.textContent = '环境就绪';
    this.statusArea.appendChild(this.statusDot);
    this.statusArea.appendChild(this.statusText);

    this.statusArea.addEventListener('click', function() {
      if (self._currentStatus === 'error') {
        App.bus.dispatchEvent(new CustomEvent(App.EVENTS.NAVIGATE, { detail: { hash: '#/settings' } }));
      }
    });
    this.container.appendChild(this.statusArea);

    this.diskArea = this._el('div', 'sidebar__disk');
    this.diskText = this._el('span', 'sidebar__disk-text');
    this.diskText.textContent = '存储: -- GB 可用';
    this.diskArea.appendChild(this.diskText);
    this.container.appendChild(this.diskArea);

    // ── Training progress: update first nav item dynamically ──
    var firstNavItem = this.nav.querySelector('.sidebar__nav-item');
    if (firstNavItem) {
      // Store original label for restoration
      var originalLabel = firstNavItem.querySelector('.sidebar__nav-label');
      var defaultText = originalLabel ? originalLabel.textContent : '新建训练';

      App.bus.addEventListener(App.EVENTS.TRAINING_PROGRESS, function(e) {
        var pct = e.detail.pct || 0;
        if (originalLabel) {
          originalLabel.textContent = '训练中 · ' + pct + '%';
        }
      });

      App.bus.addEventListener(App.EVENTS.SIDEBAR_STATUS, function(e) {
        if (e.detail.status === 'training') {
          var cur = originalLabel ? originalLabel.textContent : '';
          if (!cur || cur === defaultText) {
            if (originalLabel) originalLabel.textContent = '训练中…';
          }
        } else if (e.detail.status === 'completed') {
          if (originalLabel) originalLabel.textContent = '🎉 训练完成';
        } else if (e.detail.status === 'ready' || e.detail.status === 'error') {
          if (originalLabel) originalLabel.textContent = defaultText;
        }
      });
    }
  };

  App.components.Sidebar.prototype.setActive = function(hash) {
    this.activeHash = hash;
    var items = this.nav.querySelectorAll('.sidebar__nav-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('sidebar__nav-item--active', items[i].dataset.hash === hash);
    }
  };

  App.components.Sidebar.prototype.setActiveByPage = function(pageName) {
    var item = this.nav.querySelector('[data-page="' + pageName + '"]');
    if (item) this.setActive(item.dataset.hash);
  };

  App.components.Sidebar.prototype.setStatus = function(status, detail) {
    this._currentStatus = status;
    this.statusDot.className = 'sidebar__status-dot';
    this.statusArea.classList.remove('sidebar__status--clickable');
    detail = detail || '';

    switch (status) {
      case 'ready':
        this.statusDot.classList.add('status-dot--ready');
        this.statusText.textContent = '环境就绪';
        break;
      case 'training':
        this.statusDot.classList.add('status-dot--training');
        this.statusText.textContent = detail ? '训练中: ' + detail : '训练中';
        break;
      case 'error':
        this.statusDot.classList.add('status-dot--error');
        this.statusText.textContent = detail ? detail + ' 项环境异常' : '环境异常';
        this.statusArea.classList.add('sidebar__status--clickable');
        break;
    }
  };

  App.components.Sidebar.prototype.setDiskSpace = function(freeText) {
    this.diskText.textContent = '存储: ' + freeText + ' 可用';
  };
})();
