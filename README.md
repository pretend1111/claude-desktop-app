# Claude Desktop App

**把 Claude Code 的开源引擎套上 claude.ai 的前端——一个能接任意 API 的桌面版 Claude。**

手头有 Claude 中转站 API？想像 claude.ai 网页版那样跟 Claude 聊天，不想折腾纯净外卡 / 外号 / 住宅 IP？这个项目就是为你准备的。

<p align="center">
  <img src="public/favicon.png" alt="Claude Desktop App" width="100" />
</p>

<p align="center">
  <a href="../../releases"><img src="https://img.shields.io/github/v/release/pretend1111/claude-desktop-app?style=flat-square" alt="Release" /></a>
  <a href="../../stargazers"><img src="https://img.shields.io/github/stars/pretend1111/claude-desktop-app?style=flat-square" alt="Stars" /></a>
  <a href="../../releases"><img src="https://img.shields.io/github/downloads/pretend1111/claude-desktop-app/total?style=flat-square" alt="Downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Non--Commercial-blue?style=flat-square" alt="License" /></a>
</p>

## 为什么做这个

Claude Code 本身强得离谱，但只能在命令行里当"打工人"用——它的系统提示词是为编程任务写的，不适合当成日常对话助手。

claude.ai 网页版体验顶级，但国内用户几乎用不了：注册要纯净国外信用卡、纯净国外手机号、住宅 IP，缺一个就封号。

所以大部分国内程序员的状况是：手里有 Claude 中转站 API → 只能在 Claude Code CLI 里编程用 → 想聊天只能退回 Gemini / GPT → 体验差 Claude 一截。

**这个项目把 Claude Code 的开源引擎套上了 claude.ai 几乎一模一样的前端**。结果就是：
- 拿你手里的中转站 API，像 claude.ai 一样跟 Claude 聊天
- 同时拥有 Claude Code 原生的全部 agent 能力（读写文件、跑命令、上下文管理、网页搜索、Skills、Projects 等）
- 不要外卡、不要外号、不要住宅 IP、不怕封号

## 亮点

