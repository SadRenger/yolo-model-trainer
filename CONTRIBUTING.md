# Contributing to YOLO Trainer · 贡献指南

感谢你关注这个项目！YOLO Trainer 正在积极开发中，欢迎任何形式的贡献。

*Thanks for checking out YOLO Trainer! The project is under active development and all contributions are welcome.*

---

## 🐛 Bug Reports · 报告问题

发现 Bug？请提 [GitHub Issue](https://github.com/SadRenger/yolo-model-trainer/issues/new)，尽量包含：

- **环境信息**：Windows 版本、GPU 型号、驱动版本
- **复现步骤**：做了什么操作 → 发生了什么 → 期望发生什么
- **截图/日志**：报错信息、界面截图

*Found a bug? Please open an issue with: Windows version, GPU info, steps to reproduce, screenshots/logs.*

---

## 💡 Feature Requests · 功能建议

如果你有想法让这个工具变得更好，欢迎提 Issue 讨论。讨论时请说明：

- 这个功能解决什么问题
- 你期望的交互方式是什么样的
- 有没有参考的其他工具/产品

*Have an idea? Open an issue and tell us: what problem it solves, how you'd like it to work, and any references.*

---

## 🔧 Development Setup · 开发环境搭建

### 前置要求 / Prerequisites

| 工具 / Tool | 版本 / Version | 说明 / Notes |
|---|---|---|
| Rust | stable (>= 1.77) | 需 `wasm32-unknown-unknown` target |
| Node.js | >= 18 | Tauri CLI 需要 |
| Python | 3.13 | 用于开发测试引擎脚本 |
| Git | >= 2.40 | |

### 快速启动 / Quick Start

```bash
# 1. 克隆仓库
git clone git@github.com:SadRenger/yolo-model-trainer.git
cd yolo-model-trainer

# 2. 安装 Tauri CLI
cargo install tauri-cli --version "^2.0"

# 3. 安装前端依赖（如果有的话）
# 本项目前端不使用 npm 依赖，跳过此步

# 4. 启动开发模式
cargo tauri dev
```

### Python 引擎开发 / Python Engine Development

```bash
cd python

# 创建虚拟环境（开发时使用系统 Python，最终打包使用嵌入式 Python）
python -m venv venv
source venv/Scripts/activate  # Windows
# 或 venv/bin/activate (Git Bash)

# 安装依赖
pip install torch==2.6.0+cu124 --index-url https://download.pytorch.org/whl/cu124
pip install ultralytics==8.3.50

# 单独测试各模块
python env_check.py
python dataset_check.py --dataset-path ../test_data/sample_dataset
python model_check.py --model-path ../test_data/yolov8n.pt
python train.py --dataset-path ../test_data/sample_dataset --model-path ../test_data/yolov8n.pt --epochs 5
python infer.py --model-path ../test_data/yolov8n.pt --image-path ../test_data/test.jpg
```

---

## 📁 Project Conventions · 项目规范

### 分支命名 / Branch Naming

```
feat/<功能简述>      # 新功能 / new feature
fix/<修复简述>       # Bug 修复 / bug fix
docs/<文档简述>      # 文档更新 / documentation
refactor/<重构简述>  # 重构 / refactoring
```

### Commit 格式 / Commit Format

```
<type>: <简短描述 / short description>

<详细说明 / detailed description (optional)>
```

Types: `feat` | `fix` | `docs` | `refactor` | `chore` | `test`

### 代码风格 / Code Style

- **前端 / Frontend**：使用 Prettier 默认配置（2 空格缩进、单引号）
- **Rust**：`cargo fmt` + `cargo clippy`
- **Python**：遵循 PEP 8，函数需有 docstring
- **CSS**：使用 CSS 变量（定义在 `variables.css`），不写硬编码色值

---

## 🧪 Testing · 测试

目前项目处于早期开发阶段，测试以手动功能验证为主：

- **Rust 侧**：`cargo test` 运行单元测试
- **Python 引擎**：每个模块可独立运行验证（见上文 Python 引擎开发部分）
- **前端**：在 `cargo tauri dev` 下手动验证页面交互

自动化测试将在后续阶段引入。

*The project is in early development. Automated testing will be introduced in later phases. For now, verify manually via `cargo tauri dev`.*

---

## 📦 Building · 构建安装包

```bash
# 构建 Release 版本
cargo tauri build

# 打包 NSIS 安装程序
# 详见 installer/ 目录下的构建脚本
```

---

## 🎯 Roadmap · 路线图

详见 [开发计划书](./YOLO%20模型训练工具%20—%20开发计划书.md) · *See the development plan for details.*

| 阶段 / Phase | 内容 / Content | 周期 / Timeline |
|---|---|---|
| 工程搭建 | 项目骨架 + 三端通信 | Week 1 |
| Python 引擎 | 6 个核心模块开发 | Week 2–3 |
| Rust 后端 | 进程管理 + 事件总线 + 持久化 | Week 3–4 |
| 前端 UI | 4 个页面 + 全局组件 | Week 4–6 |
| 联调集成 | 端到端贯通 | Week 6–7 |
| 打包测试 | NSIS 安装包 + 兼容性测试 | Week 7–8 |

---

## 🙏 Acknowledgments · 致谢

- [Ultralytics](https://github.com/ultralytics/ultralytics) — YOLO 模型训练框架
- [Tauri](https://tauri.app/) — 轻量级桌面应用框架
- [PyTorch](https://pytorch.org/) — 深度学习框架

---

*Happy training! 🚀*
