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
      var selectedModelPath = params.model || null;

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
          '<div class="drop-zone drop-zone--disabled" id="drop-zone"><div class="drop-zone__icon">📸</div><div class="drop-zone__text">拖放图片到此处，或点击上传</div><div class="drop-zone__hint">支持 JPG / PNG / BMP，最大 20MB</div></div>' +
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

      // Wire interactions
      page.querySelector('#btn-browse-model').addEventListener('click', function() {
        selectedModelPath = 'yolov8n.pt';
        page.querySelector('#model-path').value = selectedModelPath;
        var infoEl = page.querySelector('#model-info');
        infoEl.innerHTML = '<span class="spinner"></span> 校验中…';
        App.api.checkModel(selectedModelPath).then(function(result) {
          if (result.valid) {
            infoEl.innerHTML = '<div class="valid-state valid-state--pass">✅ ' + result.architecture + ' · ' + result.param_count + ' 参数 · ' + result.file_size + '</div>';
            currentState = 'ready';
            page.querySelector('#drop-zone').classList.remove('drop-zone--disabled');
            page.querySelector('#btn-run-inference').disabled = false;
          }
        });
      });

      if (selectedModelPath) {
        page.querySelector('#model-path').value = selectedModelPath;
        page.querySelector('#model-info').innerHTML = '<div class="valid-state valid-state--pass">✅ YOLOv8n · 3.2M 参数 · 6.2 MB</div>';
        currentState = 'ready';
        page.querySelector('#drop-zone').classList.remove('drop-zone--disabled');
        page.querySelector('#btn-run-inference').disabled = false;
      }

      page.querySelector('#drop-zone').addEventListener('click', function() {
        if (currentState !== 'ready') return;
        runInference(page, resultsCard);
      });
      page.querySelector('#btn-run-inference').addEventListener('click', function() {
        if (currentState !== 'ready') return;
        runInference(page, resultsCard);
      });

      container.appendChild(page);
      return function() { page.remove(); };
    }
  };

  function runInference(page, resultsCard) {
    var btn = page.querySelector('#btn-run-inference');
    btn.disabled = true;
    btn.textContent = '⏳ 检测中…';
    App.api.runInference({}).then(function(result) {
      var tbody = resultsCard.querySelector('#detection-table tbody');
      tbody.innerHTML = result.detections.map(function(d) {
        return '<tr><td>' + d.class + '</td><td style="color:var(--color-success)">' + (d.confidence * 100).toFixed(1) + '%</td><td style="font-family:var(--font-code);font-size:var(--fs-caption)">[' + d.bbox.join(', ') + ']</td></tr>';
      }).join('');
      resultsCard.querySelector('#inference-stats').textContent = '共检测到 ' + result.total_detections + ' 个目标 · 推理用时 ' + result.inference_time_ms + 'ms · 输入 1920×1080 → 推理 640×384 · 置信度 0.25 · IoU 0.45';
      resultsCard.style.display = '';
      btn.disabled = false;
      btn.textContent = '🔍 重新检测';
    });
  }
})();