- 🎨 **界面 1:1 还原 claude.ai**——深色模式、流式输出、thinking 块折叠、工具卡片、Artifacts 面板、Projects 知识库，基本体验跟官方完全对齐
- 🔌 **任意模型接入**——内置 Anthropic ↔ OpenAI 格式双向代理，能接 Claude 中转站、Qwen、DeepSeek、GLM、GPT、Gemini，只要对方兼容 OpenAI 或 Anthropic 格式
- 🛠️ **完整 agent 能力**——读写文件、执行命令、网页搜索、多轮工具调用、上下文压缩，全套 Claude Code 原生工具
- 🎯 **两种使用模式**
  - **自部署模式**：填你自己的 API Key 和 Base URL，完全本地使用，零服务器依赖
  - **Clawparrot 模式**：不想折腾就注册 [clawparrot.com](https://clawparrot.com) 账号，按量付费直接用
- 🧠 **Claude 原生对话风格**——保留了 claude.ai 的说话节奏和深度，不是 Claude Code 的"干练打工人"腔调
- 🔄 **自动更新**——新版本推出后 app 自动拉取，无需手动重装

## 演示

丢一句 "写一个中国象棋游戏，玩家和 AI 对战，AI 三个难度等级"，模型会自己：

1. 规划任务 → 拆分成几个文件
2. 用 Write 工具从零创建 `index.html`
3. 用 Edit 工具实现 AI 评估函数、alpha-beta 剪枝、走子规则、UI 交互
4. 全程流式展示每一步操作

跑完就是一个能直接在浏览器打开玩的完整象棋游戏。所有代码由模型自主生成、自主写入、自主验证。

## 功能特性

### 对话 (Chat) ✅
- Markdown 完整渲染（代码高亮、KaTeX 数学公式、Mermaid 图表）
- 流式输出 + thinking 块折叠
- 图片附件（缩略图 + lightbox 查看）
- 多种文件格式上传（zip、pdf、docx 等）
- GitHub 仓库一键导入对话
- 消息编辑 / 重新生成 / 上下文回退（基于 Claude Code 原生 `--resume-session-at`）
- 左下角实时显示额度使用情况
- 跨模式切换保护（切换模式时对现有对话的模型自动检测并提示）

### 工具调用
- **Read / Write / Edit / MultiEdit**——文件读写与多处编辑
- **Bash**——执行 shell 命令
- **Glob / Grep**——代码库搜索
- **WebSearch / WebFetch**——网页搜索和抓取
- **Agent**——派生子任务并行处理（Deep Research 的基础）
- **Skills**——调用自定义指令集

### Skills 系统
- 输入框 `+` 菜单选 Skills → `/skill-name` 以蓝色 tag 出现在消息里
- 模型通过 Skill 工具读取指令集内容（UI 里可见）
- 内置 **skill-creator** 用于创建自定义 Skill
- Skill 存在 `~/.claude/skills/` 目录，引擎自动加载

### Projects（项目知识库）
- 上传参考文档（代码、文档、PDF）作为项目知识库
- 跨对话共享知识
- 文件按需通过 Read 工具读取，不会塞爆上下文
- 每个项目可设独立的 instructions 注入到对话

### Deep Research 模式
- 针对复杂问题展开深度调研
- 主 agent 规划子问题 → 派生多个 sub-agent 并行搜索 → 汇总成带引用的报告
- 启用方式：输入框左下角切换

### Artifacts（可视化产出）
- 模型生成的 HTML / JSX 直接在右侧面板实时预览
- 支持双面板对比、编辑、重新生成
- 在 Artifacts 页面浏览所有产出，带灵感画廊

### 自动更新
- Electron 内置 `electron-updater`，启动 15 秒后首次检查，之后每 10 分钟检查一次
- 新版可用时通知用户，用户点击 Relaunch 即完成升级
- 无需重装 app

## 快速开始

### 下载安装

从 [Releases 页面](../../releases/latest) 下载对应平台的安装包：

| 平台 | 下载 |
|----------|----------|
| Windows | `.exe` |
| macOS (Apple Silicon) | `.dmg` 或 `.zip` |
| Linux | `.AppImage` 或 `.deb` |

### 首次使用

1. 安装并启动 app
2. Onboarding 页面选择使用模式：
   - **自部署**：用你自己的 API Key（中转站 / 官方 / 任意兼容 OpenAI 格式的模型）
   - **Clawparrot**：用我们托管的服务，需要先在 [clawparrot.com](https://clawparrot.com) 注册
3. 自部署用户：进入 **Settings → Models** 添加 Provider，填入 Base URL 和 API Key，选择模型
4. Clawparrot 用户：登录 clawparrot.com 账号即可使用

两种模式都进主界面后，就可以开始聊天。

## 从源码构建

```bash
git clone https://github.com/pretend1111/claude-desktop-app.git
cd claude-desktop-app

# 装依赖
npm install

# 运行
npx vite build
npx electron .
```

**依赖**：[Node.js 20+](https://nodejs.org)、[Bun](https://bun.sh)（Windows 上 Claude Code 引擎还需要 [Git Bash](https://git-scm.com/downloads)）

### 开发模式

- 改前端代码后需要重新 `npx vite build` + 重启 Electron
- 改 `electron/bridge-server.cjs` 直接重启 Electron 即可
- 改 `engine/src/` 源码不用 rebuild，下次 spawn 引擎时自动生效

## 架构

```
┌─────────────────────────────────────────────────┐
│ Electron 主进程 (main.cjs)                       │
│ ├── 窗口管理、IPC                                 │
│ └── 自动更新（electron-updater）                  │
└────────────────────┬────────────────────────────┘
                     │
     ┌───────────────┴──────────────────┐
     │                                  │
┌────▼──────────────┐      ┌────────────▼──────────┐
│ React 前端 (Vite)  │◄────►│ Bridge Server         │
│                   │ HTTP │ (Express, :30080)     │
│ • 对话界面         │      │                       │
│ • Skills / Projects│      │ • 对话 / 项目 CRUD      │
│ • Artifacts        │      │ • Chat → spawn 引擎    │
│ • Settings         │      │ • OpenAI ↔ Anthropic  │
│                   │      │   双向格式代理          │
└───────────────────┘      │ • 文件上传、图片服务    │
                           └──────────┬────────────┘
                                      │ stdin/stdout
                                      │ (stream-json)
                           ┌──────────▼────────────┐
                           │ Claude Code 引擎        │
                           │ (engine/, Bun 运行)     │
                           │                       │
                           │ • 19+ 内置工具         │
                           │ • Session 持久化        │
                           │ • Skill 加载            │
                           │ • 上下文管理            │
                           └──────────┬────────────┘
                                      │ HTTPS
                                      ▼
                                   上游 API
                          (Claude / Qwen / GPT ...)
```

## 配置

### 自部署模式的 Providers

在 **Settings → Models** 中添加 Provider。常见配置：

| Provider | Base URL | 格式 |
|----------|----------|--------|
| Claude 中转站（Anthropic 格式） | 中转站提供的 URL | Anthropic |
| Qwen（阿里云） | `https://dashscope.aliyuncs.com/compatible-mode` | OpenAI |
| DeepSeek | `https://api.deepseek.com` | OpenAI |
| SiliconFlow | `https://api.siliconflow.cn` | OpenAI |
| GLM（智谱） | `https://open.bigmodel.cn/api/paas/v4` | OpenAI |
| OpenAI | `https://api.openai.com` | OpenAI |
| Anthropic 官方 | `https://api.anthropic.com` | Anthropic |

任何兼容 OpenAI 或 Anthropic 格式的 provider 都能接。

### Skills

Skills 存在 `~/.claude/skills/`，每个 skill 一个目录 + 一个 `SKILL.md`：

```
~/.claude/skills/
├── skill-creator/
│   └── SKILL.md
├── code-review/
│   └── SKILL.md
└── your-custom-skill/
    └── SKILL.md
```

通过 app 内的 `/skill-creator` 创建，或手动放文件都行。

## 技术栈

| 层 | 技术 |
|-------|-----------|
| 前端 | React 19、TypeScript、TailwindCSS |
| 构建 | Vite 6 |
| 桌面 | Electron |
| 引擎 | Claude Code（TypeScript，Bun 运行） |
| 格式代理 | Node.js HTTP server |
| Markdown | react-markdown、highlight.js、KaTeX、Mermaid |
| 更新分发 | electron-builder + electron-updater |

## Roadmap

顶部 tab 目前有 `Chat` / `Cowork` / `Code`，已完成的是 `Chat`。如果这个项目反响不错，接下来会按顺序攻破 `Cowork`（多人协同编辑 / 项目协作模式），然后是 `Code`（IDE 化编程体验）。

## 贡献

欢迎提 Issue 和 PR。如果是大功能建议先开 Issue 讨论方向，避免白费力气。

## 许可

仅允许非商业使用。详见 [LICENSE](LICENSE)。

## Star History

觉得有用的话请点个 Star，帮助更多人发现这个项目。
