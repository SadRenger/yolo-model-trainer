/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Hash Router (global namespace)
   页面注册表 (static lookup) + mount/destroy 生命周期
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;

  var ROUTES = [
    { hash: '#/new-training', page: 'newTraining', title: '新建训练任务' },
    { hash: '#/history',      page: 'trainingHistory', title: '训练历史' },
    { hash: '#/inference',    page: 'inference', title: '推理测试' },
    { hash: '#/settings',     page: 'settings', title: '设置' },
  ];
  var DEFAULT_HASH = '#/new-training';

  function parseHash(hash) {
    var parts = hash.split('?');
    var path = parts[0];
    var params = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function(pair) {
        var kv = pair.split('=');
        if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    return { path: path, params: params };
  }

  App.Router = function(container) {
    this.container = container;
    this.currentPageName = null;
    this.currentDestroy = null;
  };

  App.Router.prototype.init = function() {
    var self = this;

    window.addEventListener('hashchange', function() { self._handleRoute(); });

    App.bus.addEventListener(App.EVENTS.NAVIGATE, function(e) {
      self.navigate(e.detail.hash, e.detail.params);
    });

    if (!window.location.hash) {
      window.location.hash = DEFAULT_HASH;
    } else {
      this._handleRoute();
    }
  };

  App.Router.prototype.navigate = function(hash, params) {
    params = params || {};
    var parsed = parseHash(hash);
    var merged = Object.assign({}, parsed.params, params);
    var queryStr = Object.keys(merged).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(merged[k]);
    }).join('&');
    window.location.hash = queryStr ? parsed.path + '?' + queryStr : parsed.path;
  };

  App.Router.prototype.getCurrentRoute = function() {
    var parsed = parseHash(window.location.hash);
    return ROUTES.find(function(r) { return r.hash === parsed.path; }) || null;
  };

  App.Router.prototype.getParams = function() {
    return parseHash(window.location.hash).params;
  };

  App.Router.prototype._handleRoute = function() {
    var self = this;
    var parsed = parseHash(window.location.hash);
    var route = ROUTES.find(function(r) { return r.hash === parsed.path; });

    if (!route) {
      window.location.hash = DEFAULT_HASH;
      return;
    }

    // Destroy previous page
    if (this.currentDestroy) {
      try { this.currentDestroy(); } catch(e) { /* ignore */ }
      this.currentDestroy = null;
    }

    this.container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

    try {
      var module = App.pages[route.page];
      if (!module) throw new Error('Unknown page: ' + route.page);
      // Clear spinner before mount — pages appendChild, don't replace
      this.container.innerHTML = '';
      var cleanup = module.mount(this.container, parsed.params);
      if (typeof cleanup === 'function') this.currentDestroy = cleanup;
      this.currentPageName = route.page;

      App.bus.dispatchEvent(new CustomEvent(App.EVENTS.PAGE_MOUNTED, {
        detail: { page: route.page, title: route.title }
      }));
    } catch(err) {
      this.container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state__icon">⚠️</div>' +
          '<div class="empty-state__text">页面加载失败</div>' +
          '<p style="color:var(--text-muted)">' + err.message + '</p>' +
        '</div>';
    }
  };
})();
