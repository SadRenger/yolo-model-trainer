# YOLO 模型训练工具 — 开发计划书

------

## 一、项目概述

基于《需求文档 2.0》和《前端 UI 模型图 2.0》，本项目为 Windows 桌面端的 YOLO 模型训练工具，采用 Tauri 2.x + 原生前端 + Python 后端的混合架构。本文档定义从零到交付的完整开发计划。

### 1.1 技术栈确认

| 层级 | 技术 | 版本要求 |
|:---|:---|:---|
| 桌面框架 | Tauri | 2.x |
| 前端 | HTML5 + CSS3 + 原生 JavaScript | — |
| 后端引擎 | Python（嵌入式） | 3.13 |
| 深度学习框架 | PyTorch + Ultralytics | PyTorch == 2.6.0+cu124, Ultralytics == 8.3.50 |
| 安装包 | NSIS | ≥ 3.0 |
| 开发语言（Rust 侧） | Rust | stable（与 Tauri 2.x 兼容的最新版） |

### 1.2 项目规模估算

| 维度 | 估算 |
|:---|:---|
| 总开发周期 | 8 周（不含需求确认和设计阶段） |
| 前端页面数 | 4 个主页面 + 弹窗/Toast 等全局组件 |
| Python 后端模块 | 5 个独立模块 |
| Rust 后端模块 | 进程管理、事件总线、文件系统、环境检测等 |
| 安装包体积目标 | < 1.2 GB（安装后约占用 2.5GB 磁盘空间） |

------

## 二、开发阶段总览

```
阶段一: 工程搭建        (Week 1)
阶段二: Python 引擎     (Week 2–3)
阶段三: Rust 后端       (Week 3–4)
阶段四: 前端 UI         (Week 4–6)
阶段五: 联调集成        (Week 6–7)
阶段六: 打包与测试      (Week 7–8)
```

阶段二、三、四可部分并行开发。

------

## 三、阶段一：工程搭建（Week 1）

### 3.1 目标

建立可运行的项目骨架，确保三端（前端、Rust、Python）的通信链路通畅。

### 3.2 任务清单

| # | 任务 | 产出 | 估时 |
|:---|:---|:---|:---|
| 1.1 | 初始化 Tauri 2.x 项目 | 项目骨架，`cargo tauri dev` 可启动 | 0.5天 |
| 1.2 | 搭建前端基础结构 | 侧边栏导航框架 + 4 个页面路由（原生 JS SPA，无框架） | 1天 |
| 1.3 | 嵌入 Python 3.13 运行时 | Python 可执行文件嵌入 Tauri 资源目录，Rust 侧可启动 Python 子进程 | 1.5天 |
| 1.4 | 建立 Rust ↔ Python IPC 通信 | Rust 通过管道收发 stdin/stdout，验证"发命令 → Python 执行 → 返回结果"链路 | 1天 |
| 1.5 | 建立 Rust ↔ 前端事件通信 | Tauri Command（前端调用 Rust）+ Tauri Event（Rust 推送前端） | 0.5天 |
| 1.6 | 配置 NSIS 打包脚本基础版 | 可产出最小可安装 .exe（先不嵌入 Python 全量依赖） | 0.5天 |

### 3.3 阶段验证标准

- `cargo tauri dev` 启动后可见侧边栏导航和 4 个空白页面
- Rust 可启动 Python 子进程，执行 `print("hello")`，Rust 可读到 stdout
- 前端通过 Tauri Command 调用 Rust 函数，Rust 通过 Event 推送数据到前端
- NSIS 可生成 .exe 安装包并成功安装

------

## 四、阶段二：Python 引擎（Week 2–3）

### 4.1 目标

开发所有 Python 后端模块，每个模块为独立脚本，通过命令行参数接收指令，通过 stdout 输出 JSON 行协议，stderr 输出错误信息。

### 4.2 模块清单

#### 模块 1：环境检测 (`env_check.py`)

