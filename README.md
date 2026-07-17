<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)">
    <img alt="YOLO Trainer" width="520" src="docs/logo.svg" onerror="this.style.display='none'">
  </picture>
</p>

<p align="center">
  <strong>让不懂代码的人，也能轻松训练自己的 YOLO 模型。</strong>
  <br>
  <em>Train your own YOLO model — no code, no command line, no environment setup.</em>
</p>

<p align="center">
  <a href="https://github.com/SadRenger/yolo-model-trainer/releases"><img src="https://img.shields.io/github/v/release/SadRenger/yolo-model-trainer?color=%234fc3f7&label=release" alt="Release"></a>
  <a href="https://github.com/SadRenger/yolo-model-trainer/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-%2358a6ff" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Windows%2010%2F11-%234fc3f7" alt="Platform: Windows"></a>
  <a href="#"><img src="https://img.shields.io/badge/desktop-Tauri%202.x-%23bc8cff" alt="Tauri 2.x"></a>
  <a href="#"><img src="https://img.shields.io/badge/python-3.13-%2358a6ff" alt="Python 3.13"></a>
</p>

<br>

---

## 🤔 Why? · 为什么做这个？

训练 YOLO 模型的传统方式：配 Python 环境 → 装 CUDA → 装 PyTorch → 写训练脚本 → 调超参 → 看命令行日志……每一步都在劝退非技术用户。

**YOLO Trainer** 把它变成 3 步：**上传数据 → 上传模型 → 点开始训练。** 所有复杂配置内嵌在安装包里，双击就能用。默认参数即最佳实践，不懂每个参数的含义也没关系。

> *The traditional YOLO training pipeline — configure Python, install CUDA, set up PyTorch, write scripts, tune hyperparameters — stops non-technical users before they even start. **YOLO Trainer** collapses this into 3 clicks: upload dataset, upload model, start training. All dependencies are bundled. Sensible defaults work out of the box.*

---

## ✨ Features · 核心特性

<table>
<tr>
  <td width="50%">
    <h4>🚀 三步开始训练</h4>
    <p>选数据集 → 选模型 → 点「开始训练」。参数全有默认值，零配置跑通。</p>
    <p><em>Three clicks from dataset to training. Sensible defaults for every parameter.</em></p>
  </td>
  <td width="50%">
    <h4>📊 训练全程可视</h4>
    <p>实时日志、进度条、指标表格（Loss / mAP / 学习率）。暗色终端风格，训练状态一目了然。</p>
    <p><em>Live log streaming, progress bar, metrics dashboard. Dark terminal aesthetic.</em></p>
  </td>
</tr>
<tr>
  <td>
    <h4>🔒 消除「脆弱感」</h4>
    <p>训练中参数锁定、关闭窗口二次确认、最小化/锁屏不影响后台训练。随便碰，不会出事。</p>
    <p><em>Parameter lock during training, exit confirmation, background execution. Nothing you click will break it.</em></p>
  </td>
  <td>
    <h4>🔄 断点续训</h4>
    <p>意外中断？手动停止？last.pt 已保存。从训练历史一键恢复，修改参数后继续。</p>
    <p><em>Crashed or stopped? last.pt is preserved. Resume training with modified parameters in one click.</em></p>
  </td>
</tr>
<tr>
  <td>
    <h4>🔍 推理测试</h4>
    <p>训练完拖张图进去，看检测效果。导出标注图 + JSON 结果，含每框置信度与坐标。</p>
    <p><em>Drag an image in after training. Export annotated result + JSON with per-box confidence and coordinates.</em></p>
  </td>
  <td>
    <h4>🛡️ 异常保护</h4>
    <p>训练进程崩溃不影响主程序。best.pt / last.pt 始终保留，不会白跑。</p>
    <p><em>Training crash doesn't kill the app. Model outputs are always preserved — your time is never wasted.</em></p>
  </td>
