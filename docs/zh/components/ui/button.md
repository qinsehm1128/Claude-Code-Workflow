---
title: Button 按钮
description: 按钮组件用于触发操作或提交表单
sidebar: auto
---

# Button 按钮

## 概述

按钮是最常用的交互元素之一，用于触发操作、提交表单或导航到其他页面。

## 语法演示

:::demo button-variants
展示所有视觉变体的按钮组件
:::

## 属性

<PropsTable :props="[
  { name: 'variant', type: '\'default\' | \'destructive\' | \'outline\' | \'secondary\' | \'ghost\' | \'link\' | \'gradient\' | \'gradientPrimary\'', required: false, default: '\'default\'', description: '按钮的视觉变体' },
  { name: 'size', type: '\'default\' | \'sm\' | \'lg\' | \'icon\'', required: false, default: '\'default\'', description: '按钮的大小' },
  { name: 'asChild', type: 'boolean', required: false, default: 'false', description: '是否将 props 与子元素合并（用于 Radix UI 组合）' },
  { name: 'disabled', type: 'boolean', required: false, default: 'false', description: '是否禁用按钮' },
  { name: 'onClick', type: '() => void', required: false, default: '-', description: '点击事件回调函数' },
  { name: 'className', type: 'string', required: false, default: '-', description: '自定义 CSS 类名' },
  { name: 'children', type: 'ReactNode', required: true, default: '-', description: '按钮内容' }
]" />

## 变体说明

### Default（默认）

默认按钮用于主要的操作场景。

### Destructive（破坏性）

破坏性按钮用于删除、移除等不可逆的操作。

### Outline（轮廓）

轮廓按钮用于次要操作，视觉上更轻量。

### Secondary（次要）

次要按钮用于辅助操作。

### Ghost（幽灵）

幽灵按钮没有边框，视觉上最轻量。

### Link（链接）

链接按钮看起来像链接，但具有按钮的交互行为。

### Gradient（渐变）

渐变按钮使用品牌渐变色，悬停时带有发光效果。

### Gradient Primary（主色渐变）

主色渐变按钮使用主题主色渐变，悬停时带有增强的发光效果。

## 使用场景

| 场景 | 推荐变体 |
|------|----------|
| 主要操作（提交、保存） | default, gradientPrimary |
| 危险操作（删除、移除） | destructive |
| 次要操作 | outline, secondary |
| 取消操作 | ghost, outline |
| 导航链接 | link |
| 促销/特色 CTA | gradient |

## 相关组件

- [Input 输入框](/zh/components/ui/input)
- [Select 选择器](/zh/components/ui/select)
- Dialog 对话框
