/* ═══════════════════════════════════════════════════
   YOLO Model Trainer — Page: Training History
   States: populated | empty
   ═══════════════════════════════════════════════════ */

import { bus, EVENTS } from '../events.js';
import * as api from '../api.js';

export async function mount(container, params = {}) {
  const page = document.createElement('div');
  page.className = 'page page-training-history';

  // Page title
  const title = document.createElement('h1');
  title.className = 'page-title';
  title.textContent = '训练历史';
  page.appendChild(title);

  // Load mock data
  const tasks = await api.getTaskHistory();

  if (tasks.length === 0) {
    page.appendChild(buildEmptyState());
  } else {
    page.appendChild(buildPopulatedView(tasks));
  }

  container.appendChild(page);

  return () => page.remove();
}

function buildPopulatedView(tasks) {
  const view = document.createElement('div');

  // Filter bar
  const filterBar = document.createElement('div');
  filterBar.className = 'filter-bar';
  filterBar.innerHTML = `
    <div class="form-group" style="flex:1;min-width:180px">
      <input type="text" class="form-input" placeholder="🔍 搜索任务…" />
    </div>
    <select class="form-select" style="width:auto">
      <option>全部状态 ▾</option>
      <option>已完成</option>
      <option>已停止</option>
      <option>异常中断</option>
    </select>
    <select class="form-select" style="width:auto">
      <option>按时间 ▾</option>
      <option>按名称</option>
    </select>
  `;
  view.appendChild(filterBar);

  // Table
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper';
  tableWrapper.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:32px"><input type="checkbox" /></th>
          <th>任务名称</th>
          <th>日期</th>
          <th>状态</th>
          <th>mAP50</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(t => `
          <tr>
            <td><input type="checkbox" /></td>
            <td>${t.name}</td>
            <td style="color:var(--text-secondary)">${t.date}</td>
            <td>${renderStatusBadge(t.status)}</td>
            <td style="color:var(--color-purple);font-weight:var(--fw-heading)">${t.mAP50}</td>
            <td>${renderActions(t)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  view.appendChild(tableWrapper);

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:16px';
  footer.innerHTML = `
    <span style="font-size:var(--fs-caption);color:var(--text-muted)">共 ${tasks.length} 条记录</span>
    <button class="btn btn--ghost btn--sm" style="color:var(--color-danger)">🗑 删除选中</button>
  `;
  view.appendChild(footer);

  // Wire resume buttons to navigate to new-training
  view.querySelectorAll('.btn-resume').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = btn.dataset.taskId;
      bus.dispatchEvent(new CustomEvent(EVENTS.NAVIGATE, {
        detail: { hash: '#/new-training', params: { resume: taskId } }
      }));
    });
  });

  return view;
}

function buildEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-state__icon">📭</div>
    <div class="empty-state__text">还没有训练记录</div>
    <a class="btn btn--primary" href="#/new-training">📊 去新建训练 →</a>
  `;
  return div;
}

/* ── Helpers ── */

function renderStatusBadge(status) {
  const map = {
    completed: { class: 'tag--success', label: '✅ 已完成' },
    stopped:   { class: 'tag--warning', label: '⏸ 已停止' },
    error:     { class: 'tag--error',   label: '❌ 异常中断' },
  };
  const info = map[status] || { class: 'tag--info', label: status };
  return `<span class="tag ${info.class}">${info.label}</span>`;
}

function renderActions(task) {
  const base = `
    <button class="btn btn--ghost btn--sm" title="查看报告">📄</button>
    <button class="btn btn--ghost btn--sm" title="下载模型">📥</button>
  `;

  if (task.status === 'stopped' || task.status === 'error') {
    return base + `<button class="btn btn--ghost btn--sm btn-resume" data-task-id="${task.id}" title="断点续训" style="color:var(--color-primary)">🔄</button>
                   <button class="btn btn--ghost btn--sm" title="删除">🗑</button>`;
  }

  return base + `<button class="btn btn--ghost btn--sm" title="删除">🗑</button>`;
}
