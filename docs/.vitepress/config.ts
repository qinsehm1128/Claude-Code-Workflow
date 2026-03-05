import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { transformDemoBlocks } from './theme/markdownTransform'
import path from 'path'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isUserOrOrgSite = Boolean(repoName && repoName.endsWith('.github.io'))

const base =
  process.env.CCW_DOCS_BASE ||
  (process.env.GITHUB_ACTIONS && repoName && !isUserOrOrgSite ? `/${repoName}/` : '/')

export default withMermaid(defineConfig({
  title: 'Claude Code Workflow Documentation',
  description: 'Claude Code Workspace - Advanced AI-Powered Development Environment',
  lang: 'en-US',
  base,

  // Ignore dead links for incomplete docs
  ignoreDeadLinks: true,
  head: [
    ['link', { rel: 'icon', href: `${base}favicon.svg`, type: 'image/svg+xml' }],
    [
      'script',
      {},
      `(function() {
  try {
    var theme = localStorage.getItem('ccw-theme') || 'blue';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})()`
    ],
    ['meta', { name: 'theme-color', content: '#3b82f6' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en_US' }],
    ['meta', { name: 'og:locale:alternate', content: 'zh_CN' }]
  ],

  // Appearance
  appearance: false,

  // Vite build/dev optimizations
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '../../ccw/frontend/src'),
        '@/components': path.resolve(__dirname, '../../ccw/frontend/src/components'),
        '@/lib': path.resolve(__dirname, '../../ccw/frontend/src/lib')
      }
    },
    optimizeDeps: {
      include: ['flexsearch', 'react', 'react-dom']
    },
    build: {
      target: 'es2019',
      cssCodeSplit: true
    },
    ssr: {
      noExternal: ['react', 'react-dom', 'class-variance-authority', 'clsx', 'tailwind-merge']
    }
  },

  // Theme configuration
  themeConfig: {
    logo: '/logo.svg',

    // Right-side table of contents (outline)
    outline: {
      level: [2, 3],
      label: 'On this page'
    },

    // Navigation - 按照 Trellis 风格组织
    nav: [
      { text: 'Guide', link: '/guide/ch01-what-is-claude-dms3' },
      { text: 'Commands', link: '/commands/claude/' },
      { text: 'Skills', link: '/skills/' },
      { text: 'Features', link: '/features/spec' }
    ],

    // Sidebar - 优化导航结构，增加二级标题和归类
    sidebar: {
      '/guide/': [
        {
          text: '📖 指南',
          collapsible: false,
          items: [
            { text: 'What is Claude Code Workflow', link: '/guide/ch01-what-is-claude-dms3' },
            { text: 'Getting Started', link: '/guide/ch02-getting-started' },
            { text: 'Core Concepts', link: '/guide/ch03-core-concepts' },
            { text: 'Workflow Basics', link: '/guide/ch04-workflow-basics' },
            { text: 'Advanced Tips', link: '/guide/ch05-advanced-tips' },
            { text: 'Best Practices', link: '/guide/ch06-best-practices' }
          ]
        },
        {
          text: '🚀 快速入口',
          collapsible: true,
          items: [
            { text: 'Installation', link: '/guide/installation' },
            { text: 'First Workflow', link: '/guide/first-workflow' },
            { text: 'CLI Tools', link: '/guide/cli-tools' }
          ]
        },
        {
          text: '📝 CLAUDE.md & MCP',
          collapsible: true,
          items: [
            { text: 'CLAUDE.md Guide', link: '/guide/claude-md' },
            { text: 'CCW MCP Tools', link: '/guide/ccwmcp' },
            { text: 'MCP Setup', link: '/guide/mcp-setup' }
          ]
        }
      ],
      '/commands/': [
        {
          text: '🤖 Claude Commands',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/commands/claude/' },
            { text: 'Core Orchestration', link: '/commands/claude/core-orchestration' },
            { text: 'Workflow', link: '/commands/claude/workflow' },
            { text: 'Session', link: '/commands/claude/session' },
            { text: 'Issue', link: '/commands/claude/issue' },
            { text: 'IDAW', link: '/commands/claude/idaw' },
            { text: 'Memory', link: '/commands/claude/memory' },
            { text: 'CLI', link: '/commands/claude/cli' },
            { text: 'UI Design', link: '/commands/claude/ui-design' }
          ]
        },
        {
          text: '📝 Codex Prompts',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/commands/codex/' },
            { text: 'Prep', link: '/commands/codex/prep' },
            { text: 'Review', link: '/commands/codex/review' }
          ]
        },
        {
          text: '🔧 CLI Reference',
          collapsible: true,
          items: [
            { text: 'CLI Commands', link: '/cli/commands' }
          ]
        }
      ],
      '/skills/': [
        {
          text: 'Overview',
          collapsible: false,
          items: [
            { text: 'Skills Guide', link: '/skills/' }
          ]
        },
        {
          text: '📚 Conventions',
          collapsible: true,
          items: [
            { text: 'Naming Conventions', link: '/skills/naming-conventions' }
          ]
        },
        {
          text: '⚡ Claude Skills',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/skills/claude-index' },
            { text: 'Collaboration', link: '/skills/claude-collaboration' },
            { text: 'Workflow', link: '/skills/claude-workflow' },
            { text: 'Memory', link: '/skills/claude-memory' },
            { text: 'Review', link: '/skills/claude-review' },
            { text: 'Meta', link: '/skills/claude-meta' }
          ]
        },
        {
          text: '🔧 Codex Skills',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/skills/codex-index' },
            { text: 'Lifecycle', link: '/skills/codex-lifecycle' },
            { text: 'Workflow', link: '/skills/codex-workflow' },
            { text: 'Specialized', link: '/skills/codex-specialized' }
          ]
        },
        {
          text: '🎨 Custom Skills',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/skills/custom' },
            { text: 'Core Skills', link: '/skills/core-skills' },
            { text: 'Reference', link: '/skills/reference' }
          ]
        },
        {
          text: '📋 Skill Specifications',
          collapsible: true,
          items: [
            { text: 'Document Standards', link: '/skills/specs/document-standards' },
            { text: 'Issue Classification', link: '/skills/specs/issue-classification' },
            { text: 'Quality Gates', link: '/skills/specs/quality-gates' },
            { text: 'Quality Standards', link: '/skills/specs/quality-standards' },
            { text: 'Reference Docs Spec', link: '/skills/specs/reference-docs-spec' },
            { text: 'Review Dimensions', link: '/skills/specs/review-dimensions' }
          ]
        },
        {
          text: '📄 Skill Templates',
          collapsible: true,
          items: [
            { text: 'Architecture Doc', link: '/skills/templates/architecture-doc' },
            { text: 'Autonomous Action', link: '/skills/templates/autonomous-action' },
            { text: 'Autonomous Orchestrator', link: '/skills/templates/autonomous-orchestrator' },
            { text: 'Epics Template', link: '/skills/templates/epics-template' },
            { text: 'Issue Template', link: '/skills/templates/issue-template' },
            { text: 'Product Brief', link: '/skills/templates/product-brief' },
            { text: 'Requirements PRD', link: '/skills/templates/requirements-prd' },
            { text: 'Review Report', link: '/skills/templates/review-report' },
            { text: 'Sequential Phase', link: '/skills/templates/sequential-phase' },
            { text: 'Skill Markdown', link: '/skills/templates/skill-md' }
          ]
        }
      ],
      '/features/': [
        {
          text: '⚙️ Core Features',
          collapsible: false,
          items: [
            { text: 'Spec System', link: '/features/spec' },
            { text: 'Memory System', link: '/features/memory' },
            { text: 'CLI Call', link: '/features/cli' },
            { text: 'Dashboard', link: '/features/dashboard' },
            { text: 'CodexLens', link: '/features/codexlens' }
          ]
        },
        {
          text: '🔌 Settings',
          collapsible: true,
          items: [
            { text: 'API Settings', link: '/features/api-settings' },
            { text: 'System Settings', link: '/features/system-settings' },
            { text: 'Settings', link: '/features/settings' }
          ]
        },
        {
          text: '🔍 Discovery & Explorer',
          collapsible: true,
          items: [
            { text: 'Discovery', link: '/features/discovery' },
            { text: 'Explorer', link: '/features/explorer' },
            { text: 'Extensions', link: '/features/extensions' }
          ]
        },
        {
          text: '📋 Issues & Tasks',
          collapsible: true,
          items: [
            { text: 'Issue Hub', link: '/features/issue-hub' },
            { text: 'Orchestrator', link: '/features/orchestrator' },
            { text: 'Queue', link: '/features/queue' },
            { text: 'Sessions', link: '/features/sessions' },
            { text: 'Tasks History', link: '/features/tasks-history' }
          ]
        },
        {
          text: '🖥️ Terminal',
          collapsible: true,
          items: [
            { text: 'Terminal Dashboard', link: '/features/terminal' }
          ]
        }
      ],
      '/components/': [
        {
          text: 'UI Components',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/components/index' },
            { text: 'Button', link: '/components/ui/button' },
            { text: 'Card', link: '/components/ui/card' },
            { text: 'Input', link: '/components/ui/input' },
            { text: 'Select', link: '/components/ui/select' },
            { text: 'Checkbox', link: '/components/ui/checkbox' },
            { text: 'Badge', link: '/components/ui/badge' }
          ]
        }
      ],
      '/mcp/': [
        {
          text: '🔗 MCP Tools',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/mcp/tools' }
          ]
        }
      ],
      '/reference/': [
        {
          text: '📚 Reference',
          collapsible: true,
          items: [
            { text: 'Commands & Skills', link: '/reference/commands-skills' },
            { text: 'Claude Code Hooks', link: '/reference/claude-code-hooks-guide' },
            { text: 'Hook Templates Analysis', link: '/reference/hook-templates-analysis' }
          ]
        }
      ],
      '/agents/': [
        {
          text: '🤖 Agents',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/agents/' },
            { text: 'Built-in Agents', link: '/agents/builtin' },
            { text: 'Custom Agents', link: '/agents/custom' }
          ]
        }
      ],
      '/workflows/': [
        {
          text: '🔄 Workflow System',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/workflows/' },
            { text: 'Comparison Table', link: '/workflows/comparison-table' },
            { text: '4-Level System', link: '/workflows/4-level' },
            { text: 'Examples', link: '/workflows/examples' },
            { text: 'Best Practices', link: '/workflows/best-practices' },
            { text: 'Teams', link: '/workflows/teams' }
          ]
        }
      ]
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/catlog22/Claude-Code-Workflow' }
    ],

    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present CCW Contributors'
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/catlog22/Claude-Code-Workflow/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    // Last updated
    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'short'
      }
    },

    // Search (handled by custom FlexSearch DocSearch component)
    search: false
  },

  // Markdown configuration
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    languages: [
      'bash',
      'shell',
      'powershell',
      'json',
      'yaml',
      'toml',
      'javascript',
      'typescript',
      'jsx',
      'tsx',
      'vue',
      'html',
      'css',
      'markdown',
      'python',
      'ruby',
      'diff',
      'xml',
      'mermaid'
    ],
    config: (md) => {
      md.core.ruler.before('block', 'demo-blocks', (state) => {
        const src = state.src
        const filePath = (state as any).path || ''
        const transformed = transformDemoBlocks(src, { path: filePath })
        if (transformed !== src) {
          state.src = transformed
        }
      })
    }
  },

  // locales
  locales: {
    root: {
      label: 'English',
      lang: 'en-US'
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Claude Code Workflow 文档',
      description: 'Claude Code Workspace - 高级 AI 驱动开发环境',
      themeConfig: {
        outline: {
          level: [2, 3],
          label: '本页目录'
        },
        nav: [
          { text: '指南', link: '/zh/guide/ch01-what-is-claude-dms3' },
          { text: '命令', link: '/zh/commands/claude/' },
          { text: '技能', link: '/zh/skills/claude-index' },
          { text: '功能', link: '/zh/features/spec' },
          { text: '参考', link: '/zh/reference/commands-skills' }
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '📖 指南',
              collapsible: false,
              items: [
                { text: 'Claude Code Workflow 是什么', link: '/zh/guide/ch01-what-is-claude-dms3' },
                { text: '快速开始', link: '/zh/guide/ch02-getting-started' },
                { text: '核心概念', link: '/zh/guide/ch03-core-concepts' },
                { text: '工作流基础', link: '/zh/guide/ch04-workflow-basics' },
                { text: '高级技巧', link: '/zh/guide/ch05-advanced-tips' },
                { text: '最佳实践', link: '/zh/guide/ch06-best-practices' }
              ]
            },
            {
              text: '🚀 快速入口',
              collapsible: true,
              items: [
                { text: '安装', link: '/zh/guide/installation' },
                { text: '第一个工作流', link: '/zh/guide/first-workflow' },
                { text: 'CLI 工具', link: '/zh/guide/cli-tools' }
              ]
            }
          ],
          '/zh/commands/': [
            {
              text: '🤖 Claude 命令',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/commands/claude/' },
                { text: '核心编排', link: '/zh/commands/claude/core-orchestration' },
                { text: '工作流', link: '/zh/commands/claude/workflow' },
                { text: '会话管理', link: '/zh/commands/claude/session' },
                { text: 'Issue', link: '/zh/commands/claude/issue' },
                { text: 'IDAW', link: '/zh/commands/claude/idaw' },
                { text: 'Memory', link: '/zh/commands/claude/memory' },
                { text: 'CLI', link: '/zh/commands/claude/cli' },
                { text: 'UI 设计', link: '/zh/commands/claude/ui-design' }
              ]
            },
            {
              text: '📝 Codex Prompts',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/commands/codex/' },
                { text: 'Prep', link: '/zh/commands/codex/prep' },
                { text: 'Review', link: '/zh/commands/codex/review' }
              ]
            }
          ],
          '/zh/skills/': [
            {
              text: '概述',
              collapsible: false,
              items: [
                { text: '技能指南', link: '/zh/skills/' }
              ]
            },
            {
              text: '📚 规范',
              collapsible: true,
              items: [
                { text: '命名规范', link: '/zh/skills/naming-conventions' }
              ]
            },
            {
              text: '⚡ Claude Skills',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/skills/claude-index' },
                { text: '协作', link: '/zh/skills/claude-collaboration' },
                { text: '工作流', link: '/zh/skills/claude-workflow' },
                { text: '记忆', link: '/zh/skills/claude-memory' },
                { text: '审查', link: '/zh/skills/claude-review' },
                { text: '元技能', link: '/zh/skills/claude-meta' }
              ]
            },
            {
              text: '🔧 Codex Skills',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/skills/codex-index' },
                { text: '生命周期', link: '/zh/skills/codex-lifecycle' },
                { text: '工作流', link: '/zh/skills/codex-workflow' },
                { text: '专项', link: '/zh/skills/codex-specialized' }
              ]
            },
            {
              text: '🎨 自定义技能',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/skills/custom' },
                { text: '核心技能', link: '/zh/skills/core-skills' },
                { text: '参考', link: '/zh/skills/reference' }
              ]
            }
          ],
          '/zh/features/': [
            {
              text: '⚙️ 核心功能',
              collapsible: false,
              items: [
                { text: 'Spec 规范系统', link: '/zh/features/spec' },
                { text: 'Memory 记忆系统', link: '/zh/features/memory' },
                { text: 'CLI 调用', link: '/zh/features/cli' },
                { text: 'Dashboard 面板', link: '/zh/features/dashboard' },
                { text: 'Terminal 终端仪表板', link: '/zh/features/terminal' },
                { text: 'Queue 队列管理', link: '/zh/features/queue' },
                { text: 'CodexLens', link: '/zh/features/codexlens' }
              ]
            },
            {
              text: '🔌 设置',
              collapsible: true,
              items: [
                { text: 'API 设置', link: '/zh/features/api-settings' },
                { text: '系统设置', link: '/zh/features/system-settings' }
              ]
            }
          ],
          '/zh/components/': [
            {
              text: 'UI 组件',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/components/index' },
                { text: 'Button 按钮', link: '/zh/components/ui/button' },
                { text: 'Card 卡片', link: '/zh/components/ui/card' },
                { text: 'Input 输入框', link: '/zh/components/ui/input' },
                { text: 'Select 选择器', link: '/zh/components/ui/select' },
                { text: 'Checkbox 复选框', link: '/zh/components/ui/checkbox' },
                { text: 'Badge 徽章', link: '/zh/components/ui/badge' }
              ]
            }
          ],
          '/zh/workflows/': [
            {
              text: '🔄 工作流系统',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/workflows/' },
                { text: '工作流对比', link: '/zh/workflows/comparison-table' },
                { text: '四级体系', link: '/zh/workflows/4-level' },
                { text: '最佳实践', link: '/zh/workflows/best-practices' },
                { text: '团队协作', link: '/zh/workflows/teams' }
              ]
            }
          ],
          '/zh/reference/': [
            {
              text: '📚 参考',
              collapsible: true,
              items: [
                { text: '命令与技能参考', link: '/zh/reference/commands-skills' }
              ]
            }
          ]
        }
      }
    },
  }
}))