</tr>
<tr>
  <td>
    <h4>🎯 数据集校验 + 预览</h4>
    <p>选完数据集自动校验格式，告诉你几张图、几个类别、哪里有问题。还能预览标注框。</p>
    <p><em>Auto-validate dataset format on selection. Preview bounding boxes before training.</em></p>
  </td>
  <td>
    <h4>📄 HTML 训练报告</h4>
    <p>训练完自动生成完整报告：Loss/mAP 曲线、混淆矩阵、逐类别指标、验证集预测样例。</p>
    <p><em>Auto-generated HTML report: loss curves, confusion matrix, per-class metrics, validation predictions.</em></p>
  </td>
</tr>
</table>

---

## 📸 Screenshots · 界面预览

> *Screenshots coming soon — the project is under active development.*

<p align="center">
  <table>
    <tr>
      <td align="center"><b>📊 新建训练</b><br><em>New Training</em></td>
      <td align="center"><b>📂 训练历史</b><br><em>History</em></td>
    </tr>
    <tr>
      <td align="center"><b>🔍 推理测试</b><br><em>Inference</em></td>
      <td align="center"><b>⚙️ 设置</b><br><em>Settings</em></td>
    </tr>
  </table>
</p>

---

## 🏗️ Architecture · 系统架构

```
┌─────────────────────────────────────────────┐
│           Tauri 前端 / Frontend              │
│   HTML5 + CSS3 + Vanilla JS (零框架)        │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│   │ 新建  │ │ 历史  │ │ 推理  │ │ 设置  │     │
│   │ New   │ │History│ │Infer  │ │Settings│    │
│   └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘     │
│      └────────┴────────┴────────┘           │
│         Tauri Event Bus · IPC               │
└──────────────────┬──────────────────────────┘
                   │  Tauri Commands
┌──────────────────┴──────────────────────────┐
│          Rust 后端 / Backend                 │
│   进程管理 · 事件路由 · 文件系统 · 持久化    │
│   Process Manager · Event Bus · Storage      │
└──────────────────┬──────────────────────────┘
                   │  stdin/stdout · JSONL
┌──────────────────┴──────────────────────────┐
│        Python 引擎 / Engine                  │
│   Python 3.13 + PyTorch 2.6.0 + CUDA 12.4   │
│   ┌─────────┐ ┌──────┐ ┌──────┐ ┌───────┐  │
│   │train.py │ │infer │ │check │ │report │  │
│   │ 训练    │ │ 推理  │ │ 校验  │ │ 报告   │  │
│   └─────────┘ └──────┘ └──────┘ └───────┘  │
└─────────────────────────────────────────────┘
```

---

## 🚀 Quick Start · 快速开始

### 📥 安装 / Installation

