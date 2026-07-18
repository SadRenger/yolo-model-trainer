/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Page: New Training
   States: form (default) | training | complete
   ═══════════════════════════════════════════════════ */

import { bus, EVENTS } from '../events.js';
import { createCollapsible } from '../components/collapsible.js';
import * as api from '../api.js';

/**
 * @param {HTMLElement} container
 * @param {object} params - route params (e.g. { resume: 'task_003' })
 * @returns {() => void} cleanup function
 */
export async function mount(container, params = {}) {
  const page = document.createElement('div');
  page.className = 'page page-new-training';

  // Check if we're in resume mode
  const isResume = !!params.resume;

  /* ── Build Page Structure ── */

  // Page title
  const title = document.createElement('h1');
  title.className = 'page-title';
  title.textContent = isResume ? '新建训练 (续训)' : '新建训练任务';
  page.appendChild(title);

  // Resume banner
  if (isResume) {
    const banner = document.createElement('div');
    banner.className = 'card page-section';
    banner.style.cssText = 'padding:12px 16px;display:flex;align-items:center;gap:8px;font-size:var(--fs-caption);color:var(--color-primary);';
    banner.innerHTML = `ℹ️ 将从历史任务 <strong>${params.resume}</strong> 恢复配置并重新训练`;
    page.appendChild(banner);
  }

  /* ── State A: Form ── */
  const formView = buildFormView(isResume);
  page.appendChild(formView);

  /* ── State B: Training Progress ── */
  const trainingView = buildTrainingView();
  trainingView.style.display = 'none';
  page.appendChild(trainingView);

  /* ── State C: Training Complete ── */
  const completeView = buildCompleteView();
  completeView.style.display = 'none';
  page.appendChild(completeView);

  /* ── Wire State Transitions ── */

  // "Start Training" button
  formView.querySelector('#btn-start-training').addEventListener('click', async () => {
    showTrainingState(page, formView, trainingView);

    // Mock training progress
    let epoch = 0;
    const totalEpochs = 100;
    const updateProgress = () => {
      epoch += Math.floor(Math.random() * 5) + 3;
      if (epoch >= totalEpochs) {
        epoch = totalEpochs;
        updateTrainingMetrics(trainingView, epoch, totalEpochs);
        bus.dispatchEvent(new CustomEvent(EVENTS.TOAST_SHOW, {
          detail: { type: 'info', title: '训练进度', message: '达到 100% — 训练即将完成' }
        }));
        clearInterval(progressInterval);
        setTimeout(() => {
          showCompleteState(page, formView, trainingView, completeView);
          bus.dispatchEvent(new CustomEvent(EVENTS.SIDEBAR_STATUS, {
            detail: { status: 'ready' }
          }));
          bus.dispatchEvent(new CustomEvent(EVENTS.TOAST_SHOW, {
            detail: { type: 'success', title: '训练完成！', message: 'mAP50: 0.876 · 历时 2h 34m' }
          }));
        }, 500);
        return;
      }
      updateTrainingMetrics(trainingView, epoch, totalEpochs);
    };
    const progressInterval = setInterval(updateProgress, 1200);
    updateProgress();

    // Stop button
    trainingView.querySelector('#btn-stop-training').addEventListener('click', () => {
      bus.dispatchEvent(new CustomEvent(EVENTS.MODAL_OPEN, {
        detail: {
          title: '确认停止训练',
          body: '确定要停止训练吗？\n已产出的模型文件（best.pt / last.pt）会自动保留，可通过训练历史的断点续训功能恢复。',
          icon: '⚠️',
          primaryLabel: '确认停止',
          primaryClass: 'btn--danger',
          secondaryLabel: '继续训练',
        }
      })).then(confirmed => {
        if (confirmed) {
          clearInterval(progressInterval);
          resetToForm(page, formView, trainingView, completeView);
          bus.dispatchEvent(new CustomEvent(EVENTS.SIDEBAR_STATUS, {
            detail: { status: 'ready' }
          }));
        }
      });
    });
  });

  // "Simulate Complete" for dev testing
  formView.querySelector('#btn-sim-complete')?.addEventListener('click', () => {
    showCompleteState(page, formView, trainingView, completeView);
    bus.dispatchEvent(new CustomEvent(EVENTS.SIDEBAR_STATUS, {
      detail: { status: 'ready' }
    }));
  });

  // Complete → Retrain
  completeView.querySelector('#btn-retrain').addEventListener('click', () => {
    resetToForm(page, formView, trainingView, completeView);
  });

  // Complete → Inference
  completeView.querySelector('#btn-goto-inference').addEventListener('click', () => {
    bus.dispatchEvent(new CustomEvent(EVENTS.NAVIGATE, {
      detail: { hash: '#/inference', params: { model: 'best.pt' } }
    }));
  });

  // Dataset validation mock
  formView.querySelector('#btn-validate-dataset').addEventListener('click', async () => {
    const resultEl = formView.querySelector('#dataset-valid-result');
    resultEl.innerHTML = '<span class="spinner"></span> 正在校验数据集…';
    resultEl.className = 'valid-state';
    try {
      const result = await api.checkDataset('mock/path');
      resultEl.className = 'valid-state valid-state--pass';
      resultEl.innerHTML = `✅ 校验通过 · ${result.image_count} 张图片 · ${result.class_count} 个类别`;
      formView.querySelector('#btn-start-training').disabled = false;
      formView.querySelector('#btn-preview-dataset').style.display = '';
    } catch {
      resultEl.className = 'valid-state valid-state--fail';
      resultEl.innerHTML = '❌ 校验失败：未找到 data.yaml 文件';
    }
  });

  // Model validation mock
  formView.querySelector('#btn-validate-model').addEventListener('click', async () => {
    const resultEl = formView.querySelector('#model-valid-result');
    resultEl.innerHTML = '<span class="spinner"></span> 正在校验模型…';
    resultEl.className = 'valid-state';
    try {
      const result = await api.checkModel('mock/model.pt');
      resultEl.className = 'valid-state valid-state--pass';
      resultEl.innerHTML = `✅ ${result.architecture} · ${result.param_count} 参数 · ${result.file_size}`;
    } catch {
      resultEl.className = 'valid-state valid-state--fail';
      resultEl.innerHTML = '❌ 该文件不是有效的 YOLO 模型文件';
    }
  });

  // Mount
  container.appendChild(page);

  // Cleanup
  return () => {
    page.remove();
  };
}

