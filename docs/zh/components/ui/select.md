---
title: Select 选择器
description: 用于从选项列表中选择值的下拉选择组件
sidebar: auto
---

# Select 选择器

## 概述

Select 选择器组件允许用户从选项列表中选择单个值。基于 Radix UI Select Primitive 构建，提供开箱即用的无障碍支持和键盘导航。

## 语法演示

:::demo select-variants
展示不同的选择器配置，包括基础用法、带标签和带分隔线的示例
:::

## 子组件

Select 选择器组件包含以下子组件：

| 组件 | 用途 |
|------|------|
| `Select` | 管理状态的根组件 |
| `SelectTrigger` | 打开下拉菜单的按钮 |
| `SelectValue` | 显示选中的值 |
| `SelectContent` | 下拉菜单内容容器 |
| `SelectItem` | 单个可选项 |
| `SelectLabel` | 用于分组的不可交互标签 |
| `SelectGroup` | 将项目分组 |
| `SelectSeparator` | 项目之间的视觉分隔线 |
| `SelectScrollUpButton` | 长列表的向上滚动按钮 |
| `SelectScrollDownButton` | 长列表的向下滚动按钮 |

## 属性

### Select 根组件

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `value` | `string` | - | 当前选中的值（受控） |
| `defaultValue` | `string` | - | 默认选中的值 |
| `onValueChange` | `(value: string) => void` | - | 值变化时的回调函数 |
| `disabled` | `boolean` | `false` | 是否禁用选择器 |
| `required` | `boolean` | `false` | 是否必填 |
| `name` | `string` | - | 表单输入名称 |

### SelectTrigger

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `className` | `string` | - | 自定义 CSS 类名 |

### SelectItem

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `value` | `string` | - | 选项值 |
| `disabled` | `boolean` | `false` | 是否禁用该选项 |
| `className` | `string` | - | 自定义 CSS 类名 |

## 使用示例

### 基础选择器

```vue
<Select>
  <SelectTrigger>
    <SelectValue placeholder="请选择一个选项" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">选项 1</SelectItem>
    <SelectItem value="option2">选项 2</SelectItem>
    <SelectItem value="option3">选项 3</SelectItem>
  </SelectContent>
</Select>
```

### 带标签和分组

```vue
<Select>
  <SelectTrigger>
    <SelectValue placeholder="选择水果" />
  </SelectTrigger>
  <SelectContent>
    <SelectLabel>水果</SelectLabel>
    <SelectItem value="apple">苹果</SelectItem>
    <SelectItem value="banana">香蕉</SelectItem>
    <SelectItem value="orange">橙子</SelectItem>
    <SelectSeparator />
    <SelectLabel>蔬菜</SelectLabel>
    <SelectItem value="carrot">胡萝卜</SelectItem>
    <SelectItem value="broccoli">西兰花</SelectItem>
  </SelectContent>
</Select>
```

### 受控选择器

```vue
<script setup>
import { ref } from 'vue'

const selectedValue = ref('')
</script>

<template>
  <Select v-model="selectedValue">
    <SelectTrigger>
      <SelectValue placeholder="请选择..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="a">选项 A</SelectItem>
      <SelectItem value="b">选项 B</SelectItem>
      <SelectItem value="c">选项 C</SelectItem>
    </SelectContent>
  </Select>
</template>
```

## 相关组件

- [Input 输入框](/zh/components/ui/input)
- [Checkbox 复选框](/zh/components/ui/checkbox)
- [Button 按钮](/zh/components/ui/button)
