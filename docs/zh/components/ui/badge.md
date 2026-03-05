---
title: Badge 徽章
description: 用于视觉分类的小型状态或标签组件
sidebar: auto
---

# Badge 徽章

## 概述

Badge 徽章组件用于以紧凑形式显示状态、类别或标签。它通常用于标签、状态指示器和计数。

## 语法演示

:::demo badge-variants
展示所有可用的徽章变体，包括默认、次要、破坏性、轮廓、成功、警告、信息、审查和渐变样式
:::

## 属性

<PropsTable :props="[
  { name: 'variant', type: '\'default\' | \'secondary\' | \'destructive\' | \'outline\' | \'success\' | \'warning\' | \'info\' | \'review\' | \'gradient\'', required: false, default: '\'default\'', description: '视觉样式变体' },
  { name: 'className', type: 'string', required: false, default: '-', description: '自定义 CSS 类名' },
  { name: 'children', type: 'ReactNode', required: true, default: '-', description: '徽章内容' }
]" />

## 变体说明

### Default（默认）

主题色背景的主要徽章。用于主要标签和类别。

### Secondary（次要）

次要信息的灰色徽章。

### Destructive（破坏性）

红色徽章，用于错误、危险状态或负面状态指示。

### Outline（轮廓）

只有文本和边框、无背景的徽章。用于微妙的标签。

### Success（成功）

绿色徽章，用于成功状态、完成的操作或正面状态指示。

### Warning（警告）

黄色/琥珀色徽章，用于警告、待处理状态或注意事项。

### Info（信息）

蓝色徽章，用于信息内容或中性状态。

### Review（审查）

紫色徽章，用于审查状态、待审查或反馈指示器。

### Gradient（渐变）

带品牌渐变背景的徽章，用于特色或突出显示的项目。

## 使用示例

### 基础徽章

```vue
<Badge>默认</Badge>
```

### 状态指示器

```vue
<Badge variant="success">活跃</Badge>
<Badge variant="warning">待处理</Badge>
<Badge variant="destructive">失败</Badge>
<Badge variant="info">草稿</Badge>
```

### 计数徽章

```vue
<div class="relative">
  <Bell />
  <Badge variant="destructive" class="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
    3
  </Badge>
</div>
```

### 分类标签

```vue
<div class="flex gap-2">
  <Badge variant="outline">React</Badge>
  <Badge variant="outline">TypeScript</Badge>
  <Badge variant="outline">Tailwind</Badge>
</div>
```

### 审查状态

```vue
<Badge variant="review">审查中</Badge>
```

### 渐变徽章

```vue
<Badge variant="gradient">特色</Badge>
```

## 相关组件

- [Card 卡片](/zh/components/ui/card)
- [Button 按钮](/zh/components/ui/button)
- Avatar 头像