/* ══════════════════════════════════════════════
   BUILDERS
   ══════════════════════════════════════════════ */

function buildFormView(isResume) {
  const form = document.createElement('div');
  form.className = 'page-form-view';

  form.innerHTML = `
    <!-- Card: Task Info -->
    <div class="card page-section">
      <div class="card__header">
        <span class="card__header-icon">📋</span>
        <h2 class="card__title">任务信息</h2>
      </div>
      <div class="card__body">
        <div class="form-grid">
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">任务名称</label>
            <input type="text" class="form-input" placeholder="自动生成时间戳名称…" value="${isResume ? '我的第一个模型 (续训)' : '我的第一个模型'}" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">训练图集 <span class="form-label__required">*</span></label>
            <div style="display:flex;gap:8px">
              <input type="text" class="form-input" placeholder="选择文件夹或 ZIP 压缩包…" style="flex:1" id="dataset-path" />
              <button class="btn btn--secondary btn--sm">浏览</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
              <button class="btn btn--ghost btn--sm" id="btn-validate-dataset">🔍 校验数据集</button>
              <button class="btn btn--ghost btn--sm" id="btn-preview-dataset" style="display:none">📷 预览数据集</button>
            </div>
            <div id="dataset-valid-result"></div>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">模型文件 <span class="form-label__required">*</span></label>
            <div style="display:flex;gap:8px">
              <input type="text" class="form-input" placeholder="选择 .pt 格式的 YOLO 预训练权重…" style="flex:1" />
              <button class="btn btn--secondary btn--sm">浏览</button>
            </div>
            <button class="btn btn--ghost btn--sm" style="margin-top:8px" id="btn-validate-model">🔍 校验模型</button>
            <div id="model-valid-result"></div>
            <a class="info-link" href="#/settings" style="margin-top:4px">📖 查看模型下载与版本选择指南 →</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Card: Training Parameters -->
    <div class="card page-section" id="params-card">
      <div class="card__header">
        <span class="card__header-icon">⚙️</span>
        <h2 class="card__title">训练参数</h2>
      </div>
      <div class="card__body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">训练轮数 (Epochs) <span data-tooltip="训练多少轮：轮数越多效果可能越好，但更耗时。建议 100~300 轮。">ⓘ</span></label>
            <div class="slider-row">
              <input type="range" min="1" max="1000" value="100" />
              <input type="number" min="1" max="1000" value="100" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">批次大小 (Batch Size) <span data-tooltip="每批处理图片数：显存不足时可调小。建议 8~32。">ⓘ</span></label>
            <div class="slider-row">
              <input type="range" min="1" max="256" value="16" />
              <input type="number" min="1" max="256" value="16" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">图像尺寸 <span data-tooltip="输入图片缩放到的尺寸（像素）。保持默认 640 即可。">ⓘ</span></label>
            <div class="slider-row">
              <input type="range" min="320" max="1280" value="640" step="32" />
              <input type="number" min="320" max="1280" value="640" step="32" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">计算设备 <span data-tooltip="自动选择最优设备（优先 GPU）。也可手动指定。">ⓘ</span></label>
            <select class="form-select">
              <option>auto (推荐)</option>
              <option>CPU</option>
              <option disabled>───</option>
              <option>NVIDIA GeForce RTX 4070 Ti SUPER (16 GB)</option>
            </select>
            <span class="form-hint" style="margin-top:2px">可用显存: 14.2 GB / 16 GB</span>
          </div>
        </div>
      </div>
      <div id="collapsible-optimizer"></div>
      <div id="collapsible-advanced" style="margin-top:0"></div>
    </div>

    <!-- Action Bar -->
    <div class="page-actions">
      <button class="btn btn--ghost btn--sm" id="btn-sim-complete" title="开发测试用：模拟训练完成">🧪 模拟完成</button>
      <div style="flex:1"></div>
      <button class="btn btn--primary" id="btn-start-training" disabled>🚀 开始训练</button>
    </div>
  `;

  // Collapsible: Optimizer params
  const optContent = document.createElement('div');
  optContent.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">优化器类型</label>
        <select class="form-select"><option>AdamW</option><option>SGD</option><option>Adam</option></select>
      </div>
      <div class="form-group">
        <label class="form-label">初始学习率</label>
        <div class="slider-row">
          <input type="range" min="0.00001" max="0.1" value="0.001" step="0.0001" />
          <input type="number" min="0.00001" max="0.1" value="0.001" step="0.0001" style="width:88px" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">动量 (Momentum)</label>
        <div class="slider-row">
          <input type="range" min="0" max="1" value="0.937" step="0.001" />
          <input type="number" min="0" max="1" value="0.937" step="0.001" style="width:88px" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">权重衰减</label>
        <div class="slider-row">
          <input type="range" min="0" max="0.01" value="0.0005" step="0.0001" />
          <input type="number" min="0" max="0.01" value="0.0005" step="0.0001" style="width:88px" />
        </div>
      </div>
    </div>
  `;
  createCollapsible({ container: form.querySelector('#collapsible-optimizer'), title: '优化器参数', subtitle: '(可跳过)', defaultOpen: false, content: optContent });

  // Collapsible: Advanced params
  const advContent = document.createElement('div');
  advContent.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">早停耐心 (Early Stopping)</label>
        <input type="number" class="form-input" value="50" min="0" max="500" style="width:100px" />
        <span class="form-hint">N 轮无提升后自动停止，0 = 关闭</span>
      </div>
      <div class="form-group">
        <label class="form-label">Mosaic 增强</label>
        <div class="checkbox-row"><input type="checkbox" checked /> 开启（四图拼接训练）</div>
      </div>
      <div class="form-group">
        <label class="form-label">MixUp 增强</label>
        <div class="checkbox-row"><input type="checkbox" /> 开启（双图混合训练）</div>
      </div>
      <div class="form-group">
        <label class="form-label">水平翻转概率</label>
        <div class="slider-row">
          <input type="range" min="0" max="1" value="0.5" step="0.1" />
          <input type="number" min="0" max="1" value="0.5" step="0.1" style="width:72px" />
        </div>
      </div>
    </div>
  `;
  createCollapsible({ container: form.querySelector('#collapsible-advanced'), title: '高级参数', subtitle: '(可跳过)', defaultOpen: false, content: advContent });

  // Wire slider-number sync
  form.querySelectorAll('.slider-row').forEach(row => {
    const range = row.querySelector('input[type="range"]');
    const number = row.querySelector('input[type="number"]');
    if (range && number) {
      range.addEventListener('input', () => { number.value = range.value; });
      number.addEventListener('input', () => { range.value = number.value; });
    }
  });

  return form;
}