从 [Releases](https://github.com/SadRenger/yolo-model-trainer/releases) 下载最新安装包，双击安装。

> **系统要求 / Requirements：** Windows 10 (1803+) / Windows 11 · 不支持 macOS · *macOS not supported*

| | 最低 / Minimum | 推荐 / Recommended |
|---|---|---|
| 内存 / RAM | 8 GB | 16 GB+ |
| GPU | 无（CPU 训练可用） | NVIDIA GTX 1060 6GB+ |
| 磁盘 / Disk | 8 GB 可用 | 20 GB+ 可用 |

### 🔧 第一次训练 / Your First Model

```bash
# 1. 准备数据集（YOLO 格式）
#    Prepare dataset in YOLO format
your_dataset/
├── images/       # 训练图片 / training images
├── labels/       # YOLO 标注文件 / label .txt files
└── data.yaml     # 数据集配置 / dataset config

# 2. 下载预训练模型
#    Download a pretrained model (e.g. yolov8n.pt)
#    应用内「设置 → 模型下载指引」有下载链接和版本建议

# 3. 打开 YOLO Trainer
#    Launch the app
#    上传数据集 → 上传模型 → 点击「开始训练」
#    Upload dataset → Upload model → Click "Start Training"
```

应用内「设置 → 模型下载指引」有模型下载链接和版本选择建议。
*Check "Settings → Model Download Guide" for download links and version recommendations.*

### 🔍 验证效果 / Verify Results

训练完成后 → 点击「用此模型进行推理测试」→ 拖一张图进去 → 看效果。
*After training → "Test with this model" → drag an image → see detections instantly.*

---

## 🧰 Tech Stack · 技术栈

| Layer · 层 | Tech · 技术 | Notes · 说明 |
|---|---|---|
| 桌面框架 / Desktop | **Tauri 2.x** (Rust) | 轻量、原生性能、WebView2 渲染 |
| 前端 / Frontend | **HTML5 + CSS3 + Vanilla JS** | 零框架，最小化体积 / Zero-framework |
| 训练引擎 / Engine | **Python 3.13** (嵌入式) | 打包进安装包，无需用户安装 |
| 深度学习 / DL | **PyTorch 2.6.0 + CUDA 12.4** | CPU & GPU 双模式 |
| 模型库 / Model | **Ultralytics 8.3.50** | YOLOv8 / YOLOv11 全系列支持 |
| 打包 / Packaging | **NSIS** | 专业 Windows 安装体验 |

---

## 📂 Project Structure · 项目结构

```
yolo-model-trainer/
├── src-tauri/           # Rust 后端 · Tauri backend
│   └── src/
│       ├── main.rs      # 应用入口 · app entry
│       ├── commands/    # Tauri Commands (前端调用的 API)
│       ├── events/      # 事件总线 · event bus
│       └── process/     # Python 进程管理 · process manager
├── src/                 # 前端 · frontend (HTML/CSS/JS)
│   ├── index.html
│   ├── css/
│   │   ├── variables.css    # CSS 变量 · design tokens
│   │   ├── layout.css       # 主布局 · layout
│   │   ├── components.css   # 通用组件 · components
│   │   └── pages.css        # 页面样式 · page styles
│   ├── js/
│   │   ├── app.js           # 入口 + 路由 · entry + SPA router
│   │   ├── api.js           # Tauri Command 封装 · API layer
│   │   ├── state.js         # 全局状态 · global state
│   │   ├── components/      # 通用组件 · shared components
│   │   └── pages/           # 4 个页面 · 4 page modules
│   └── assets/
├── python/              # Python 引擎 · training engine
│   ├── train.py         # 训练执行 · training runner
│   ├── infer.py         # 推理执行 · inference runner
│   ├── env_check.py     # 环境检测 · environment check
│   ├── dataset_check.py # 数据集校验 · dataset validation
│   ├── model_check.py   # 模型校验 · model validation
│   └── report.py        # 报告生成 · HTML report generator
├── docs/                # 文档 · documentation
├── scripts/             # 构建脚本 · build scripts
├── installer/           # NSIS 安装包脚本 · installer scripts
├── README.md            # 本文件 · you are here
├── LICENSE              # MIT
└── CONTRIBUTING.md      # 贡献指南 · contribution guide
```

---

## 🤝 Contributing · 参与贡献

本项目正在积极开发中。欢迎提 Issue、PR，或参与测试反馈。

*This project is under active development. Issues, PRs, and testing feedback are welcome!*

详见 [CONTRIBUTING.md](./CONTRIBUTING.md) · *See contribution guide for details.*

---

## 🔗 Related · 系列项目

| 项目 / Project | 说明 / Description |
|---|---|
| [**YOLO Game UI Labeler**](https://github.com/SadRenger/yolo-game-ui-labeler) | 🏷️ 游戏 UI 标注工具 — 标完数据？用 YOLO Trainer 一键训练 |
| **YOLO Trainer** ← 你在这里 · *you are here* | 🚀 训练工具 — 标注完就训练，训练完就推理 |

---

## 📄 License · 协议

MIT © 2026 YOLO Model Trainer Contributors — 随便用、随便改、随便商用。*Use, modify, and distribute freely.*

---

<p align="center">
  <br>
  <strong>⭐ 如果这个项目对你有用，给个 Star 支持一下！</strong>
  <br>
  <em>If you find this useful, a star would be appreciated!</em>
  <br><br>
  <a href="https://github.com/SadRenger/yolo-model-trainer/stargazers"><img src="https://img.shields.io/github/stars/SadRenger/yolo-model-trainer?style=social" alt="Stars"></a>
</p>
