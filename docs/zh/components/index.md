# 组件库

## 一句话概述
**基于 Radix UI 原语和 Tailwind CSS 构建的可复用 UI 组件综合集合，遵循 shadcn/ui 模式，提供一致、可访问和可定制的界面。**

---

## 概述

**位置**: `ccw/frontend/src/components/ui/`

**用途**: 为构建 CCW 前端应用程序提供一致的 UI 组件集合。

**技术栈**:
- **Radix UI**: 无样式、可访问的组件原语
- **Tailwind CSS**: 带自定义主题的实用优先样式
- **class-variance-authority (CVA)**: 类型安全的变体 props 管理
- **Lucide React**: 一致的图标系统

---

## 实时演示：组件库展示


:::demo ComponentGallery #ComponentGalleryZh.tsx :::

---

## 可用组件

### 表单组件

| 组件 | 描述 | Props |
|------|------|------|
| [Button](/components/ui/button) | 可点击的操作按钮，带变体和尺寸 | `variant`, `size`, `asChild` |
| [Input](/components/ui/input) | 文本输入字段 | `error` |
| Textarea | 多行文本输入 | `error` |
| [Select](/components/ui/select) | 下拉选择（Radix） | Select 组件 |
| [Checkbox](/components/ui/checkbox) | 布尔复选框（Radix） | `checked`, `onCheckedChange` |
| Switch | 切换开关 | `checked`, `onCheckedChange` |

### 布局组件

| 组件 | 描述 | Props |
|------|------|------|
| [Card](/components/ui/card) | 带标题/脚注的内容容器 | 嵌套组件 |
| Separator | 视觉分隔符 | `orientation` |
| ScrollArea | 自定义滚动条容器 | - |

### 反馈组件

| 组件 | 描述 | Props |
|------|------|------|
| [Badge](/components/ui/badge) | 状态指示器标签 | `variant` |
| Progress | 进度条 | `value` |
| Alert | 通知消息 | `variant` |
| Toast | 临时通知（Radix） | Toast 组件 |

### 导航组件

| 组件 | 描述 | Props |
|------|------|------|
| Tabs | 标签页导航（Radix） | Tabs 组件 |
| TabsNavigation | 自定义标签栏 | `tabs`, `value`, `onValueChange` |
| Breadcrumb | 导航面包屑 | Breadcrumb 组件 |

### 叠加层组件

| 组件 | 描述 | Props |
|------|------|------|
| Dialog | 模态对话框（Radix） | `open`, `onOpenChange` |
| Drawer | 侧边面板（Radix） | `open`, `onOpenChange` |
| Dropdown Menu | 上下文菜单（Radix） | Dropdown 组件 |
| Popover | 浮动内容（Radix） | `open`, `onOpenChange` |
| Tooltip | 悬停工具提示（Radix） | `content` |
| AlertDialog | 确认对话框（Radix） | Dialog 组件 |

### 展开组件

| 组件 | 描述 | Props |
|------|------|------|
| Collapsible | 展开/折叠内容（Radix） | `open`, `onOpenChange` |
| Accordion | 可折叠部分（Radix） | Accordion 组件 |

---

## 按钮变体

Button 组件通过 CVA（class-variance-authority）支持 8 种变体：

| 变体 | 用途 | 预览 |
|---------|----------|--------|
| `default` | 主要操作 | <span className="inline-block px-3 py-1 rounded bg-primary text-primary-foreground text-xs">默认</span> |
| `destructive` | 危险操作 | <span className="inline-block px-3 py-1 rounded bg-destructive text-destructive-foreground text-xs">危险</span> |
| `outline` | 次要操作 | <span className="inline-block px-3 py-1 rounded border text-xs">轮廓</span> |
| `secondary` | 较少强调 | <span className="inline-block px-3 py-1 rounded bg-secondary text-secondary-foreground text-xs">次要</span> |
| `ghost` | 微妙操作 | <span className="inline-block px-3 py-1 rounded text-xs">幽灵</span> |
| `link` | 文本链接 | <span className="inline-block px-3 py-1 underline text-primary text-xs">链接</span> |
| `gradient` | 特色操作 | <span className="inline-block px-3 py-1 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs">渐变</span> |
| `gradientPrimary` | 主要渐变 | <span className="inline-block px-3 py-1 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">主要</span> |

