/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Page: Settings
   Static: 3 cards (Global Config, Environment, Model Guide)
   ═══════════════════════════════════════════════════ */

import { bus, EVENTS } from '../events.js';
import * as api from '../api.js';

export async function mount(container, params = {}) {
  const page = document.createElement('div');
  page.className = 'page page-settings';

  // Page title
  const title = document.createElement('h1');
  title.className = 'page-title';
  title.textContent = '设置';
  page.appendChild(title);

  /* ── Card: Global Config ── */
  const configCard = document.createElement('div');
  configCard.className = 'card page-section';
  configCard.innerHTML = `
    <div class="card__header">
      <span class="card__header-icon">📁</span>
      <h2 class="card__title">全局配置</h2>
    </div>
    <div class="card__body">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">默认输出目录</label>
          <div style="display:flex;gap:8px">
            <input type="text" class="form-input" value="C:\\Users\\User\\YOLO_Output" style="flex:1" />
            <button class="btn btn--secondary btn--sm">浏览</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">日志级别</label>
          <select class="form-select">
            <option>详细 (推荐)</option>
            <option>标准</option>
            <option>简洁</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card__footer">
      <button class="btn btn--primary btn--sm">保存设置</button>
    </div>
  `;
  page.appendChild(configCard);

  /* ── Card: System Environment ── */
  const envCard = document.createElement('div');
  envCard.className = 'card page-section';
  envCard.innerHTML = `
    <div class="card__header">
      <span class="card__header-icon">💻</span>
      <h2 class="card__title">系统环境</h2>
      <button class="btn btn--ghost btn--sm" id="btn-refresh-env" style="margin-left:auto">🔄 重新检测</button>
    </div>
    <div class="card__body" id="env-status-list">
      <div class="empty-state"><div class="spinner"></div><p style="color:var(--text-muted);margin-top:8px">检测中…</p></div>
    </div>
  `;
  page.appendChild(envCard);

  /* ── Card: Model Download Guide ── */
  const guideCard = document.createElement('div');
  guideCard.className = 'card page-section';
  guideCard.innerHTML = `
    <div class="card__header">
      <span class="card__header-icon">📖</span>
      <h2 class="card__title">模型下载指引</h2>
    </div>
    <div class="card__body">
      <p style="color:var(--text-secondary);margin-bottom:12px">请从以下官方地址下载 YOLO 预训练权重文件（.pt 格式）：</p>

      <h3 style="font-size:var(--fs-body);color:var(--text-primary);margin-bottom:8px">YOLOv8</h3>
      <p style="color:var(--text-secondary);margin-bottom:8px">
        <a href="https://github.com/ultralytics/assets/releases" target="_blank">https://github.com/ultralytics/assets/releases</a>
      </p>

      <h3 style="font-size:var(--fs-body);color:var(--text-primary);margin-bottom:8px">YOLOv11</h3>
      <p style="color:var(--text-secondary);margin-bottom:8px">
        <a href="https://github.com/ultralytics/assets/releases" target="_blank">https://github.com/ultralytics/assets/releases</a>
      </p>

      <h3 style="font-size:var(--fs-body);color:var(--text-primary);margin:16px 0 8px">版本选择建议</h3>
      <table class="data-table">
        <thead><tr><th>版本</th><th>参数量</th><th>适用数据量</th><th>推荐场景</th></tr></thead>
        <tbody>
          <tr><td>n (nano)</td><td>3.2M</td><td>&lt;1,000</td><td>快速验证、移动端部署</td></tr>
          <tr><td>s (small)</td><td>11.2M</td><td>1,000~5,000</td><td>小规模目标检测</td></tr>
          <tr><td>m (medium)</td><td>25.9M</td><td>5,000~20,000</td><td>中等规模，精度与速度平衡</td></tr>
          <tr><td>l (large)</td><td>43.7M</td><td>20,000~100,000</td><td>大规模，高精度要求</td></tr>
          <tr><td>x (xlarge)</td><td>68.2M</td><td>&gt;100,000</td><td>最高精度，不计推理时间</td></tr>
        </tbody>
      </table>
    </div>
  `;
  page.appendChild(guideCard);

  /* ── Load environment status ── */
  const envList = envCard.querySelector('#env-status-list');
  const loadEnv = async () => {
    envList.innerHTML = '<div class="empty-state"><div class="spinner"></div><p style="color:var(--text-muted);margin-top:8px">检测中…</p></div>';
    try {
      const env = await api.checkEnvironment();
      envList.innerHTML = `
        <div class="env-item">
          <span class="env-item__icon">✅</span>
          <span class="env-item__label">Python 环境</span>
          <span class="env-item__value">${env.python.version} — 就绪</span>
        </div>
        <div class="env-item">
          <span class="env-item__icon">✅</span>
          <span class="env-item__label">PyTorch</span>
          <span class="env-item__value">${env.pytorch.version} — CUDA: ${env.pytorch.cuda_available ? '可用' : '不可用'}</span>
        </div>
        ${env.gpu.map(gpu => `
          <div class="env-item">
            <span class="env-item__icon">✅</span>
            <span class="env-item__label">GPU</span>
            <span class="env-item__value">${gpu.name} · 总 ${gpu.vram_total} · 可用 ${gpu.vram_available}</span>
          </div>
        `).join('')}
        <div class="env-item">
          <span class="env-item__icon">✅</span>
          <span class="env-item__label">磁盘空间</span>
          <span class="env-item__value">系统盘: ${env.disk.system_free} 可用 · 输出盘: ${env.disk.output_free} 可用</span>
        </div>
        <div style="margin-top:12px;padding:8px 12px;background:rgba(88,166,255,0.08);border-radius:var(--radius-sm);font-size:var(--fs-caption);color:var(--color-success)">
          ✅ 所有检测项正常，环境就绪
        </div>
      `;
    } catch (err) {
      envList.innerHTML = `<div style="color:var(--color-danger)">❌ 环境检测失败：${err.message}</div>`;
    }
  };

  // Initial load
  loadEnv();

  // Refresh button
  envCard.querySelector('#btn-refresh-env').addEventListener('click', loadEnv);

  container.appendChild(page);

  return () => page.remove();
}