| 项目 | 说明 |
|:---|:---|
| 功能 | 检测 Python 版本、PyTorch 版本、CUDA 可用性、GPU 列表及显存、磁盘空间 |
| 输入 | 无参数 |
| 输出格式 | JSON（一行） |
| 输出内容 | `{ python_ver, pytorch_ver, cuda_available, cuda_ver, gpus: [{name, total_mem, free_mem}], disks: [{path, total, free}] }` |

#### 模块 2：数据集校验 (`dataset_check.py`)

| 项目 | 说明 |
|:---|:---|
| 功能 | 校验 YOLO 数据集格式：目录结构（images/labels）、data.yaml 完整性、标签文件与图片的对应关系、标签格式合法性 |
| 输入 | `--dataset-path <路径>` |
| 输出 | `{ valid: bool, errors: [{level: "error"/"warning", message, files[]}], stats: { total_images, total_labels, categories: [] } }` |

#### 模块 3：训练执行 (`train.py`)

| 项目 | 说明 |
|:---|:---|
| 功能 | 执行 YOLO 训练，支持暂停/恢复/停止信号，实时输出日志和指标 |
| 输入参数 | 所有训练参数通过命令行传入（`--epochs 100 --batch-size 16 ...`） |
| 实时输出 | 每轮一行 JSON：`{ type: "progress", epoch, total_epochs, loss, mAP50, mAP50_95, lr }` |
| 事件输出 | `{ type: "started" }` `{ type: "completed", best_mAP50, best_mAP50_95, total_time }` `{ type: "stopped" }` `{ type: "error", message }` |
| 信号接收 | 通过 stdin 接收控制命令：`pause` `resume` `stop` |
| 报告生成 | 训练完成后读取 metrics 数据，生成 HTML 报告文件 |
| 断点续训 | 指定 `--resume <checkpoint_path>` 时从断点继续。断点续训使用 `last.pt` 作为 checkpoint 文件（`last.pt` 包含完整训练状态：模型权重、优化器状态、轮次计数等），而非原始预训练模型 |

> **参数映射策略：** 前端仅暴露需求文档 3.1.2 列出的参数（核心参数 + 优化器参数 + 高级增强参数），未在前端列出的 Ultralytics 参数（如 AdamW 的 `betas`/`amsgrad`、SGD 的 `nesterov` 等）使用 Ultralytics 官方默认值，不向前端暴露。Python 引擎在接收参数时负责合并前端传入值和默认值。

#### 模块 4：模型校验 (`model_check.py`)

| 项目 | 说明 |
|:---|:---|
| 功能 | 检查 .pt 文件能否被 Ultralytics 正常加载，提取模型基本信息 |
| 输入 | `--model-path <路径>` |
| 输出 | `{ valid: bool, model_type, params_count, file_size_mb, error_message? }` |

#### 模块 5：推理执行 (`infer.py`)

| 项目 | 说明 |
|:---|:---|
| 功能 | 加载模型，对单张图片执行目标检测，返回结果 |
| 输入 | `--model-path <路径> --image-path <路径> --conf <阈值> --iou <阈值> --imgsz <尺寸>` |
| 输出 | `{ detections: [{class, confidence, bbox: [x1,y1,x2,y2]}], stats: { total, inference_time_ms, input_size, inference_size, conf_threshold, iou_threshold } }` |

#### 模块 6：模型导出 (`export.py`，可选)

| 项目 | 说明 |
|:---|:---|
| 功能 | 将 .pt 模型导出为 ONNX 等格式 |
| 输入 | `--model-path <路径> --format <onnx\|tflite\|...>` |
| 输出 | `{ success: bool, output_path, error_message? }` |

### 4.3 JSON 行协议规范

所有 Python 模块遵循统一通信协议：

- **命令行调用**：通过 `--参数名 参数值` 传递
- **stdout**：每行一条 JSON 消息（JSONL 格式）
- **stderr**：仅用于 Python 级别的致命错误（进程崩溃），不对用户展示
- **stdin**：接收运行时控制命令（仅训练引擎需要）
- **退出码**：0 = 正常完成，1 = 预期内错误（如格式校验失败），-1 = 未预期异常

### 4.4 阶段验证标准