### 按钮尺寸

| 尺寸 | 高度 | 内边距 |
|------|--------|---------|
| `sm` | 36px | 水平 12px |
| `default` | 40px | 水平 16px |
| `lg` | 44px | 水平 32px |
| `icon` | 40px | 正方形（仅图标） |

---

## 徽章变体

Badge 组件支持 9 种变体，用于不同的状态类型：

| 变体 | 用途 | 颜色 |
|---------|----------|-------|
| `default` | 一般信息 | 主要主题 |
| `secondary` | 较少强调 | 次要主题 |
| `destructive` | 错误/危险 | 危险主题 |
| `outline` | 微妙 | 仅文本颜色 |
| `success` | 成功状态 | 绿色 |
| `warning` | 警告状态 | 琥珀色 |
| `info` | 信息 | 蓝色 |
| `review` | 审查状态 | 紫色 |
| `gradient` | 特色 | 品牌渐变 |

---

## 使用示例

### Button

```tsx
import { Button } from '@/components/ui/Button'

<Button variant="default" onClick={handleClick}>
  点击我
</Button>

<Button variant="destructive" size="sm">
  删除
</Button>

<Button variant="ghost" size="icon">
  <SettingsIcon />
</Button>
```

### Input with Error State

```tsx
import { Input } from '@/components/ui/Input'

<Input
  type="text"
  error={hasError}
  placeholder="输入您的名称"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

### Checkbox

```tsx
import { Checkbox } from '@/components/ui/Checkbox'

<Checkbox
  checked={accepted}
  onCheckedChange={setAccepted}
/>
<label>接受条款</label>
```

### Switch

```tsx
import { Switch } from '@/components/ui/Switch'

<Switch
  checked={enabled}
  onCheckedChange={setEnabled}
/>
<span>启用功能</span>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

<Card>
  <CardHeader>
    <CardTitle>卡片标题</CardTitle>
    <CardDescription>简短描述在这里</CardDescription>
  </CardHeader>
  <CardContent>
    <p>主要内容放在这里。</p>
  </CardContent>
  <CardFooter>
    <Button>操作</Button>
  </CardFooter>
</Card>
```

### Badge

```tsx
import { Badge, badgeVariants } from '@/components/ui/Badge'

<Badge variant="success">已完成</Badge>
<Badge variant="warning">待处理</Badge>
<Badge variant="destructive">失败</Badge>
```

---

## 可访问性

所有组件遵循 Radix UI 的可访问性标准：

- **键盘导航**：所有交互组件完全可键盘访问
- **ARIA 属性**：正确的角色、状态和属性
- **屏幕阅读器支持**：语义化 HTML 和 ARIA 标签
- **焦点管理**：可见的焦点指示器和逻辑 Tab 顺序
- **颜色对比度**：符合 WCAG AA 标准的颜色组合

### 键盘快捷键

| 组件 | 按键 |
|-----------|-------|
| Button | <kbd>Enter</kbd>, <kbd>Space</kbd> |
| Checkbox/Switch | <kbd>Space</kbd> 切换 |
| Select | <kbd>Arrow</kbd> 键，<kbd>Enter</kbd> 选择，<kbd>Esc</kbd> 关闭 |
| Dialog | <kbd>Esc</kbd> 关闭 |
| Tabs | <kbd>Arrow</kbd> 键导航 |
| Dropdown | <kbd>Arrow</kbd> 键，<kbd>Enter</kbd> 选择 |

---

## 相关链接

- [Radix UI Primitives](https://www.radix-ui.com/) - 无头 UI 组件库
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先 CSS 框架
- [shadcn/ui](https://ui.shadcn.com/) - 组件模式参考
- [CVA Documentation](https://cva.style/) - Class Variance Authority
