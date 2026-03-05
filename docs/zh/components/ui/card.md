---
title: Card 卡片
description: 用于分组相关内容的容器组件
sidebar: auto
---

# Card 卡片

## 概述

卡片组件是一个通用的容器，用于分组相关的内容和操作。它由多个子组件组成，协同工作以创建连贯的卡片布局。

## 语法演示

:::demo card-variants
展示不同的卡片布局，包括页眉、内容、页脚和渐变边框变体
:::

## 组件

卡片组件包含以下子组件：

| 组件 | 用途 |
|------|------|
| `Card` | 带有边框和背景的主容器 |
| `CardHeader` | 带有内边距的页眉部分 |
| `CardTitle` | 标题元素 |
| `CardDescription` | 带有次要颜色的描述文本 |
| `CardContent` | 带有顶部内边距的内容区域 |
| `CardFooter` | 用于操作的页脚部分 |
| `CardGradientBorder` | 带有渐变边框的卡片 |

## 属性

所有 Card 组件接受标准 HTML div 属性：

| 组件 | 属性 |
|------|------|
| `Card` | `className?: string` |
| `CardHeader` | `className?: string` |
| `CardTitle` | `className?: string`, `children?: ReactNode` |
| `CardDescription` | `className?: string`, `children?: ReactNode` |
| `CardContent` | `className?: string` |
| `CardFooter` | `className?: string` |
| `CardGradientBorder` | `className?: string` |

## 使用示例

### 基础卡片

```vue
<Card>
  <CardContent>
    <p>这是一个带有内容的基础卡片。</p>
  </CardContent>
</Card>
```

### 带页眉的卡片

```vue
<Card>
  <CardHeader>
    <CardTitle>卡片标题</CardTitle>
    <CardDescription>卡片描述放在这里</CardDescription>
  </CardHeader>
  <CardContent>
    <p>卡片内容放在这里。</p>
  </CardContent>
</Card>
```

### 带页脚的完整卡片

```vue
<Card>
  <CardHeader>
    <CardTitle>项目设置</CardTitle>
    <CardDescription>管理您的项目配置</CardDescription>
  </CardHeader>
  <CardContent>
    <p>配置您的项目设置和偏好。</p>
  </CardContent>
  <CardFooter>
    <Button>保存更改</Button>
  </CardFooter>
</Card>
```

### 带渐变边框的卡片

```vue
<CardGradientBorder>
  <CardHeader>
    <CardTitle>特色卡片</CardTitle>
  </CardHeader>
  <CardContent>
    <p>此卡片具有渐变边框效果。</p>
  </CardContent>
</CardGradientBorder>
```

## 相关组件

- [Button 按钮](/zh/components/ui/button)
- [Badge 徽章](/zh/components/ui/badge)
- Separator 分隔线