function buildTrainingView() {
  const view = document.createElement('div');
  view.className = 'page-training-view';

  view.innerHTML = `
    <!-- Locked params overlay -->
    <div class="card page-section" style="position:relative">
      <div class="overlay">
        <div class="overlay__text">🔒 训练参数在训练过程中不可修改</div>
      </div>
      <div class="card__header">
        <span class="card__header-icon">📋</span>
        <h2 class="card__title">任务信息</h2>
      </div>
      <div class="card__body" style="opacity:0.5">
        <p style="color:var(--text-secondary)">任务：我的第一个模型 | 数据集：game_ui_v2 | 模型：yolov8n.pt</p>
        <p style="color:var(--text-muted);font-size:var(--fs-caption)">轮数: 100 · 批次: 16 · 图像: 640 · 设备: auto</p>
      </div>
    </div>

    <!-- Training Progress Card -->
    <div class="card page-section">
      <div class="card__header">
        <span class="card__header-icon">📊</span>
        <h2 class="card__title">训练进度</h2>
      </div>
      <div class="card__body">
        <div class="progress-bar">
          <div class="progress-bar__fill" id="training-progress-fill" style="width:0%"></div>
        </div>
        <div class="progress-bar__label" id="training-progress-label">0 / 100 epochs · 0% · 估算剩余: --</div>

        <div style="margin-top:16px">
          <h3 style="font-size:var(--fs-body);color:var(--text-secondary);margin-bottom:8px">近期指标</h3>
          <div class="table-wrapper" style="max-height:180px;overflow-y:auto">
            <table class="data-table" id="metrics-table">
              <thead><tr><th>轮次</th><th>Loss</th><th>mAP50</th><th>mAP50-95</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div style="margin-top:16px">
          <h3 style="font-size:var(--fs-body);color:var(--text-secondary);margin-bottom:8px">训练日志</h3>
          <div class="log-terminal" id="training-log">
            <div class="log-terminal__line"><span class="log-terminal__line--time">14:30:01</span> Starting training for 100 epochs...</div>
            <div class="log-terminal__line"><span class="log-terminal__line--time">14:30:05</span> Epoch 1/100 ─ loss: 2.34, mAP50: 0.123</div>
          </div>
        </div>
      </div>
      <div class="card__footer" style="justify-content:flex-start">
        <button class="btn btn--ghost" id="btn-stop-training">⏹ 停止训练</button>
        <button class="btn btn--ghost">📂 打开输出文件夹</button>
      </div>
    </div>
  `;

  return view;
}

