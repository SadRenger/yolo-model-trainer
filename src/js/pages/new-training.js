/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Page: New Training (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  App.pages = App.pages || {};

  // Cache form + training state across page switches
  var _formCache = {
    taskName: '',
    datasetPath: '',
    modelPath: '',
  };
  var _trainingCache = {
    state: 'form',        // 'form' | 'training' | 'complete'
    epoch: 0,
    totalEpochs: 100,
    metrics: [],          // [{epoch, loss, mAP50, mAP50_95}]
    logs: [],             // [{time, text}]
    intervalId: null,     // mock interval reference
  };

  App.pages.newTraining = {
    mount: function(container, params) {
      params = params || {};
      var page = document.createElement('div');
      page.className = 'page page-new-training';
      var isResume = !!params.resume;

      var title = document.createElement('h1');
      title.className = 'page-title';
      title.textContent = isResume ? '新建训练 (续训)' : '新建训练任务';
      page.appendChild(title);

      if (isResume) {
        var banner = document.createElement('div');
        banner.className = 'card page-section';
        banner.style.cssText = 'padding:12px 16px;display:flex;align-items:center;gap:8px;font-size:var(--fs-caption);color:var(--color-primary);';
        banner.innerHTML = 'ℹ️ 将从历史任务 <strong>' + params.resume + '</strong> 恢复配置并重新训练';
        page.appendChild(banner);
      }

      var formView = buildFormView(isResume);
      page.appendChild(formView);

      var trainingView = buildTrainingView();
      trainingView.style.display = 'none';
      page.appendChild(trainingView);

      var completeView = buildCompleteView();
      completeView.style.display = 'none';
      page.appendChild(completeView);

      // ── Train:line event listener (persistent, for real Tauri training) ──
      var _trainUnlistens = [];
      function listenTrainEvents() {
        if (!window.__TAURI_INTERNALS__ || !App.tauri) return;
        App.tauri.listen('train:line', function(event) {
          var payload = event.payload;
          if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch(_) {} }
          if (!payload) return;

          var ptype = payload.type;
          if (ptype === 'started') {
            // Training confirmed started
          } else if (ptype === 'progress') {
            updateTrainingMetrics(trainingView, payload.epoch, payload.total_epochs);
          } else if (ptype === 'completed') {
            showCompleteState(page, formView, trainingView, completeView);
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'ready' } }));
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
              detail: { type: 'success', title: '训练完成！', message: 'mAP50: ' + (payload.best_mAP50 || '--') + ' · 历时 ' + Math.round((payload.total_time || 0) / 60) + 'm' }
            }));
          } else if (ptype === 'stopped') {
            resetToForm(page, formView, trainingView, completeView);
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'ready' } }));
          } else if (ptype === 'error') {
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
              detail: { type: 'error', title: '训练异常', message: payload.message || '未知错误' }
            }));
          }
        }).then(function(fn) { _trainUnlistens.push(fn); });
      }
      listenTrainEvents();

      // ── Wire start training (real Tauri or mock fallback) ──
      formView.querySelector('#btn-start-training').addEventListener('click', function() {
        showTrainingState(page, formView, trainingView);

        var hasTauri = !!(window.__TAURI_INTERNALS__ && App.tauri);
        if (hasTauri) {
          // Real training via Rust → Python
          var config = readFormConfig(formView);
          App.api.startTraining(config).then(function(result) {
            // Training spawned — progress will come via train:line events
          }).catch(function(err) {
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
              detail: { type: 'error', title: '启动训练失败', message: err.message || String(err) }
            }));
            resetToForm(page, formView, trainingView, completeView);
          });
        } else {
          // Mock fallback (no Tauri — browser dev or standalone)
          restartProgressInterval(trainingView, 0);
        }
      });

      // ── Stop button ──
      trainingView.querySelector('#btn-stop-training').addEventListener('click', function() {
        var modalMgr = App._modalManager;
        if (!modalMgr) return;
        modalMgr.show({
          title: '确认停止训练',
          body: '确定要停止训练吗？\n已产出的模型文件（best.pt / last.pt）会自动保留，可通过训练历史的断点续训功能恢复。',
          icon: '⚠️',
          primaryLabel: '确认停止',
          primaryClass: 'btn--danger',
          secondaryLabel: '继续训练',
        }).then(function(confirmed) {
          if (confirmed) {
            if (_trainingCache.intervalId) { clearInterval(_trainingCache.intervalId); _trainingCache.intervalId = null; }
            // Real stop via Rust if available
            var hasTauri = !!(window.__TAURI_INTERNALS__ && App.tauri);
            if (hasTauri) {
              App.tauri.invoke('stop_training', { taskId: 'train-current' }).catch(function(){});
            }
            resetToForm(page, formView, trainingView, completeView);
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'ready' } }));
          }
        });
      });

      // Simulate complete (dev only)
      var simBtn = formView.querySelector('#btn-sim-complete');
      if (simBtn) {
        simBtn.addEventListener('click', function() {
          showCompleteState(page, formView, trainingView, completeView);
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'ready' } }));
        });
      }

      // Retrain
      completeView.querySelector('#btn-retrain').addEventListener('click', function() {
        resetToForm(page, formView, trainingView, completeView);
      });

      // Go to inference
      completeView.querySelector('#btn-goto-inference').addEventListener('click', function() {
        App.bus.dispatchEvent(new CustomEvent(App.EVENTS.NAVIGATE, {
          detail: { hash: '#/inference', params: { model: 'best.pt' } }
        }));
      });

      // Dual validation locks — both must pass to enable Start Training
      var _dsValid = false;
      var _mdValid = false;
      function updateStartButton() {
        formView.querySelector('#btn-start-training').disabled = !(_dsValid && _mdValid);
      }

      // Browse buttons — open native file dialogs
      formView.querySelector('#btn-browse-dataset').addEventListener('click', function() {
        if (!window.__TAURI_INTERNALS__ || !App.tauri) return;
        App.tauri.invoke('open_folder_dialog').then(function(path) {
          if (path) { formView.querySelector('#dataset-path').value = path; }
        });
      });
      formView.querySelector('#btn-browse-model').addEventListener('click', function() {
        if (!window.__TAURI_INTERNALS__ || !App.tauri) return;
        App.tauri.invoke('open_file_dialog').then(function(path) {
          if (path) { formView.querySelector('#model-path').value = path; }
        });
      });

      // Dataset validation
      formView.querySelector('#btn-validate-dataset').addEventListener('click', function() {
        var resultEl = formView.querySelector('#dataset-valid-result');
        resultEl.innerHTML = '<span class="spinner"></span> 正在校验数据集…';
        resultEl.className = 'valid-state';
        var inputEl = formView.querySelector('#dataset-path');
        var path = inputEl ? inputEl.value.trim() : '';
        if (!path) {
          resultEl.className = 'valid-state valid-state--fail';
          resultEl.innerHTML = '❌ 请先输入或选择数据集路径';
          return;
        }
        App.api.checkDataset(path).then(function(result) {
          if (result.valid) {
            resultEl.className = 'valid-state valid-state--pass';
            resultEl.innerHTML = '✅ 校验通过 · ' + (result.image_count || 0) + ' 张图片 · ' + (result.class_count || 0) + ' 个类别';
            _dsValid = true;
            updateStartButton();
            formView.querySelector('#btn-preview-dataset').style.display = '';
          } else {
            _dsValid = false;
            updateStartButton();
            resultEl.className = 'valid-state valid-state--fail';
            var errors = (result.errors || []).map(function(e) { return e.message; }).join('；');
            resultEl.innerHTML = '❌ 校验失败：' + (errors || '数据集格式不正确');
          }
        }).catch(function(err) {
          _dsValid = false;
          updateStartButton();
          resultEl.className = 'valid-state valid-state--fail';
          resultEl.innerHTML = '❌ 校验失败：' + (err.message || err);
        });
      });

      // Model validation
      formView.querySelector('#btn-validate-model').addEventListener('click', function() {
        var resultEl = formView.querySelector('#model-valid-result');
        resultEl.innerHTML = '<span class="spinner"></span> 正在校验模型…';
        resultEl.className = 'valid-state';
        var modelInput = formView.querySelector('#model-path');
        var path = modelInput ? modelInput.value.trim() : '';
        if (!path) {
          resultEl.className = 'valid-state valid-state--fail';
          resultEl.innerHTML = '❌ 请先输入或选择模型文件路径';
          return;
        }
        App.api.checkModel(path).then(function(result) {
          if (result.valid) {
            resultEl.className = 'valid-state valid-state--pass';
            resultEl.innerHTML = '✅ ' + (result.architecture || '模型') + ' · ' + (result.param_count || '?') + ' 参数 · ' + (result.file_size || '?');
            _mdValid = true;
            updateStartButton();
          } else {
            _mdValid = false;
            updateStartButton();
            resultEl.className = 'valid-state valid-state--fail';
            resultEl.innerHTML = '❌ 该文件不是有效的 YOLO 模型文件';
          }
        }).catch(function(err) {
          _mdValid = false;
          updateStartButton();
          resultEl.className = 'valid-state valid-state--fail';
          resultEl.innerHTML = '❌ 校验失败：' + (err.message || err);
        });
      });

      // Restore cached form state
      var dsPath = formView.querySelector('#dataset-path');
      var mdPath = formView.querySelector('#model-path');
      if (dsPath) dsPath.value = _formCache.datasetPath || '';
      if (mdPath) mdPath.value = _formCache.modelPath || '';

      // Restore cached training state
      if (_trainingCache.state === 'training') {
        showTrainingState(page, formView, trainingView);
        // Immediately restore sidebar progress
        var cachePct = Math.round((_trainingCache.epoch / _trainingCache.totalEpochs) * 100);
        App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TRAINING_PROGRESS, {
          detail: { epoch: _trainingCache.epoch, totalEpochs: _trainingCache.totalEpochs, pct: cachePct }
        }));
        // Restart mock interval only if no Tauri (real events drive updates otherwise)
        if (!window.__TAURI_INTERNALS__ || !App.tauri) {
          restartProgressInterval(trainingView, _trainingCache.epoch);
        }
        // Rebuild metrics table rows from cache
        var tbody = trainingView.querySelector('#metrics-table tbody');
        if (tbody) {
          _trainingCache.metrics.forEach(function(m) {
            var row = document.createElement('tr');
            row.innerHTML = '<td>' + m.epoch + '</td><td>' + m.loss + '</td><td>' + m.mAP50 + '</td><td>' + m.mAP50_95 + '</td>';
            tbody.appendChild(row);
          });
        }
        // Rebuild log lines from cache
        var logEl = trainingView.querySelector('#training-log');
        if (logEl) {
          logEl.innerHTML = _trainingCache.logs.map(function(l) {
            return '<div class="log-terminal__line"><span class="log-terminal__line--time">' + l.time + '</span> ' + l.text + '</div>';
          }).join('');
        }
        // Restore progress bar
        var pct = Math.round((_trainingCache.epoch / _trainingCache.totalEpochs) * 100);
        var fill = trainingView.querySelector('#training-progress-fill');
        if (fill) fill.style.width = pct + '%';
        var label = trainingView.querySelector('#training-progress-label');
        if (label) label.textContent = _trainingCache.epoch + ' / ' + _trainingCache.totalEpochs + ' epochs · ' + pct + '% · 估算剩余: ' + Math.round((_trainingCache.totalEpochs - _trainingCache.epoch) * 1.5) + 'm';
      } else if (_trainingCache.state === 'complete') {
        showCompleteState(page, formView, trainingView, completeView);
      }

      container.appendChild(page);

      // Save form state on destroy
      return function() {
        var ds = formView.querySelector('#dataset-path');
        var md = formView.querySelector('#model-path');
        if (ds) _formCache.datasetPath = ds.value;
        if (md) _formCache.modelPath = md.value;
        // Unlisten train events (will re-listen on next mount via listenTrainEvents)
        _trainUnlistens.forEach(function(fn) { try { fn(); } catch(e) {} });
        _trainUnlistens = [];
        page.remove();
      };
    }
  };

  /* ═══════════ BUILDERS ═══════════ */

  function buildFormView(isResume) {
    var form = document.createElement('div');
    form.className = 'page-form-view';
    form.innerHTML =
      '<div class="card page-section">' +
        '<div class="card__header"><span class="card__header-icon">📋</span><h2 class="card__title">任务信息</h2></div>' +
        '<div class="card__body">' +
          '<div class="form-grid">' +
            '<div class="form-group" style="grid-column:1/-1">' +
              '<label class="form-label">任务名称</label>' +
              '<input type="text" class="form-input" placeholder="自动生成时间戳名称…" value="' + (isResume ? '我的第一个模型 (续训)' : '我的第一个模型') + '" />' +
            '</div>' +
            '<div class="form-group" style="grid-column:1/-1">' +
              '<label class="form-label">训练图集 <span class="form-label__required">*</span></label>' +
              '<div style="display:flex;gap:8px"><input type="text" class="form-input" placeholder="选择文件夹或 ZIP 压缩包…" style="flex:1" id="dataset-path" /><button class="btn btn--secondary btn--sm" id="btn-browse-dataset">浏览</button></div>' +
              '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
                '<button class="btn btn--ghost btn--sm" id="btn-validate-dataset">🔍 校验数据集</button>' +
                '<button class="btn btn--ghost btn--sm" id="btn-preview-dataset" style="display:none">📷 预览数据集</button>' +
              '</div>' +
              '<div id="dataset-valid-result"></div>' +
            '</div>' +
            '<div class="form-group" style="grid-column:1/-1">' +
              '<label class="form-label">模型文件 <span class="form-label__required">*</span></label>' +
              '<div style="display:flex;gap:8px"><input type="text" class="form-input" id="model-path" placeholder="选择 .pt 格式的 YOLO 预训练权重…" style="flex:1" /><button class="btn btn--secondary btn--sm" id="btn-browse-model">浏览</button></div>' +
              '<button class="btn btn--ghost btn--sm" style="margin-top:8px" id="btn-validate-model">🔍 校验模型</button>' +
              '<div id="model-valid-result"></div>' +
              '<a class="info-link" href="#/settings" style="margin-top:4px">📖 查看模型下载与版本选择指南 →</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card page-section" id="params-card">' +
        '<div class="card__header"><span class="card__header-icon">⚙️</span><h2 class="card__title">训练参数</h2></div>' +
        '<div class="card__body">' +
          '<div class="form-grid">' +
            '<div class="form-group"><label class="form-label">训练轮数 (Epochs) <span data-tooltip="训练多少轮：轮数越多效果可能越好，但更耗时。建议 100~300 轮。">ⓘ</span></label><div class="slider-row"><input type="range" min="1" max="1000" value="100" /><input type="number" min="1" max="1000" value="100" /></div></div>' +
            '<div class="form-group"><label class="form-label">批次大小 (Batch Size) <span data-tooltip="每批处理图片数：显存不足时可调小。建议 8~32。">ⓘ</span></label><div class="slider-row"><input type="range" min="1" max="256" value="16" /><input type="number" min="1" max="256" value="16" /></div></div>' +
            '<div class="form-group"><label class="form-label">图像尺寸 <span data-tooltip="输入图片缩放到的尺寸（像素）。保持默认 640 即可。">ⓘ</span></label><div class="slider-row"><input type="range" min="320" max="1280" value="640" step="32" /><input type="number" min="320" max="1280" value="640" step="32" /></div></div>' +
            '<div class="form-group"><label class="form-label">计算设备 <span data-tooltip="自动选择最优设备（优先 GPU）。也可手动指定。">ⓘ</span></label><select class="form-select"><option>auto (推荐)</option><option>CPU</option><option disabled>───</option><option>NVIDIA GeForce RTX 4070 Ti SUPER (16 GB)</option></select><span class="form-hint" style="margin-top:2px">可用显存: 14.2 GB / 16 GB</span></div>' +
          '</div>' +
        '</div>' +
        '<div id="collapsible-optimizer"></div>' +
        '<div id="collapsible-advanced" style="margin-top:0"></div>' +
      '</div>' +

      '<div class="page-actions">' +
        '<button class="btn btn--ghost btn--sm" id="btn-sim-complete" title="开发测试用">🧪 模拟完成</button>' +
        '<div style="flex:1"></div>' +
        '<button class="btn btn--primary" id="btn-start-training" disabled>🚀 开始训练</button>' +
      '</div>';

    // Collapsible: Optimizer
    var optContent = document.createElement('div');
    optContent.innerHTML =
      '<div class="form-grid">' +
        '<div class="form-group"><label class="form-label">优化器类型</label><select class="form-select"><option>AdamW</option><option>SGD</option><option>Adam</option></select></div>' +
        '<div class="form-group"><label class="form-label">初始学习率</label><div class="slider-row"><input type="range" min="0.00001" max="0.1" value="0.001" step="0.0001" /><input type="number" min="0.00001" max="0.1" value="0.001" step="0.0001" style="width:88px" /></div></div>' +
        '<div class="form-group"><label class="form-label">动量 (Momentum)</label><div class="slider-row"><input type="range" min="0" max="1" value="0.937" step="0.001" /><input type="number" min="0" max="1" value="0.937" step="0.001" style="width:88px" /></div></div>' +
        '<div class="form-group"><label class="form-label">权重衰减</label><div class="slider-row"><input type="range" min="0" max="0.01" value="0.0005" step="0.0001" /><input type="number" min="0" max="0.01" value="0.0005" step="0.0001" style="width:88px" /></div></div>' +
      '</div>';
    App.components.createCollapsible({ container: form.querySelector('#collapsible-optimizer'), title: '优化器参数', subtitle: '(可跳过)', defaultOpen: false, content: optContent });

    // Collapsible: Advanced
    var advContent = document.createElement('div');
    advContent.innerHTML =
      '<div class="form-grid">' +
        '<div class="form-group"><label class="form-label">早停耐心 (Early Stopping)</label><input type="number" class="form-input" value="50" min="0" max="500" style="width:100px" /><span class="form-hint">N 轮无提升后自动停止，0 = 关闭</span></div>' +
        '<div class="form-group"><label class="form-label">Mosaic 增强</label><div class="checkbox-row"><input type="checkbox" checked /> 开启（四图拼接训练）</div></div>' +
        '<div class="form-group"><label class="form-label">MixUp 增强</label><div class="checkbox-row"><input type="checkbox" /> 开启（双图混合训练）</div></div>' +
        '<div class="form-group"><label class="form-label">水平翻转概率</label><div class="slider-row"><input type="range" min="0" max="1" value="0.5" step="0.1" /><input type="number" min="0" max="1" value="0.5" step="0.1" style="width:72px" /></div></div>' +
      '</div>';
    App.components.createCollapsible({ container: form.querySelector('#collapsible-advanced'), title: '高级参数', subtitle: '(可跳过)', defaultOpen: false, content: advContent });

    // Slider-number sync
    form.querySelectorAll('.slider-row').forEach(function(row) {
      var range = row.querySelector('input[type="range"]');
      var number = row.querySelector('input[type="number"]');
      if (range && number) {
        range.addEventListener('input', function() { number.value = range.value; });
        number.addEventListener('input', function() { range.value = number.value; });
      }
    });

    return form;
  }

  function buildTrainingView() {
    var view = document.createElement('div');
    view.className = 'page-training-view';
    view.innerHTML =
      '<div class="card page-section" style="position:relative">' +
        '<div class="overlay"><div class="overlay__text">🔒 训练参数在训练过程中不可修改</div></div>' +
        '<div class="card__header"><span class="card__header-icon">📋</span><h2 class="card__title">任务信息</h2></div>' +
        '<div class="card__body" style="opacity:0.5">' +
          '<p style="color:var(--text-secondary)">任务：我的第一个模型 | 数据集：game_ui_v2 | 模型：yolov8n.pt</p>' +
          '<p style="color:var(--text-muted);font-size:var(--fs-caption)">轮数: 100 · 批次: 16 · 图像: 640 · 设备: auto</p>' +
        '</div>' +
      '</div>' +
      '<div class="card page-section">' +
        '<div class="card__header"><span class="card__header-icon">📊</span><h2 class="card__title">训练进度</h2></div>' +
        '<div class="card__body">' +
          '<div class="progress-bar"><div class="progress-bar__fill" id="training-progress-fill" style="width:0%"></div></div>' +
          '<div class="progress-bar__label" id="training-progress-label">0 / 100 epochs · 0% · 估算剩余: --</div>' +
          '<div style="margin-top:16px"><h3 style="font-size:var(--fs-body);color:var(--text-secondary);margin-bottom:8px">近期指标</h3>' +
            '<div class="table-wrapper" style="max-height:180px;overflow-y:auto"><table class="data-table" id="metrics-table"><thead><tr><th>轮次</th><th>Loss</th><th>mAP50</th><th>mAP50-95</th></tr></thead><tbody></tbody></table></div>' +
          '</div>' +
          '<div style="margin-top:16px"><h3 style="font-size:var(--fs-body);color:var(--text-secondary);margin-bottom:8px">训练日志</h3>' +
            '<div class="log-terminal" id="training-log">' +
              '<div class="log-terminal__line"><span class="log-terminal__line--time">14:30:01</span> Starting training for 100 epochs...</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card__footer" style="justify-content:flex-start">' +
          '<button class="btn btn--ghost" id="btn-stop-training">⏹ 停止训练</button>' +
          '<button class="btn btn--ghost">📂 打开输出文件夹</button>' +
        '</div>' +
      '</div>';
    return view;
  }

  function buildCompleteView() {
    var view = document.createElement('div');
    view.className = 'page-complete-view';
    view.innerHTML =
      '<div style="text-align:center;padding:20px 0;font-size:var(--fs-h2);color:var(--color-success)">🎉 训练完成！</div>' +
      '<div class="card page-section">' +
        '<div class="card__header"><span class="card__header-icon">📊</span><h2 class="card__title">训练结果摘要</h2></div>' +
        '<div class="card__body">' +
          '<div class="metrics-row">' +
            '<div class="metric-card"><div class="metric-card__value">0.876</div><div class="metric-card__label">最佳 mAP50</div></div>' +
            '<div class="metric-card"><div class="metric-card__value">0.623</div><div class="metric-card__label">最佳 mAP50-95</div></div>' +
            '<div class="metric-card"><div class="metric-card__value">100</div><div class="metric-card__label">总轮次</div></div>' +
            '<div class="metric-card"><div class="metric-card__value">2h 34m</div><div class="metric-card__label">总用时</div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card page-section">' +
        '<div class="card__header"><span class="card__header-icon">🖼️</span><h2 class="card__title">验证集预测样本</h2></div>' +
        '<div class="card__body"><div style="display:flex;gap:12px;overflow-x:auto">' +
          [1,2,3,4,5].map(function(i) { return '<div style="flex-shrink:0;width:160px;height:120px;background:var(--bg-inset);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:var(--fs-caption)">预测图 ' + i + '</div>'; }).join('') +
        '</div></div>' +
      '</div>' +
      '<div class="page-actions">' +
        '<button class="btn btn--secondary" id="btn-retrain">🔄 重新训练</button>' +
        '<button class="btn btn--secondary">📥 下载模型</button>' +
        '<button class="btn btn--secondary">📋 导出报告</button>' +
        '<button class="btn btn--primary" id="btn-goto-inference">🔍 用此模型进行推理测试 →</button>' +
      '</div>';
    return view;
  }

  /* ═══════════ HELPERS ═══════════ */

  function readFormConfig(formView) {
    var getVal = function(sel) {
      var el = formView.querySelector(sel);
      return el ? el.value : '';
    };
    return {
      dataset_path: getVal('#dataset-path'),
      model_path: getVal('#model-path'),
      task_name: getVal('input[placeholder*="时间戳"]') || 'train_' + Date.now(),
      epochs: parseInt(getVal('input[type="range"]')) || 100,
      batch_size: 16,
      imgsz: 640,
      device: 'auto',
      optimizer: 'AdamW',
      lr0: 0.001,
      momentum: 0.937,
      weight_decay: 0.0005,
      patience: 50,
      mosaic: 1.0,
      mixup: 0.0,
      fliplr: 0.5,
    };
  }

  /* ═══════════ STATE TRANSITIONS ═══════════ */

  function restartProgressInterval(trainingView, startEpoch) {
    if (_trainingCache.intervalId) {
      clearInterval(_trainingCache.intervalId);
      _trainingCache.intervalId = null;
    }
    var epoch = startEpoch || 0;
    var totalEpochs = _trainingCache.totalEpochs || 100;
    var id = setInterval(function() {
      _trainingCache.intervalId = id;
      epoch += Math.floor(Math.random() * 5) + 3;
      if (epoch >= totalEpochs) {
        epoch = totalEpochs;
        updateTrainingMetrics(trainingView, epoch, totalEpochs);
        clearInterval(id);
        _trainingCache.intervalId = null;
        App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
          detail: { type: 'info', title: '训练进度', message: '达到 100% — 训练即将完成' }
        }));
        setTimeout(function() {
          _trainingCache.state = 'complete';
          var pg = trainingView.parentElement;
          if (pg) {
            var fv = pg.querySelector('.page-form-view');
            var cv = pg.querySelector('.page-complete-view');
            if (fv) fv.style.display = 'none';
            trainingView.style.display = 'none';
            if (cv) cv.style.display = '';
          }
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'ready' } }));
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
            detail: { type: 'success', title: '训练完成！', message: 'mAP50: 0.876 · 历时 2h 34m' }
          }));
        }, 500);
        return;
      }
      updateTrainingMetrics(trainingView, epoch, totalEpochs);
    }, 1200);
    _trainingCache.intervalId = id;
  }

  function showTrainingState(page, formView, trainingView) {
    _trainingCache.state = 'training';
    formView.style.display = 'none';
    trainingView.style.display = '';
    var cv = page.querySelector('.page-complete-view');
    if (cv) cv.style.display = 'none';
    App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'training', detail: '我的第一个模型' } }));
  }

  function showCompleteState(page, formView, trainingView, completeView) {
    _trainingCache.state = 'complete';
    formView.style.display = 'none';
    trainingView.style.display = 'none';
    completeView.style.display = '';
  }

  function resetToForm(page, formView, trainingView, completeView) {
    _trainingCache.state = 'form';
    _trainingCache.epoch = 0;
    _trainingCache.metrics = [];
    _trainingCache.logs = [];
    if (_trainingCache.intervalId) { clearInterval(_trainingCache.intervalId); _trainingCache.intervalId = null; }
    formView.style.display = '';
    trainingView.style.display = 'none';
    completeView.style.display = 'none';
    var fill = trainingView.querySelector('#training-progress-fill');
    if (fill) fill.style.width = '0%';
    var label = trainingView.querySelector('#training-progress-label');
    if (label) label.textContent = '0 / 100 epochs · 0% · 估算剩余: --';
    App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'ready' } }));
  }

  function updateTrainingMetrics(trainingView, epoch, totalEpochs) {
    _trainingCache.epoch = epoch;
    _trainingCache.totalEpochs = totalEpochs;

    var pct = Math.round((epoch / totalEpochs) * 100);
    var fill = trainingView.querySelector('#training-progress-fill');
    if (fill) fill.style.width = pct + '%';
    var label = trainingView.querySelector('#training-progress-label');
    if (label) label.textContent = epoch + ' / ' + totalEpochs + ' epochs · ' + pct + '% · 估算剩余: ' + Math.round((totalEpochs - epoch) * 1.5) + 'm';

    var log = trainingView.querySelector('#training-log');
    var loss = (2.5 - (epoch / totalEpochs) * 1.8 + Math.random() * 0.3).toFixed(3);
    var mAP = (0.1 + (epoch / totalEpochs) * 0.75 + Math.random() * 0.05).toFixed(3);
    var mAP95 = (mAP - 0.25).toFixed(3);

    // Save to cache
    _trainingCache.metrics.push({ epoch: epoch, loss: loss, mAP50: mAP, mAP50_95: mAP95 });
    if (_trainingCache.metrics.length > 10) _trainingCache.metrics.shift();

    // Emit progress event for sidebar to consume
    App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TRAINING_PROGRESS, {
      detail: { epoch: epoch, totalEpochs: totalEpochs, pct: pct }
    }));

    var timeStr = new Date().toLocaleTimeString();
    var logText = 'Epoch ' + epoch + '/' + totalEpochs + ' ─ loss: ' + loss + ', mAP50: ' + mAP + ', mAP50-95: ' + mAP95;
    _trainingCache.logs.push({ time: timeStr, text: logText });
    if (_trainingCache.logs.length > 100) _trainingCache.logs.shift();

    if (log) {
      var line = document.createElement('div');
      line.className = 'log-terminal__line';
      line.innerHTML = '<span class="log-terminal__line--time">' + timeStr + '</span> ' + logText;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }

    var tbody = trainingView.querySelector('#metrics-table tbody');
    if (tbody) {
      var row = document.createElement('tr');
      row.innerHTML = '<td>' + epoch + '</td><td>' + loss + '</td><td>' + mAP + '</td><td>' + mAP95 + '</td>';
      tbody.appendChild(row);
      while (tbody.children.length > 10) tbody.firstChild.remove();
    }
  }
})();
