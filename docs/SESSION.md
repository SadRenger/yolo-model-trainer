# 当前会话状态

> AI 开发者每次启动时，读路由表后再读本文件，即可恢复上下文。
>
> **维护规则：** 每次完成一个任务后**必须**更新本文件。不超过 1 页。
>
> **⚠️ 强制规则：** AI 在以下时机**必须**更新 SESSION.md，不可跳过：
> 1. 完成一个任务/模块后 → 更新"上次做到"和"下一步"
> 2. 发现一个新问题但暂不修复 → 追加到"已知问题"
> 3. 基线冻结确认 → 在"环境快照"表下追加"基线冻结：需求 🔒 | 设计风格/UI 🔐 | YYYY-MM-DD"
> 4. 提交了未经人类确认的技术决策 → 追加到"未经确认的决策"
> 5. 提交了变更请求并正在等待回复 → 追加到"待回复的变更请求"
>
> **⚠️ AI 启动时的自检：** 读本文件后，必须对比 SESSION 更新时间与最新 git commit 时间。如果差异 > 1 天且项目有新的 commit → SESSION 可能过时，先运行 `git log --oneline -5` 了解最新变更，再开始工作。

---

## 当前阶段

阶段二：Python 引擎（Week 2–4）—— 待开工

## 上次做到

- 全部 8 份项目文档已定稿，基线已冻结（2026-07-18）
- **阶段一全部 5 个子任务完成并通过端到端验证**：
  - 1.1 Tauri 2.x 骨架 (cargo build 通过)
  - 1.2 前端基础结构 (侧边栏 + 4 页面 + 全局组件，cargo tauri dev 验证)
  - 1.3 嵌入 Python 3.13 (process_manager + find_python)
  - 1.4 Rust↔Python IPC (stdin/stdout JSONL 管道，已验证)
  - 1.5 Rust↔前端事件 (Tauri Commands + Events，已验证)
- **端到端链路验证通过**：设置页 🔄 → invoke → Rust spawn → Python env_check.py → JSONL stdout → Event → 前端显示真实 GPU/磁盘数据

## 下一步（阶段二：Python 引擎）

1. Python 脚本补充：dataset_check.py, model_check.py, train.py, infer.py
2. 训练进度实时推送：train:line Events → 前端进度条/日志/指标表联动

## 已知问题

- **Tauri 2.x 自定义协议不支持 ES modules** → 全部 JS 使用 `window.App` 全局命名空间
- **Windows 管道不支持 UTF-8 中文直接写入** → protocol.py 使用 `ensure_ascii=True`
- **cargo tauri dev CWD 是 src-tauri/** → 路径需 `../python/` 前缀

## 环境快照

| 检查项 | 状态 | 备注 |
|---|---|---|
| Rust | ✅ | rustc 1.97.1, stable-x86_64-pc-windows-msvc |
| Node.js | ✅ | v24.16.0 |
| Python | ✅ | 3.13.2 |
| 虚拟环境 | ✅ | venv\ 已创建，torch 2.6.0+cu124, ultralytics 8.4.71, CUDA 可用 (RTX 4070 Ti SUPER) |
| Tauri CLI | ✅ | 2.11.4 |
| VS Build Tools | ✅ | cl.exe 19.51.36248 for x64 (VS 2026 BuildTools) |
| NSIS | ⚠️ 未安装 | 打包阶段才需要 |
| Git | ✅ | 已同步 github.com:SadRenger/yolo-model-trainer, main 分支 |

## 基线冻结

> 🔒 需求 v2.0 硬冻结 | 🔐 设计风格 / UI 模型 软冻结 | 📅 2026-07-18
>
> 此后，文档优先于代码：任何偏离必须先提变更请求（按路由表 4.1 变更请求模板）。

## 最近测试结果

（暂无——项目尚未开始编码）

## 未经确认的决策

（暂无）

## 待回复的变更请求

（暂无）

---

*最后更新：2026-07-18*
