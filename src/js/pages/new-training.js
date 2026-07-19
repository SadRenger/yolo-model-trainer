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
    dsValid: false,
    mdValid: false,
  };
  var _trainingCache = {
    state: 'form',        // 'form' | 'training' | 'complete'
    taskId: null,         // Rust task_id for stop/pause
    best_mAP50: 0,        // real training results (from T-308)
    best_mAP50_95: 0,
    total_time_s: 0,
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

      // ── Train event listeners (persistent, for real Tauri training) ──
      var _trainUnlistens = [];
      var _trainListenersActive = false;
      function listenTrainEvents() {
        if (_trainListenersActive) return; // prevent double registration
        if (!window.__TAURI_INTERNALS__ || !App.tauri) return;
        _trainListenersActive = true;

        // Per-line JSONL events (code-based matching)
        App.tauri.listen('train:line', function(event) {
          var payload = event.payload;
          if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch(_) {} }
          if (!payload) return;
          var code = payload.code || '';

          // Show import/training progress in log
          if (code === 'T-001') {
            updateTrainingLog(trainingView, payload.message || '初始化中...');
          } else if (code === 'T-002') {
            updateTrainingLog(trainingView, payload.message || '引擎就绪');
          } else if (code === 'T-101') {
            // First epoch started
          } else if (code === 'T-104' && payload.type === 'progress') {
            updateTrainingMetrics(trainingView, payload.epoch, payload.total_epochs);
          } else if (code === 'T-105' || code === 'T-106' || code === 'T-107') {
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
              detail: { type: 'info', title: '训练进度', message: '达到 ' + (payload.milestone || '') }
            }));
          } else if (code === 'T-308') {
            // Capture real training results for complete view
            _trainingCache.best_mAP50 = payload.best_mAP50 || 0;
            _trainingCache.best_mAP50_95 = payload.best_mAP50_95 || 0;
            _trainingCache.total_time_s = payload.total_time_s || 0;
          }
        }).then(function(fn) { _trainUnlistens.push(fn); });

        // Process completion (success)
        App.tauri.listen('train:completed', function(event) {
          var payload = event.payload;
          if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch(_) {} }
          if (payload && payload.exit_code === 0) {
            showCompleteState(page, formView, trainingView, completeView);
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
              detail: { type: 'success', title: '训练完成！', message: '查看结果摘要' }
            }));
          }
        }).then(function(fn) { _trainUnlistens.push(fn); });

        // Process stopped by user
        App.tauri.listen('train:stopped', function(event) {
          resetToForm(page, formView, trainingView, completeView);
        }).then(function(fn) { _trainUnlistens.push(fn); });

        // Process error/crash
        App.tauri.listen('train:error', function(event) {
          var payload = event.payload;
          if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch(_) {} }
          resetToForm(page, formView, trainingView, completeView);
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
            detail: { type: 'error', title: '训练异常退出', message: 'exit code: ' + ((payload && payload.exit_code) || '?') }
          }));
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
          // Pre-flight: reject empty paths
          if (!config.dataset_path || !config.dataset_path.trim()) {
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
              detail: { type: 'warning', title: '无法启动训练', message: '请先选择训练图集（数据集）' }
            }));
            resetToForm(page, formView, trainingView, completeView);
            return;
          }
          if (!config.model_path || !config.model_path.trim()) {
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
              detail: { type: 'warning', title: '无法启动训练', message: '请先选择模型文件（.pt）' }
            }));
            resetToForm(page, formView, trainingView, completeView);
            return;
          }
          App.api.startTraining(config).then(function(result) {
            _trainingCache.taskId = result.task_id; // store for stop button
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
            if (hasTauri && _trainingCache.taskId) {
              App.tauri.invoke('stop_training', { taskId: _trainingCache.taskId }).catch(function(){});
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

      // Dataset preview
      formView.querySelector('#btn-preview-dataset').addEventListener('click', function() {
        var dsEl = formView.querySelector('#dataset-path');
        var path = dsEl ? dsEl.value.trim() : '';
        if (!path) {
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
            detail: { type: 'warning', title: '无法预览', message: '请先选择数据集路径' }
          }));
          return;
        }
        App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
          detail: { type: 'info', title: '正在生成预览…', message: '最多 20 张，请稍候' }
        }));
        App.api.previewDataset(path).then(function(result) {
          var previews = result.previews || [];
          if (previews.length === 0) {
            App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
              detail: { type: 'warning', title: '无预览', message: '未找到可预览的图片' }
            }));
            return;
          }
          showPreviewModal(page, previews);
        }).catch(function(err) {
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
            detail: { type: 'error', title: '预览失败', message: err.message || String(err) }
          }));
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
          var issues = result.errors || [];
          var errs = issues.filter(function(e) { return e.level === 'error'; });
          var warns = issues.filter(function(e) { return e.level === 'warning'; });

          if (result.valid || errs.length === 0) {
            resultEl.className = 'valid-state valid-state--pass';
            var msg = '✅ 校验通过 · ' + (result.image_count || 0) + ' 张图片 · ' + (result.class_count || 0) + ' 个类别';
            if (warns.length > 0) {
              msg += '<br>⚠️ ' + warns.map(function(w) { return w.message; }).join('；');
              if (errs.length === 0) resultEl.className = 'valid-state valid-state--warn';
            }
            resultEl.innerHTML = msg;
            _dsValid = true;
            _formCache.dsValid = true;
            updateStartButton();
            formView.querySelector('#btn-preview-dataset').style.display = '';
          } else {
            _dsValid = false;
            _formCache.dsValid = false;
            updateStartButton();
            var lines = [];
            if (errs.length > 0) {
              resultEl.className = 'valid-state valid-state--fail';
              lines.push('❌ ' + errs.map(function(e) { return e.message; }).join('；'));
            }
            if (warns.length > 0) {
              if (errs.length === 0) resultEl.className = 'valid-state valid-state--warn';
              lines.push('⚠️ ' + warns.map(function(w) { return w.message; }).join('；'));
            }
            resultEl.innerHTML = lines.join('<br>') || '数据集格式不正确';
          }
        }).catch(function(err) {
          _dsValid = false;
          _formCache.dsValid = false;
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
            _formCache.mdValid = true;
            updateStartButton();
          } else {
            _mdValid = false;
            updateStartButton();
            resultEl.className = 'valid-state valid-state--fail';
            resultEl.innerHTML = '❌ 该文件不是有效的 YOLO 模型文件';
          }
        }).catch(function(err) {
          _mdValid = false;
          _formCache.mdValid = false;
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
      // Restore validation state
      if (_formCache.dsValid) {
        _dsValid = true;
        updateStartButton();
        // Re-show validation pass UI
        var dsResult = formView.querySelector('#dataset-valid-result');
        if (dsResult) { dsResult.className = 'valid-state valid-state--pass'; dsResult.innerHTML = '✅ 校验通过（已缓存）'; }
        formView.querySelector('#btn-preview-dataset').style.display = '';
      }
      if (_formCache.mdValid) {
        _mdValid = true;
        updateStartButton();
        var mdResult = formView.querySelector('#model-valid-result');
        if (mdResult) { mdResult.className = 'valid-state valid-state--pass'; mdResult.innerHTML = '✅ 模型校验通过（已缓存）'; }
      }

      // Restore cached training state
      if (_trainingCache.state === 'training') {
        var hasTauri = !!(window.__TAURI_INTERNALS__ && App.tauri);
        // Check if training completed while user was away
        if (hasTauri && _trainingCache.taskId) {
          App.tauri.invoke('check_task_status', { taskId: _trainingCache.taskId }).then(function(status) {
            if (status === 'completed') {
              _trainingCache.state = 'complete';
              showCompleteState(page, formView, trainingView, completeView);
            } else {
              showTrainingState(page, formView, trainingView);
              // Re-register train event listeners for live updates
              listenTrainEvents();
            }
          });
        } else {
          showTrainingState(page, formView, trainingView);
          // Mock mode: restart interval if not Tauri
          if (!hasTauri) {
            restartProgressInterval(trainingView, _trainingCache.epoch);
          }
        }
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
        // Unlisten train events
        _trainUnlistens.forEach(function(fn) { try { fn(); } catch(e) {} });
        _trainUnlistens = [];
        _trainListenersActive = false;
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
            '<div class="form-group"><label class="form-label">计算设备 <span data-tooltip="自动选择最优设备（优先 GPU）。也可手动指定。">ⓘ</span></label><select class="form-select" id="device-select"><option>auto (推荐)</option><option>CPU</option></select><span class="form-hint" style="margin-top:2px" id="vram-hint"></span></div>' +
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

    // Dynamic GPU dropdown
    var deviceSelect = form.querySelector('#device-select');
    var vramHint = form.querySelector('#vram-hint');
    if (deviceSelect && App._envCache && App._envCache.gpu && App._envCache.gpu.length > 0) {
      // Add divider
      var divider = document.createElement('option');
      divider.disabled = true;
      divider.textContent = '───';
      deviceSelect.appendChild(divider);
      // Add each GPU
      App._envCache.gpu.forEach(function(gpu) {
        var opt = document.createElement('option');
        opt.textContent = gpu.name + ' (' + (gpu.vram_total || '?') + ')';
        opt.value = gpu.name;
        deviceSelect.appendChild(opt);
      });
      if (vramHint && App._envCache.gpu[0].vram_available) {
        vramHint.textContent = '可用显存: ' + App._envCache.gpu[0].vram_available + ' / ' + App._envCache.gpu[0].vram_total;
      }
    } else if (vramHint) {
      vramHint.textContent = '未检测到 GPU — 将使用 CPU';
    }

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

  function toAssetUrl(path) {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    // Tauri 2.x: convert Windows path to loadable URL
    if (window.__TAURI_INTERNALS__) {
      // Method 1: official convertFileSrc
      if (window.__TAURI_INTERNALS__.convertFileSrc) {
        try {
          var url = window.__TAURI_INTERNALS__.convertFileSrc(path);
          if (url) return url;
        } catch(e) {}
      }
      // Method 2: manual asset protocol
      var normalized = path.replace(/\\/g, '/');
      if (!normalized.startsWith('/')) normalized = '/' + normalized;
      return 'https://asset.localhost' + normalized;
    }
    return path;
  }

  function showPreviewModal(page, previews) {
    var currentIndex = 0;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '10000';

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '900px';
    modal.style.maxHeight = '90vh';
    modal.style.overflowY = 'auto';

    var total = previews.length;
    var currentImg = previews[0];

    function renderView() {
      var p = previews[currentIndex];
      modal.innerHTML =
        '<div class="modal__header">' +
          '<span class="modal__icon">📷</span>' +
          '<h2 class="modal__title">数据集预览 — ' + p.filename + ' (' + (currentIndex + 1) + '/' + total + ')</h2>' +
          '<span style="font-size:var(--fs-caption);color:var(--text-secondary)">' + (p.detection_count || 0) + ' 个标注 · ' + (p.classes || []).join(', ') + '</span>' +
          '<button class="modal__close-btn btn--icon close-preview" aria-label="关闭">&times;</button>' +
        '</div>' +
        '<div class="modal__body" style="text-align:center">' +
          // Navigation
          '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px">' +
            '<button class="btn btn--ghost btn--sm prev-btn" ' + (currentIndex === 0 ? 'disabled' : '') + '>◀ 上一张</button>' +
            '<span style="font-size:var(--fs-caption);color:var(--text-muted)">' + (currentIndex + 1) + ' / ' + total + '</span>' +
            '<button class="btn btn--ghost btn--sm next-btn" ' + (currentIndex === total - 1 ? 'disabled' : '') + '>下一张 ▶</button>' +
          '</div>' +
          // Main image
          '<img src="' + (p.thumb || '') + '" style="max-width:100%;max-height:55vh;border-radius:var(--radius-sm)" alt="' + p.filename + '" />' +
          // Thumbnail grid
          '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:12px;justify-content:center">' +
            previews.map(function(thumb, i) {
              return '<img src="' + (thumb.thumb || '') + '" class="thumb-' + i + '" style="width:80px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;border:2px solid ' + (i === currentIndex ? 'var(--color-primary)' : 'var(--border-default)') + '" title="' + thumb.filename + '" />';
            }).join('') +
          '</div>' +
        '</div>';
    }

    function close() {
      if (overlay.parentNode) overlay.remove();
      document.removeEventListener('keydown', keyHandler);
    }

    function navigate(delta) {
      var next = currentIndex + delta;
      if (next >= 0 && next < total) {
        currentIndex = next;
        renderView();
        wireButtons();
      }
    }

    function wireButtons() {
      modal.querySelector('.close-preview').addEventListener('click', close);
      modal.querySelector('.prev-btn').addEventListener('click', function() { navigate(-1); });
      modal.querySelector('.next-btn').addEventListener('click', function() { navigate(1); });
      // Thumbnail clicks
      for (var i = 0; i < total; i++) {
        (function(idx) {
          var thumb = modal.querySelector('.thumb-' + idx);
          if (thumb) thumb.addEventListener('click', function() {
            currentIndex = idx;
            renderView();
            wireButtons();
          });
        })(i);
      }
    }

    var keyHandler = function(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    };
    document.addEventListener('keydown', keyHandler);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close();
    });

    renderView();
    wireButtons();
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

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
    App.bus.dispatchEvent(new CustomEvent(App.EVENTS.SIDEBAR_STATUS, { detail: { status: 'completed' } }));
    // Inject real training results into the DOM
    var mAP50 = _trainingCache.best_mAP50 || 0;
    var mAP95 = _trainingCache.best_mAP50_95 || 0;
    var timeMin = _trainingCache.total_time_s ? Math.round(_trainingCache.total_time_s / 60) : 0;
    var vals = completeView.querySelectorAll('.metric-card__value');
    if (vals[0]) vals[0].textContent = mAP50 ? mAP50.toFixed(3) : '--';
    if (vals[1]) vals[1].textContent = mAP95 ? mAP95.toFixed(3) : '--';
    if (vals[3]) vals[3].textContent = timeMin ? timeMin + 'm' : '--';
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

  function updateTrainingLog(trainingView, msg) {
    var log = trainingView.querySelector('#training-log');
    if (!log) return;
    var wasAtBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    var line = document.createElement('div');
    line.className = 'log-terminal__line';
    var timeStr = new Date().toLocaleTimeString();
    line.innerHTML = '<span class="log-terminal__line--time">' + timeStr + '</span> ' + msg;
    log.appendChild(line);
    if (wasAtBottom) {
      log.scrollTop = log.scrollHeight;
    }
    updateScrollHint(trainingView, !wasAtBottom);
    // Push to cache so logs survive page switches
    _trainingCache.logs.push({ time: timeStr, text: msg });
    if (_trainingCache.logs.length > 100) _trainingCache.logs.shift();
  }

  function updateScrollHint(trainingView, show) {
    var hint = trainingView.querySelector('#scroll-hint');
    if (show) {
      if (!hint) {
        hint = document.createElement('button');
        hint.id = 'scroll-hint';
        hint.className = 'btn btn--ghost btn--sm';
        hint.textContent = '↓ 回到底部';
        hint.style.cssText = 'position:absolute;bottom:8px;right:12px;z-index:5';
        hint.addEventListener('click', function() {
          var log = trainingView.querySelector('#training-log');
          if (log) { log.scrollTop = log.scrollHeight; }
          hint.style.display = 'none';
        });
        var logContainer = trainingView.querySelector('#training-log');
        if (logContainer && logContainer.parentNode) {
          logContainer.parentNode.style.position = 'relative';
          logContainer.parentNode.appendChild(hint);
        }
      }
      hint.style.display = '';
    } else if (hint) {
      hint.style.display = 'none';
    }
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
      var wasAtBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
      var line = document.createElement('div');
      line.className = 'log-terminal__line';
      line.innerHTML = '<span class="log-terminal__line--time">' + timeStr + '</span> ' + logText;
      log.appendChild(line);
      if (wasAtBottom) { log.scrollTop = log.scrollHeight; }
      updateScrollHint(trainingView, !wasAtBottom);
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