function buildCompleteView() {
  const view = document.createElement('div');
  view.className = 'page-complete-view';

  view.innerHTML = `
    <!-- Celebration -->
    <div style="text-align:center;padding:20px 0;font-size:var(--fs-h2);color:var(--color-success)">
      🎉 训练完成！
    </div>

    <!-- Results Summary Card -->
    <div class="card page-section">
      <div class="card__header">
        <span class="card__header-icon">📊</span>
        <h2 class="card__title">训练结果摘要</h2>
      </div>
      <div class="card__body">
        <div class="metrics-row">
          <div class="metric-card">
            <div class="metric-card__value">0.876</div>
            <div class="metric-card__label">最佳 mAP50</div>
          </div>
          <div class="metric-card">
            <div class="metric-card__value">0.623</div>
            <div class="metric-card__label">最佳 mAP50-95</div>
          </div>
          <div class="metric-card">
            <div class="metric-card__value">100</div>
            <div class="metric-card__label">总轮次</div>
          </div>
          <div class="metric-card">
            <div class="metric-card__value">2h 34m</div>
            <div class="metric-card__label">总用时</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Validation Predictions Card -->
    <div class="card page-section">
      <div class="card__header">
        <span class="card__header-icon">🖼️</span>
        <h2 class="card__title">验证集预测样本</h2>
      </div>
      <div class="card__body">
        <div style="display:flex;gap:12px;overflow-x:auto">
          ${[1,2,3,4,5].map(i => `
            <div style="flex-shrink:0;width:160px;height:120px;background:var(--bg-inset);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:var(--fs-caption)">预测图 ${i}</div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="page-actions">
      <button class="btn btn--secondary" id="btn-retrain">🔄 重新训练</button>
      <button class="btn btn--secondary">📥 下载模型</button>
      <button class="btn btn--secondary">📋 导出报告</button>
      <button class="btn btn--primary" id="btn-goto-inference">🔍 用此模型进行推理测试 →</button>
    </div>
  `;

  return view;
}

/* ══════════════════════════════════════════════
   STATE TRANSITIONS
   ══════════════════════════════════════════════ */

function showTrainingState(page, formView, trainingView) {
  formView.style.display = 'none';
  trainingView.style.display = '';

  // Hide complete view if visible
  const completeView = page.querySelector('.page-complete-view');
  if (completeView) completeView.style.display = 'none';

  bus.dispatchEvent(new CustomEvent(EVENTS.SIDEBAR_STATUS, {
    detail: { status: 'training', detail: '我的第一个模型' }
  }));
}

function showCompleteState(page, formView, trainingView, completeView) {
  formView.style.display = 'none';
  trainingView.style.display = 'none';
  completeView.style.display = '';
}

function resetToForm(page, formView, trainingView, completeView) {
  formView.style.display = '';
  trainingView.style.display = 'none';
  completeView.style.display = 'none';

  // Reset progress
  const fill = trainingView.querySelector('#training-progress-fill');
  if (fill) fill.style.width = '0%';
  const label = trainingView.querySelector('#training-progress-label');
  if (label) label.textContent = '0 / 100 epochs · 0% · 估算剩余: --';

  bus.dispatchEvent(new CustomEvent(EVENTS.SIDEBAR_STATUS, {
    detail: { status: 'ready' }
  }));
}

function updateTrainingMetrics(trainingView, epoch, totalEpochs) {
  const pct = Math.round((epoch / totalEpochs) * 100);
  const fill = trainingView.querySelector('#training-progress-fill');
  if (fill) fill.style.width = `${pct}%`;

  const label = trainingView.querySelector('#training-progress-label');
  if (label) label.textContent = `${epoch} / ${totalEpochs} epochs · ${pct}% · 估算剩余: ${Math.round((totalEpochs - epoch) * 1.5)}m`;

  // Add log line
  const log = trainingView.querySelector('#training-log');
  const loss = (2.5 - (epoch / totalEpochs) * 1.8 + Math.random() * 0.3).toFixed(3);
  const mAP = (0.1 + (epoch / totalEpochs) * 0.75 + Math.random() * 0.05).toFixed(3);
  const mAP95 = (mAP - 0.25).toFixed(3);
  if (log) {
    const line = document.createElement('div');
    line.className = 'log-terminal__line';
    line.innerHTML = `<span class="log-terminal__line--time">${new Date().toLocaleTimeString()}</span> Epoch ${epoch}/${totalEpochs} ─ loss: ${loss}, mAP50: ${mAP}, mAP50-95: ${mAP95}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // Update metrics table
  const tbody = trainingView.querySelector('#metrics-table tbody');
  if (tbody) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${epoch}</td><td>${loss}</td><td>${mAP}</td><td>${mAP95}</td>`;
    tbody.appendChild(row);
    // Keep last 10
    while (tbody.children.length > 10) tbody.firstChild.remove();
  }
}