- 每个模块可独立在命令行调用并返回正确 JSON
- 数据集校验对合法/非法数据集分别返回正确结果
- 训练引擎可完整跑通一个小数据集（如 10 张图的 MNIST 格式），输出实时日志和最终报告
- 推理引擎对有效模型和图片返回正确检测结果

------

## 五、阶段三：Rust 后端（Week 3–4）

### 5.1 目标

实现 Tauri 后端的核心业务逻辑：进程管理、事件路由、文件系统操作、持久化存储。

### 5.2 模块清单

#### 模块 1：进程管理器 (`process_manager`)

| 功能 | 说明 |
|:---|:---|
| 启动 Python 子进程 | `spawn_python(script: &str, args: &[String]) -> ChildProcess` |
| stdin 写命令 | 向训练进程发送 `pause` / `resume` / `stop` |
| stdout 逐行读取 | 非阻塞读取，每读到一行 JSON 立即通过 Tauri Event 推送到前端 |
| 进程状态监控 | 检测进程正常退出 / 崩溃退出，分别推送不同事件 |
| 进程超时处理 | 推理进程超时 30s 自动 kill |

#### 模块 2：事件总线 (`event_bus`)

| 事件名 | 方向 | 携带数据 |
|:---|:---|:---|
| `train:progress` | Rust → 前端 | `{ epoch, total_epochs, loss, mAP50, mAP50_95, lr }` |
| `train:log` | Rust → 前端 | `{ timestamp, message }` |
| `train:completed` | Rust → 前端 | `{ best_mAP50, best_mAP50_95, total_time, output_dir }` |
| `train:stopped` | Rust → 前端 | `{ epoch, output_dir }` |
| `train:error` | Rust → 前端 | `{ error_message, output_dir }` |
| `env:check:result` | Rust → 前端 | `{ python, pytorch, gpus[], disks[] }` |
| `dataset:check:result` | Rust → 前端 | `{ valid, errors[], stats }` |
| `infer:result` | Rust → 前端 | `{ detections[], stats }` |
| `infer:error` | Rust → 前端 | `{ error_message }` |

#### 模块 3：Tauri Commands（前端调用的 Rust 函数）

| Command | 说明 |
|:---|:---|
| `check_environment` | 启动 `env_check.py`，返回环境检测结果 |
| `check_dataset(path)` | 启动 `dataset_check.py`，返回校验结果 |
| `check_model(path)` | 启动 `model_check.py`，返回模型校验结果 |
| `start_training(config)` | 启动 `train.py`，开始训练，返回训练任务 ID |
| `pause_training(task_id)` | 向训练进程 stdin 发送 `pause` |
| `resume_training(task_id)` | 向训练进程 stdin 发送 `resume` |
| `stop_training(task_id)` | 向训练进程 stdin 发送 `stop` |
| `run_inference(config)` | 启动 `infer.py`，返回推理结果 |
| `export_model(path, format)` | 启动 `export.py`，返回导出结果 |
| `get_task_history` | 读取本地存储，返回历史任务列表 |
| `delete_task(task_id)` | 删除指定任务记录和关联文件 |
| `delete_tasks(task_ids[])` | 批量删除指定任务记录和关联文件 |
| `get_settings` | 读取设置 |
| `save_settings(settings)` | 保存设置 |

#### 模块 4：持久化存储

| 存储项 | 格式 | 位置 |
|:---|:---|:---|
| 训练历史 | JSON 文件 | `{output_dir}/history.json` |
| 用户设置 | JSON 文件 | `{app_data_dir}/settings.json` |
| 训练 metrics | CSV / JSON（Ultralytics 原生格式） | `{output_dir}/{task_name}/` |

### 5.3 阶段验证标准

- 前端调用 `check_environment` 可在 5 秒内获得环境检测结果
- 前端调用 `start_training` 后持续收到 `train:progress` 事件（用 mock Python 脚本测试）
- 前端调用 `pause/resume/stop` 可控制训练进程
- 历史记录增删查功能正常

------

## 六、阶段四：前端 UI（Week 4–6）

### 6.1 目标

按照《前端 UI 模型图 2.0》实现全部界面，覆盖所有交互状态。

### 6.2 前端架构

