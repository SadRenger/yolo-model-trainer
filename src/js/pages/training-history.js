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
      '<table class="data-table" id="history-table"><thead><tr><th style="width:32px"><input type="checkbox" /></th><th>任务名称</th><th>日期</th><th>状态</th><th>mAP50</th><th>操作</th></tr></thead><tbody>' +
      tasks.map(function(t) {
        var badge = { completed: '<span class="tag tag--success">✅ 已完成</span>', stopped: '<span class="tag tag--warning">⏸ 已停止</span>', error: '<span class="tag tag--error">❌ 异常中断</span>' }[t.status] || t.status;
        var mAP = typeof t.mAP50 === 'number' ? t.mAP50.toFixed(3) : (t.mAP50 || '--');
        var actions = '<button class="btn btn--ghost btn--sm btn-report" data-id="' + t.id + '" data-output="' + (t.output_dir || '') + '" title="查看报告">📄</button>' +
                      '<button class="btn btn--ghost btn--sm btn-download" data-id="' + t.id + '" data-output="' + (t.output_dir || '') + '" title="下载模型">📥</button>';
        if (t.status === 'stopped' || t.status === 'error') {
          actions += '<button class="btn btn--ghost btn--sm btn-resume" data-id="' + t.id + '" title="断点续训" style="color:var(--color-primary)">🔄</button>';
        }
        actions += '<button class="btn btn--ghost btn--sm btn-delete" data-id="' + t.id + '" title="删除">🗑</button>';
        return '<tr><td><input type="checkbox" /></td><td>' + t.name + '</td><td style="color:var(--text-secondary)">' + t.date + '</td><td>' + badge + '</td><td style="color:var(--color-purple);font-weight:600">' + mAP + '</td><td>' + actions + '</td></tr>';
      }).join('') +
      '</tbody></table>';
    view.appendChild(tableWrapper);

    // ── Wire action buttons via event delegation ──
    tableWrapper.addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var taskId = btn.dataset.id;
      var outputDir = btn.dataset.output;
      var hasTauri = !!(window.__TAURI_INTERNALS__ && App.tauri);
      if (!hasTauri) return;

      if (btn.classList.contains('btn-report')) {
        // Open training report in browser
        App.tauri.invoke('open_report', { outputDir: outputDir }).catch(function(err) {
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
            detail: { type: 'error', title: '打开报告失败', message: String(err) }
          }));
        });
      } else if (btn.classList.contains('btn-download')) {
        // Download best.pt
        var srcPath = (outputDir || '') + '/weights/best.pt';
        App.tauri.invoke('save_file_dialog', { defaultName: 'best.pt' }).then(function(savePath) {
          if (!savePath) throw new Error('CANCELLED');
          return App.tauri.invoke('copy_file', { src: srcPath, dst: savePath });
        }).then(function() {
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
            detail: { type: 'success', title: '下载完成', message: '模型已保存' }
          }));
        }).catch(function(err) {
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
            detail: { type: 'error', title: '下载失败', message: String(err) }
          }));
        });
      } else if (btn.classList.contains('btn-delete')) {
        // Delete task
        App._modalManager.show({
          title: '确认删除',
          body: '删除后训练记录和模型文件将被永久移除，不可恢复。',
          icon: '⚠️',
          primaryLabel: '确认删除',
          primaryClass: 'btn--danger',
          secondaryLabel: '取消',
        }).then(function(confirmed) {
          if (!confirmed) return;
          App.tauri.invoke('delete_task', { taskId: taskId }).then(function() {
            // Refresh the page
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.NAVIGATE, { detail: { hash: '#/history' } }));
          }).catch(function(err) {
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
              detail: { type: 'error', title: '删除失败', message: String(err) }
            }));
          });
        });
      } else if (btn.classList.contains('btn-resume')) {
        // Navigate to new training with resume params
        App.bus.dispatchEvent(new CustomEvent(App.EVENTS.NAVIGATE, {
          detail: { hash: '#/new-training', params: { resume: taskId } }
        }));
      }
    });

    var footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:16px';
    footer.innerHTML = '<span style="font-size:var(--fs-caption);color:var(--text-muted)">共 ' + tasks.length + ' 条记录</span><button class="btn btn--ghost btn--sm" style="color:var(--color-danger)">🗑 删除选中</button>';
    view.appendChild(footer);

    return view;
  }
})();
