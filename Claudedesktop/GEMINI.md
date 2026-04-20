# AGENTS.md - Claude Clone 前端开发规范

## 项目概述
Claude 对话平台前端，基于 React + TypeScript + Vite。

## 后端信息
- 后端地址：http://localhost:3001
- 后端仓库（只读参考）：~/study/claude/Claude_clone_backend/
- 可以查看后端代码了解接口，但不要修改后端文件

## 已有后端 API
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册，body: {email, password, nickname} |
| POST | /api/auth/login | 登录，body: {email, password} |
| GET | /api/conversations | 对话列表 |
| POST | /api/conversations | 创建对话，body: {title?, model?} |
| GET | /api/conversations/:id | 对话详情+消息历史 |
| PATCH | /api/conversations/:id | 更新对话，body: {title?, model?} |
| DELETE | /api/conversations/:id | 删除对话 |
| POST | /api/chat | 流式对话(SSE)，body: {conversation_id, message, attachments?} |
| GET | /api/user/profile | 用户信息 |
| GET | /api/user/usage | 用量统计 |
| PATCH | /api/user/profile | 更新资料，body: {nickname?, password?} |

## SSE 流式响应格式
后端透传 Anthropic API 的 SSE 流，关键事件：
- `content_block_delta` + `delta.type: "text_delta"` → 正文文本
- `content_block_delta` + `delta.type: "thinking_delta"` → 思考过程
- `message_stop` → 流结束
- `data: [DONE]` → 流结束（备用信号）

## 认证方式
- Token 存 localStorage('auth_token')
- 请求头：Authorization: Bearer <token>
- 401 响应时清除 token 跳转登录页

## 目录结构
```
src/
├── api.ts              # API 服务层
├── App.tsx             # 路由 + 认证守卫
├── constants.ts        # 常量
└── components/
    ├── Auth.tsx         # 登录/注册页
    ├── MainContent.tsx  # 聊天主区域
    ├── Sidebar.tsx      # 侧边栏
    ├── MarkdownRenderer.tsx  # Markdown渲染
    ├── Icons.tsx        # 图标组件
    └── StarIcon.tsx     # 星标图标
```

## 技术约束
- 不要在前端代码中放任何 API Key
- 流式对话用 fetch + ReadableStream，不用 EventSource
- 所有 API 请求发到 http://localhost:3001/api
- 保持 Claude UI 的视觉风格（暖色调、简洁）