/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Page: Inference Test (global namespace)
   ═══════════════════════════════════════════════════ */
(function() {
  var App = window.App;
  App.pages = App.pages || {};

  App.pages.inference = {
    mount: function(container, params) {
      params = params || {};
      var page = document.createElement('div');
      page.className = 'page page-inference';
      var currentState = 'no-model';
      var selectedModelPath = params.model || '';
      var selectedImagePath = '';

      var title = document.createElement('h1');
      title.className = 'page-title';
      title.textContent = '推理测试';
      page.appendChild(title);

      // Model Selection Card
      var modelCard = document.createElement('div');
      modelCard.className = 'card page-section';
      modelCard.innerHTML =
        '<div class="card__header"><span class="card__header-icon">🧠</span><h2 class="card__title">模型选择</h2></div>' +
        '<div class="card__body">' +
          '<div style="display:flex;gap:8px"><input type="text" class="form-input" placeholder="选择已训练好的 .pt 模型文件…" style="flex:1" id="model-path" /><button class="btn btn--secondary btn--sm" id="btn-browse-model">浏览</button></div>' +
          '<div id="model-info" style="margin-top:8px"><span class="form-hint">ℹ️ 请选择已训练好的 .pt 模型文件</span></div>' +
        '</div>';
      page.appendChild(modelCard);

      // Image Upload Card
      var uploadCard = document.createElement('div');
      uploadCard.className = 'card page-section';
      uploadCard.innerHTML =
        '<div class="card__header"><span class="card__header-icon">🖼️</span><h2 class="card__title">图片上传</h2></div>' +
        '<div class="card__body">' +
          '<div style="display:flex;gap:8px;margin-bottom:12px"><input type="text" class="form-input" placeholder="选择要检测的图片…" style="flex:1" id="image-path" /><button class="btn btn--secondary btn--sm" id="btn-browse-image">浏览</button></div>' +
          '<div class="drop-zone drop-zone--disabled" id="drop-zone"><div class="drop-zone__icon">📸</div><div class="drop-zone__text">拖放图片到此处，或点击上方浏览按钮</div><div class="drop-zone__hint">支持 JPG / PNG / BMP，最大 20MB</div></div>' +
          '<div id="collapsible-inference-params" style="margin-top:16px"></div>' +
          '<div style="margin-top:16px"><button class="btn btn--primary" id="btn-run-inference" disabled style="width:100%">🔍 开始检测</button></div>' +
        '</div>';
      page.appendChild(uploadCard);

      // Inference params collapsible
      var infContent = document.createElement('div');
      infContent.innerHTML =
        '<div class="form-grid">' +
          '<div class="form-group"><label class="form-label">置信度阈值</label><div class="slider-row"><input type="range" min="0" max="1" value="0.25" step="0.05" /><input type="number" min="0" max="1" value="0.25" step="0.05" style="width:72px" /></div></div>' +
          '<div class="form-group"><label class="form-label">IoU 阈值</label><div class="slider-row"><input type="range" min="0" max="1" value="0.45" step="0.05" /><input type="number" min="0" max="1" value="0.45" step="0.05" style="width:72px" /></div></div>' +
          '<div class="form-group"><label class="form-label">推理尺寸</label><div class="slider-row"><input type="range" min="320" max="1280" value="640" step="32" /><input type="number" min="320" max="1280" value="640" step="32" style="width:72px" /></div></div>' +
        '</div>';
      App.components.createCollapsible({ container: uploadCard.querySelector('#collapsible-inference-params'), title: '推理参数', subtitle: '(可调整)', defaultOpen: false, content: infContent });

      // Results Card (hidden)
      var resultsCard = document.createElement('div');
      resultsCard.className = 'card page-section';
      resultsCard.style.display = 'none';
      resultsCard.id = 'results-card';
      resultsCard.innerHTML =
        '<div class="card__header"><span class="card__header-icon">📊</span><h2 class="card__title">检测结果</h2></div>' +
        '<div class="card__body">' +
          '<div style="display:flex;gap:16px">' +
            '<div style="flex:1;min-width:0;background:var(--bg-inset);border-radius:var(--radius-sm);min-height:300px;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">检测结果图（占位）</div>' +
            '<div style="width:260px;flex-shrink:0"><table class="data-table" id="detection-table"><thead><tr><th>类别</th><th>置信度</th><th>框坐标</th></tr></thead><tbody></tbody></table></div>' +
          '</div>' +
          '<div style="margin-top:16px;font-size:var(--fs-caption);color:var(--text-secondary)" id="inference-stats"></div>' +
        '</div>' +
        '<div class="card__footer">' +
          '<button class="btn btn--secondary btn--sm">📥 导出结果图</button><button class="btn btn--secondary btn--sm">📋 导出检测数据 (JSON)</button>' +
        '</div>';
      page.appendChild(resultsCard);

      // ── Wire browse buttons to real file dialogs ──
      var hasTauri = !!(window.__TAURI_INTERNALS__ && App.tauri);

      page.querySelector('#btn-browse-model').addEventListener('click', function() {
        if (!hasTauri) return;
        App.tauri.invoke('open_file_dialog').then(function(path) {
          if (path) {
            selectedModelPath = path;
            page.querySelector('#model-path').value = path;
            // Auto-validate
            var infoEl = page.querySelector('#model-info');
            infoEl.innerHTML = '<span class="spinner"></span> 校验中…';
            App.api.checkModel(path).then(function(result) {
              if (result.valid) {
                infoEl.innerHTML = '<div class="valid-state valid-state--pass">✅ ' + result.architecture + ' · ' + result.param_count + ' 参数 · ' + result.file_size + '</div>';
                currentState = 'ready';
                page.querySelector('#drop-zone').classList.remove('drop-zone--disabled');
                page.querySelector('#btn-run-inference').disabled = !selectedImagePath;
              } else {
                infoEl.innerHTML = '<div class="valid-state valid-state--fail">❌ 该文件不是有效的 YOLO 模型文件</div>';
              }
            }).catch(function(err) {
              infoEl.innerHTML = '<div class="valid-state valid-state--fail">❌ 校验失败：' + (err.message || err) + '</div>';
            });
          }
        });
      });

      page.querySelector('#btn-browse-image').addEventListener('click', function() {
        if (!hasTauri) return;
        App.tauri.invoke('open_file_dialog').then(function(path) {
          if (path) {
            selectedImagePath = path;
            page.querySelector('#image-path').value = path;
            page.querySelector('#drop-zone').classList.remove('drop-zone--disabled');
            page.querySelector('#btn-run-inference').disabled = !(currentState === 'ready');
          }
        }).catch(function(err) {
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
            detail: { type: 'error', title: '文件选择失败', message: String(err) }
          }));
        });
      });

      // Restore model from params (e.g., from training complete page)
      if (selectedModelPath) {
        page.querySelector('#model-path').value = selectedModelPath;
        page.querySelector('#model-info').innerHTML = '<div class="valid-state valid-state--pass">✅ 已预选模型</div>';
        currentState = 'ready';
        page.querySelector('#drop-zone').classList.remove('drop-zone--disabled');
      }

      // ── Run inference ──
      page.querySelector('#btn-run-inference').addEventListener('click', function() {
        if (currentState !== 'ready' || !selectedImagePath) return;
        var btn = page.querySelector('#btn-run-inference');
        btn.disabled = true;
        btn.textContent = '⏳ 检测中…';

        // Read params
        var getSliderVal = function(sel) {
          var el = uploadCard.querySelector(sel);
          return el ? parseFloat(el.value) || 0 : 0;
        };

        App.api.runInference({
          modelPath: selectedModelPath,
          imagePath: selectedImagePath,
          confidence: getSliderVal('input[type="range"]'),
          iou: 0.45,
          imageSize: 640,
        }).then(function(result) {
          // Populate results
          var detections = result.detections || [];
          var tbody = resultsCard.querySelector('#detection-table tbody');
          tbody.innerHTML = detections.map(function(d) {
            return '<tr><td>' + d.class + '</td><td style="color:var(--color-success)">' + ((d.confidence || 0) * 100).toFixed(1) + '%</td><td style="font-family:var(--font-code);font-size:var(--fs-caption)">[' + (d.bbox || []).join(', ') + ']</td></tr>';
          }).join('');

          var stats = result.stats || {};
          resultsCard.querySelector('#inference-stats').textContent =
            '共检测到 ' + (result.total_detections || detections.length) + ' 个目标 · 推理用时 ' + (stats.inference_time_ms || result.inference_time_ms || '?') + 'ms';
          resultsCard.style.display = '';
          btn.disabled = false;
          btn.textContent = '🔍 重新检测';
        }).catch(function(err) {
          App.bus.dispatchEvent(new CustomEvent(App.EVENTS.TOAST_SHOW, {
            detail: { type: 'error', title: '推理失败', message: err.message || String(err) }
          }));
          btn.disabled = false;
          btn.textContent = '🔍 重试';
        });
      });

      container.appendChild(page);
      return function() { page.remove(); };
    }
  };
})();
