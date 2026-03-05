---
title: Checkbox 复选框
description: 用于二元选择的复选框组件
sidebar: auto
---

# Checkbox 复选框

## 概述

Checkbox 复选框组件允许用户从一组选项中选择一个或多个选项。基于 Radix UI Checkbox Primitive 构建，提供完整的无障碍支持，包括键盘导航。

## 语法演示

:::demo checkbox-variants
展示不同的复选框状态，包括选中、未选中、半选和禁用状态
:::

## 属性

<PropsTable :props="[
  { name: 'checked', type: 'boolean | \'indeterminate\'', required: false, default: 'false', description: '是否选中复选框' },
  { name: 'defaultChecked', type: 'boolean', required: false, default: 'false', description: '初始选中状态（非受控）' },
  { name: 'onCheckedChange', type: '(checked: boolean) => void', required: false, default: '-', description: '选中状态变化时的回调函数' },
  { name: 'disabled', type: 'boolean', required: false, default: 'false', description: '是否禁用复选框' },
  { name: 'required', type: 'boolean', required: false, default: 'false', description: '是否为必填项' },
  { name: 'name', type: 'string', required: false, default: '-', description: '表单输入名称' },
  { name: 'value', type: 'string', required: false, default: '-', description: '表单输入值' },
  { name: 'className', type: 'string', required: false, default: '-', description: '自定义 CSS 类名' }
]" />

## 状态说明

### Unchecked（未选中）

复选框未被选择时的默认状态。

### Checked（已选中）

复选框被选择时显示勾选图标。

### Indeterminate（半选）

混合状态（部分选择），通常用于父级复选框，当部分但不是全部子项被选中时使用。

### Disabled（禁用）

禁用的复选框不可交互，并以降低的透明度显示。

## 使用示例

### 基础复选框

```vue
<Checkbox />
```

### 带标签的复选框

```vue
<div class="flex items-center space-x-2">
  <Checkbox id="terms" />
  <label for="terms">我同意条款和条件</label>
</div>
```

### 受控复选框

```vue
<script setup>
import { ref } from 'vue'

const checked = ref(false)
</script>

<template>
  <div class="flex items-center space-x-2">
    <Checkbox v-model:checked="checked" />
    <span>{{ checked ? '已选中' : '未选中' }}</span>
  </div>
</template>
```

### 半选状态

```vue
<script setup>
import { ref } from 'vue'

const state = ref('indeterminate')
</script>

<template>
  <Checkbox :checked="state" />
</template>
```

### 表单集成

```vue
<form @submit="handleSubmit">
  <div class="space-y-2">
    <div class="flex items-center space-x-2">
      <Checkbox id="newsletter" name="newsletter" value="yes" />
      <label for="newsletter">订阅新闻通讯</label>
    </div>
    <div class="flex items-center space-x-2">
      <Checkbox id="updates" name="updates" value="yes" />
      <label for="updates">接收产品更新</label>
    </div>
  </div>
  <Button type="submit" class="mt-4">提交</Button>
</form>
```

## 相关组件

- [Input 输入框](/zh/components/ui/input)
- [Select 选择器](/zh/components/ui/select)
- Radio Group 单选框组
