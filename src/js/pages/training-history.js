/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Page: Training History (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  App.pages = App.pages || {};

  App.pages.trainingHistory = {
    mount: function(container, params) {
      params = params || {};
      var page = document.createElement('div');
      page.className = 'page page-training-history';

      var title = document.createElement('h1');
      title.className = 'page-title';
      title.textContent = '训练历史';
      page.appendChild(title);

      App.api.getTaskHistory().then(function(tasks) {
        if (tasks.length === 0) {
          page.appendChild(buildEmptyState());
        } else {
          page.appendChild(buildPopulatedView(tasks));
        }
        // Re-wire resume buttons
        page.querySelectorAll('.btn-resume').forEach(function(btn) {
          btn.addEventListener('click', function() {
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.NAVIGATE, {
              detail: { hash: '#/new-training', params: { resume: btn.dataset.taskId } }
            }));
          });
        });
      });

      container.appendChild(page);
      return function() { page.remove(); };
    }
  };

  function buildEmptyState() {
    var div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = '<div class="empty-state__icon">📭</div><div class="empty-state__text">还没有训练记录</div><a class="btn btn--primary" href="#/new-training">📊 去新建训练 →</a>';
    return div;
  }

  function buildPopulatedView(tasks) {
    var view = document.createElement('div');

    var filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    filterBar.innerHTML =
      '<div class="form-group" style="flex:1;min-width:180px"><input type="text" class="form-input" placeholder="🔍 搜索任务…" /></div>' +
      '<select class="form-select" style="width:auto"><option>全部状态 ▾</option><option>已完成</option><option>已停止</option><option>异常中断</option></select>' +
      '<select class="form-select" style="width:auto"><option>按时间 ▾</option><option>按名称</option></select>';
    view.appendChild(filterBar);

    var tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    tableWrapper.innerHTML =
      '<table class="data-table"><thead><tr><th style="width:32px"><input type="checkbox" /></th><th>任务名称</th><th>日期</th><th>状态</th><th>mAP50</th><th>操作</th></tr></thead><tbody>' +
      tasks.map(function(t) {
        var badge = { completed: '<span class="tag tag--success">✅ 已完成</span>', stopped: '<span class="tag tag--warning">⏸ 已停止</span>', error: '<span class="tag tag--error">❌ 异常中断</span>' }[t.status] || t.status;
        var actions = '<button class="btn btn--ghost btn--sm" title="查看报告">📄</button><button class="btn btn--ghost btn--sm" title="下载模型">📥</button>';
        if (t.status === 'stopped' || t.status === 'error') {
          actions += '<button class="btn btn--ghost btn--sm btn-resume" data-task-id="' + t.id + '" title="断点续训" style="color:var(--color-primary)">🔄</button>';
        }
        actions += '<button class="btn btn--ghost btn--sm" title="删除">🗑</button>';
        return '<tr><td><input type="checkbox" /></td><td>' + t.name + '</td><td style="color:var(--text-secondary)">' + t.date + '</td><td>' + badge + '</td><td style="color:var(--color-purple);font-weight:var(--fw-heading)">' + t.mAP50 + '</td><td>' + actions + '</td></tr>';
      }).join('') +
      '</tbody></table>';
    view.appendChild(tableWrapper);

    var footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:16px';
    footer.innerHTML = '<span style="font-size:var(--fs-caption);color:var(--text-muted)">共 ' + tasks.length + ' 条记录</span><button class="btn btn--ghost btn--sm" style="color:var(--color-danger)">🗑 删除选中</button>';
    view.appendChild(footer);

    return view;
  }
})();
