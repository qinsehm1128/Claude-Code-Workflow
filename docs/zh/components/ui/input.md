---
title: Input 输入框
description: 用于表单和用户输入的文本输入组件
sidebar: auto
---

# Input 输入框

## 概述

输入框组件提供了一个样式化的文本输入字段，扩展了原生 HTML input 元素，具有一致的样式和错误状态支持。

## 语法演示

:::demo input-variants
展示所有输入框状态，包括默认、错误和禁用
:::

## 属性

<PropsTable :props="[
  { name: 'type', type: 'string', required: false, default: '\'text\'', description: 'HTML input 类型（text、password、email、number 等）' },
  { name: 'error', type: 'boolean', required: false, default: 'false', description: '输入框是否处于错误状态（显示破坏性边框）' },
  { name: 'disabled', type: 'boolean', required: false, default: 'false', description: '是否禁用输入框' },
  { name: 'placeholder', type: 'string', required: false, default: '-', description: '输入框为空时显示的占位符文本' },
  { name: 'value', type: 'string | number', required: false, default: '-', description: '受控输入框的值' },
  { name: 'defaultValue', type: 'string | number', required: false, default: '-', description: '非受控输入框的默认值' },
  { name: 'onChange', type: '(event: ChangeEvent) => void', required: false, default: '-', description: '变更事件回调函数' },
  { name: 'className', type: 'string', required: false, default: '-', description: '自定义 CSS 类名' }
]" />

## 状态

### Default（默认）

带有边框和焦点环的标准输入框。

### Error（错误）

错误状态，显示破坏性边框颜色。将 `error` 属性设置为 `true`。

### Disabled（禁用）

禁用状态，透明度降低。将 `disabled` 属性设置为 `true`。

### Focus（聚焦）

聚焦状态，带有环形轮廓。

## 使用示例

### 基础输入框

```tsx
import { Input } from '@/components/ui/Input'

function Example() {
  return <input type="text" placeholder="输入文本..." />
}
```

### 受控输入框

```tsx
import { Input } from '@/components/ui/Input'

function Example() {
  const [value, setValue] = useState('')

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="输入文本..."
    />
  )
}
```

### 错误状态输入框

```tsx
import { Input } from '@/components/ui/Input'

function Example() {
  return (
    <Input
      type="text"
      error
      placeholder="无效输入..."
    />
  )
}
```

### 密码输入框

```tsx
import { Input } from '@/components/ui/Input'

function Example() {
  return <Input type="password" placeholder="输入密码..." />
}
```

## 无障碍访问

- **键盘导航**：完全支持原生键盘操作
- **ARIA 属性**：支持所有标准输入框 ARIA 属性
- **焦点可见**：为键盘导航提供清晰的焦点指示器
- **错误状态**：错误状态的视觉指示（与 `aria-invalid` 和 `aria-describedby` 配合使用）

## 相关组件

- [Button 按钮](/zh/components/ui/button)
- [Select 选择器](/zh/components/ui/select)
- [Checkbox 复选框](/zh/components/ui/checkbox)
