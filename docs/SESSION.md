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

阶段二：Python 引擎（Week 2–4）—— 脚本已完成，待联调验证

## 上次做到

- 全部 8 份项目文档已定稿，基线已冻结（2026-07-18）
- **阶段一全部完成并验证通过**
- **阶段二 Python 脚本已全部创建**：
  - dataset_check.py (D-001~D-007E, 15 codes)
  - model_check.py (M-001~M-004E, 9 codes)
  - infer.py (I-001~I-007E, 15 codes)
  - train.py (T-001~T-308, 43 codes: 训练+暂停+恢复+停止+报告)
- Rust commands 已接线（check_dataset, check_model, run_inference）
- 前端 api.js 已接线（全部 4 个 API 调用真实 Rust→Python 链路）

## 下一步

1. cargo tauri dev 联调验证：新建训练页的校验数据集/校验模型功能
2. 真实训练验证：用小数据集跑通完整 train.py 流程
3. 训练进度前端实时更新（train:line Events → 进度条/日志/指标表）

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
