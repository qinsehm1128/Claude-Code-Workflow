# 快速入门

欢迎使用 CCW (Claude Code Workspace) - 一个先进的 AI 驱动开发环境，帮助您更快地编写更好的代码。

## 什么是 CCW？

CCW 是一个综合开发环境，结合了：

- **AI 驱动 CLI 工具**：使用多个 AI 后端进行分析、审查和实现代码
- **专业化代理**：前端、后端、测试和文档代理
- **工作流编排**：从规范到实现的 4 级工作流系统
- **可扩展技能**：27+ 内置技能，支持自定义技能
- **MCP 集成**：模型上下文协议，增强工具集成

## 快速开始

### 安装

```bash
# 全局安装 CCW
npm install -g @ccw/cli

# 或使用 npx
npx ccw --help
```

### 第一个工作流

在 5 分钟内创建一个简单工作流：

```bash
# 初始化新项目
ccw init my-project

# 分析现有代码
ccw cli -p "分析代码库结构" --mode analysis

# 实现新功能
ccw cli -p "添加用户认证" --mode write
```

## 下一步

- [安装指南](./installation.md) - 详细安装说明
- [第一个工作流](./first-workflow.md) - 30 分钟快速入门教程
- [配置指南](/guide/cli-tools) - 自定义 CCW 设置

::: tip 需要帮助？
查看我们的 [GitHub Discussions](https://github.com/your-repo/ccw/discussions) 或加入 [Discord 社区](https://discord.gg/ccw)。
:::