```
前端项目结构:
├── index.html              # 入口页面
├── css/
│   ├── variables.css       # CSS 变量（颜色、间距、字号、主题）
│   ├── layout.css          # 主布局（侧边栏 + 内容区）
│   ├── components.css      # 通用组件（按钮、输入框、下拉框、滑块、Tooltip、Toast）
│   └── pages.css           # 页面特定样式
├── js/
│   ├── app.js              # 应用入口、路由、Tauri 事件监听
│   ├── router.js           # 简易 SPA 路由
│   ├── api.js              # Tauri Command 封装层
│   ├── state.js            # 全局状态管理
│   ├── components/         # 通用组件
│   │   ├── sidebar.js      # 侧边栏（导航 + 状态灯 + 磁盘空间）
│   │   ├── toast.js        # Toast 通知
│   │   ├── modal.js        # 模态弹窗
│   │   ├── tooltip.js      # Tooltip
│   │   ├── slider.js       # 滑块控件
│   │   ├── file-picker.js  # 文件/文件夹浏览按钮
│   │   ├── progress.js     # 进度条
│   │   └── log-terminal.js # 日志终端
│   └── pages/
│       ├── new-training.js # 新建训练页
│       ├── training-history.js # 训练历史页
│       ├── inference.js    # 推理测试页
│       └── settings.js     # 设置页
└── assets/
    ├── logo.svg
    └── icons/              # 页面图标
```

### 6.3 页面开发清单

#### 6.3.1 全局组件

| 组件 | 要求 |
|:---|:---|
| 侧边栏 | 导航切换、环境状态指示灯（绿/黄/红）、磁盘可用空间、训练中状态变更 |
| Toast | 成功/警告/错误/信息 4 种类型，右上角弹出，3 秒自动消失，支持手动关闭 |
| 模态弹窗 | 用于确认操作（停止训练、退出程序、删除任务），支持主/次按钮 |
| Tooltip | hover 时显示，内容为参数说明 |
| 滑块 | 与数字输入框联动，范围可配置 |
| 文件选择器 | 调用系统文件/文件夹浏览对话框 |
| 进度条 | 百分比 + 当前/总计 + 预计剩余时间 |
| 日志终端 | 深色背景，等宽字体，自动滚动，支持行数上限（最多显示 5000 行），可复制 |

#### 6.3.2 新建训练页

| 状态 | 内容 |
|:---|:---|
| **初始状态** | 空白表单，所有字段可编辑 |
| **数据集校验中** | 转圈动画 + "正在校验…" |
| **数据集校验通过** | 绿色提示 + 统计信息 + 预览按钮 |
| **数据集校验失败** | 红色提示 + 逐条错误列表 |
| **模型校验通过** | 绿色提示 + 模型信息 |
| **模型校验失败** | 红色提示 + 指引链接 |
| **训练中** | 参数区锁定（灰色遮罩）+ 进度 + 指标表格 + 日志 + 暂停/停止按钮 |
| **训练暂停** | 参数区解锁 + 日志暂停 + 恢复/停止按钮 |
| **训练完成** | 结果摘要 + 指标 + 预测样例 + 操作按钮 |
| **训练异常** | 错误信息 + 保留文件路径 + 操作建议 |

#### 6.3.3 数据集预览弹窗

| 功能 | 要求 |
|:---|:---|
| 图片展示 | 大图 + 标注框叠加（含类别名） |
| 翻页 | 左右箭头翻页 |
| 缩略图 | 底部网格，点击切换 |
| 信息栏 | 当前文件名、图片内类别和数量 |
| 支持缩放 | 大图支持滚轮缩放或点击放大 |

#### 6.3.4 训练历史页

| 状态 | 内容 |
|:---|:---|
| **有记录** | 表格 + 搜索 + 筛选 + 行操作 + 批量删除 |
| **空状态** | 插图 + 引导文字 + 跳转按钮 |
| **断点续训点击** | 跳转新建训练页并预填参数 |

#### 6.3.5 推理测试页

| 状态 | 内容 |
|:---|:---|
| **未选模型** | 图片上传区置灰，提示先选模型 |
| **已选模型未上传图片** | 可操作上传区 |
| **推理中** | 转圈动画 |
| **推理完成** | 标注结果图 + 检测摘要表格 + 统计信息 + 导出按钮 |
| **推理错误** | 错误信息 + 重试建议 |

