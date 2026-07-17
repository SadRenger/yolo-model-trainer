# YOLO Model Trainer

> 让不懂代码的人，也能轻松训练自己的 YOLO 模型。

一个开箱即用的 Windows 桌面应用——上传数据集、上传模型、点击开始训练，三步完成。无需安装 Python、无需配置环境、无需写一行代码。

---

## 特性

- 🚀 **三步开始** — 上传数据集 → 上传模型 → 点开始训练
- 🖥️ **桌面原生** — 基于 Tauri 2.x，双击安装包即用，内嵌完整 Python 运行时
- 🎯 **小白友好** — 所有参数有合理默认值和大白话解释，不懂也能用
- 📊 **训练全程可视** — 实时日志、进度条、指标表格，训练状态一目了然
- 🔒 **消除脆弱感** — 训练中锁定参数、关闭确认、断点续训，碰哪都不会出事
- 🔍 **推理测试** — 训练完拖张图进去看效果，支持导出详细检测结果
- 🛡️ **异常保护** — 训练崩溃不丢模型，意外中断可从断点恢复

---

## 安装

从 [Releases](https://github.com/SadRenger/yolo-model-trainer/releases) 下载 `YOLO_Trainer_2.0_x64-setup.exe`，双击安装。

> 系统要求：Windows 10 1803+ / Windows 11。不支持 macOS。

---

## 快速开始

### 训练你的第一个模型

```
1. 准备标注好的数据集（YOLO 格式：images/ + labels/ + data.yaml）
2. 下载一个 YOLO 预训练模型（如 yolov8n.pt）
3. 打开 YOLO Trainer → 上传数据集 → 上传模型 → 点"开始训练"
```

应用内「设置 → 模型下载指引」有详细的模型下载地址和版本选择建议。

### 验证模型效果

训练完成后，点击「用此模型进行推理测试」→ 拖一张图片进去，立刻看到检测效果。

---

## 文档

- [需求文档](https://github.com/SadRenger/yolo-model-trainer/blob/main/YOLO%20%E6%A8%A1%E5%9E%8B%E8%AE%AD%E7%BB%83%E5%B7%A5%E5%85%B7%20%E2%80%94%20%E9%9C%80%E6%B1%82%E6%96%87%E6%A1%A32.0.md)
- [UI 模型图](https://github.com/SadRenger/yolo-model-trainer/blob/main/YOLO%20%E6%A8%A1%E5%9E%8B%E8%AE%AD%E7%BB%83%E5%B7%A5%E5%85%B7%20%E2%80%94%20%E5%89%8D%E7%AB%AF%20UI%20%E6%A8%A1%E5%9E%8B%E5%9B%BE2.0.md)
- [开发计划书](https://github.com/SadRenger/yolo-model-trainer/blob/main/YOLO%20%E6%A8%A1%E5%9E%8B%E8%AE%AD%E7%BB%83%E5%B7%A5%E5%85%B7%20%E2%80%94%20%E5%BC%80%E5%8F%91%E8%AE%A1%E5%88%92%E4%B9%A6.md)

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri 2.x (Rust) |
| 前端 | 原生 HTML5 + CSS3 + JavaScript（零框架） |
| 训练引擎 | Python 3.13 + PyTorch 2.6.0 + Ultralytics 8.3.50 |
| 打包 | NSIS |

---

## 系列项目

- [YOLO Game UI Labeler](https://github.com/SadRenger/yolo-game-ui-labeler) — 游戏 UI 标注工具。标注完数据？用 YOLO Trainer 一键训练。

---

## 协议

MIT — 随便用、随便改、随便商用。