#### 6.3.6 设置页

| 功能 | 要求 |
|:---|:---|
| 全局配置 | 目录浏览 + 日志级别下拉 |
| 环境检测 | 逐项状态 + 刷新按钮 |
| 模型下载指引 | 文字 + 链接，可频繁更新 |

### 6.4 跨页面交互

| 交互 | 路径 |
|:---|:---|
| 训练完成 → 推理测试 | "用此模型进行推理测试"按钮 → 跳转推理页 + 自动加载模型 |
| 历史页 → 断点续训 | "断点续训"按钮 → 跳转新建训练页 + 预填全部参数 |
| 新建训练页 → 设置页 | "查看模型下载指南"链接 → 跳转设置页 |
| 设置页环境异常 | "查看详情" → 跳转设置页对应区域 |

### 6.5 暗色主题

| 要素 | 规范 |
|:---|:---|
| 背景色 | #1a1a2e (主背景) / #16213e (卡片) / #0f3460 (强调) |
| 文字色 | #e0e0e0 (正文) / #a0a0a0 (辅助) |
| 强调色 | #4fc3f7 (主按钮) / #66bb6a (成功) / #ff7043 (危险) / #ffa726 (警告) |
| 代码/日志 | #0d1117 背景 + #c9d1d9 文字 + Consolas 字体 |

### 6.6 阶段验证标准

- 每个页面在独立浏览器中打开，所有交互状态正常（可用静态 mock 数据）
- 侧边栏导航切换流畅，无闪烁
- Toast/弹窗/Tooltip/滑块等组件功能正常
- 暗色主题在 4 个页面中一致性良好

------

## 七、阶段五：联调集成（Week 6–7）

### 7.1 目标

将前端、Rust 后端、Python 引擎全线贯通，端到端功能可运行。

### 7.2 任务清单

| # | 任务 | 说明 |
|:---|:---|:---|
| 7.1 | 环境检测联调 | 应用启动 → Rust 调 Python → 结果推前端 → 设置页和侧边栏展示 |
| 7.2 | 数据集校验联调 | 选文件夹 → Rust 调 Python → 结果推前端 → 通过/失败展示 + 预览入口 |
| 7.3 | 模型校验联调 | 选 .pt 文件 → Rust 调 Python → 结果推前端 |
| 7.4 | 训练全流程联调 | 填参 → 开始训练 → 实时日志/指标 → 暂停恢复 → 停止 → 完成 → 报告 |
| 7.5 | 推理联调 | 选模型 → 上传图片 → 推理 → 结果展示 + 导出 |
| 7.6 | 训练历史联调 | 记录自动写入 → 历史页展示 → 筛选搜索 → 断点续训入口 → 删除 |
| 7.7 | 设置联调 | 配置读写 → 日志级别生效 → 环境检测刷新 |
| 7.8 | 异常路径联调 | 训练崩溃、推理超时、磁盘不足、进程被杀等场景 |

### 7.3 阶段验证标准

- 完整训练流程（小数据集 50 张图，训练 5 轮）从头到尾无报错
- 训练中可暂停、恢复、停止
- 推理测试可检出目标并显示正确标注框
- 历史记录正确增删查
- 异常场景下应用不崩溃，有明确的错误提示

------

## 八、阶段六：打包与测试（Week 7–8）

### 8.1 目标

产出可分发安装包，完成兼容性测试和用户体验打磨。

### 8.2 任务清单

| # | 任务 | 说明 |
|:---|:---|:---|
| 8.1 | NSIS 安装包配置 | 打包 Python 运行时 + PyTorch CPU/CUDA + Tauri 应用 + 示例数据集，安装脚本含环境检查 |
| 8.2 | 安装流程测试 | 全新安装、覆盖安装、卸载残留检查 |
| 8.3 | Windows 10 兼容测试 | 1803+、1903+、21H2 各测试一台 |
| 8.4 | Windows 11 兼容测试 | 22H2、23H2 各测试一台 |
| 8.5 | GPU 场景测试 | NVIDIA 不同型号显卡（至少 2 款）、不同 CUDA 版本 |
| 8.6 | CPU-only 场景测试 | 无 NVIDIA 显卡的电脑 |
| 8.7 | 边界测试 | 超大文件上传（ > 2GB 的 .pt 文件）、空数据集、损坏的 .pt 文件、磁盘写满 |
| 8.8 | 安装包体积优化 | 精简不必要的 PyTorch 组件，确保 < 1.2 GB |
| 8.9 | 用户使用说明编写 | 单页 HTML 文档，内容：安装 → 下载模型 → 数据集准备要求 → 第一次训练 → 推理测试 |
| 8.10 | 示例数据集准备 | 小型 YOLO 标注数据集，含 3 个类别，约 50 张图片 |
| 8.11 | GitHub 仓库准备 | README.md（中英双语、截图、快速开始）、MIT LICENSE、CONTRIBUTING.md |
| 8.12 | CI/CD 配置 | GitHub Actions 自动构建，产物发布到 GitHub Releases |

### 8.3 测试用例（关键场景）

| 场景 | 测试步骤 | 预期结果 |
|:---|:---|:---|
| 首次使用完整流程 | 安装 → 启动 → 环境自检通过 → 下载模型 → 加载示例数据集 → 默认参数训练 5 轮 → 查看报告 → 推理测试 | 全程无报错，每步有明确的界面反馈 |
| 训练中暂停恢复 | 开始训练 → 等到第 3 轮 → 暂停 → 等待 30 秒 → 恢复 → 训练正常完成 | 暂停期间参数区可编辑，恢复后继续训练 |
| 训练中关闭程序 | 训练到第 3 轮 → 点击关闭按钮 → 确认退出 → 重新打开 → 训练历史中有该任务 → 点击断点续训 → 从第 3 轮继续 | last.pt 被保留，断点续训成功 |
| GPU 不可用 | 在无 GPU 机器上安装 → 启动 → 环境检测显示"CPU only"→ 使用 CPU 训练 | 训练正常执行（慢但不出错） |
| 无效文件上传 | 选一个损坏的 .pt 文件 → 校验 → 选一个空文件夹 → 校验 | 红色提示具体问题，训练按钮不可点击 |

### 8.4 阶段验证标准

- 在 3 台以上不同配置 Windows 机器上成功安装并运行
- 安装包体积 < 1.2 GB
- 全部关键测试场景通过
- 用户使用说明撰写完毕

------

## 九、交付检查清单

| # | 交付项 | 检查标准 |
|:---|:---|:---|
| D1 | 项目源代码 | 全部源码通过仓库管理，含 README 和构建说明 |
| D2 | Windows 安装包 | `YOLO_Trainer_2.0_x64-setup.exe`，双击可安装，安装后可直接运行 |
| D3 | 用户使用说明 | 单页 HTML，内置在应用中（设置页链接），安装目录也可找到 |
| D4 | 示例数据集 | 50 张图片，3 个类别，含 data.yaml 和 labels，放在安装目录 |
| D5 | 模型下载指引 | 设置页内置，含官网链接和版本建议 |
| D6 | GitHub 仓库 | README + LICENSE (MIT) + CONTRIBUTING.md + GitHub Actions CI |

------

## 十、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|:---|:---|:---|:---|
| PyTorch 嵌入打包体积过大 | 中 | 安装包超 800MB 目标 | 提前做体积评估，必要时精简组件或提供基础版 + 按需下载 |
| NVIDIA 驱动兼容性 | 中 | 部分用户 GPU 无法使用 | 自动降级到 CPU 训练并给出明确提示 |
| 训练暂停/恢复不稳定 | 中 | 断点文件损坏 | 暂停时采用安全保存策略（先写临时文件，验证后替换） |
| Python 子进程管理 | 低 | 进程泄露导致资源占用 | 超时强制 kill，进程树完整清理 |
| Ultralytics API 变更 | 低 | 训练/推理功能异常 | 锁定 Ultralytics 版本号，升级前做回归测试 |

------

*文档版本：2.0 | 最后更新：2026-07-17*
