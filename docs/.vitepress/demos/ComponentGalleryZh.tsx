/**
 * 组件库展示演示 (中文版)
 * 所有 UI 组件的交互式展示
 */
import React, { useState } from 'react'

export default function ComponentGalleryZh() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [buttonVariant, setButtonVariant] = useState('default')
  const [switchState, setSwitchState] = useState(false)
  const [checkboxState, setCheckboxState] = useState(false)
  const [selectedTab, setSelectedTab] = useState('variants')

  const categories = [
    { id: 'all', label: '全部组件' },
    { id: 'buttons', label: '按钮' },
    { id: 'forms', label: '表单' },
    { id: 'feedback', label: '反馈' },
    { id: 'navigation', label: '导航' },
    { id: 'overlays', label: '叠加层' },
  ]

  const buttonVariants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']

  return (
    <div className="p-6 bg-background space-y-8">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">UI 组件库</h1>
        <p className="text-muted-foreground">所有可用 UI 组件的交互式展示</p>
      </div>

      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-accent'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 按钮部分 */}
      {(selectedCategory === 'all' || selectedCategory === 'buttons') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">按钮</h2>
          <div className="space-y-6">
            {/* 变体选择器 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">变体</label>
              <div className="flex flex-wrap gap-2">
                {buttonVariants.map((variant) => (
                  <button
                    key={variant}
                    onClick={() => setButtonVariant(variant)}
                    className={`px-4 py-2 rounded-md text-sm capitalize transition-colors ${
                      buttonVariant === variant
                        ? 'bg-primary text-primary-foreground ring-2 ring-ring'
                        : 'border hover:bg-accent'
                    }`}
                  >
                    {variant}
                  </button>
                ))}
              </div>
            </div>

            {/* 按钮尺寸 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">尺寸</label>
              <div className="flex items-center gap-3 flex-wrap">
                <button className={`h-8 rounded-md px-3 text-sm ${buttonVariant === 'default' ? 'bg-primary text-primary-foreground' : 'border'}`}>
                  小
                </button>
                <button className={`h-10 px-4 py-2 rounded-md text-sm ${buttonVariant === 'default' ? 'bg-primary text-primary-foreground' : 'border'}`}>
                  默认
                </button>
                <button className={`h-11 rounded-md px-8 text-sm ${buttonVariant === 'default' ? 'bg-primary text-primary-foreground' : 'border'}`}>
                  大
                </button>
                <button className={`h-10 w-10 rounded-md flex items-center justify-center ${buttonVariant === 'default' ? 'bg-primary text-primary-foreground' : 'border'}`}>
                  ⚙
                </button>
              </div>
            </div>

            {/* 所有按钮变体 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">所有变体</label>
              <div className="flex flex-wrap gap-3 p-4 border rounded-lg bg-muted/20">
                <button className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90">默认</button>
                <button className="px-4 py-2 rounded-md text-sm bg-destructive text-destructive-foreground hover:opacity-90">危险</button>
                <button className="px-4 py-2 rounded-md text-sm border bg-background hover:bg-accent">轮廓</button>
                <button className="px-4 py-2 rounded-md text-sm bg-secondary text-secondary-foreground hover:opacity-80">次要</button>
                <button className="px-4 py-2 rounded-md text-sm hover:bg-accent">幽灵</button>
                <button className="px-4 py-2 rounded-md text-sm text-primary underline-offset-4 hover:underline">链接</button>
                <button className="px-4 py-2 rounded-md text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90">渐变</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 表单部分 */}
      {(selectedCategory === 'all' || selectedCategory === 'forms') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">表单组件</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 输入框 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">输入框</label>
              <input
                type="text"
                placeholder="输入文本..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                placeholder="错误状态"
                className="flex h-10 w-full rounded-md border border-destructive bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
              />
            </div>

            {/* 文本域 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">文本域</label>
              <textarea
                placeholder="输入多行文本..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* 复选框 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">复选框</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border border-primary" checked={checkboxState} onChange={(e) => setCheckboxState(e.target.checked)} />
                  <span>接受条款和条件</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer opacity-50">
                  <input type="checkbox" className="h-4 w-4 rounded border border-primary" />
                  <span>订阅新闻通讯</span>
                </label>
              </div>
            </div>

            {/* 开关 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">开关</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={switchState} onChange={(e) => setSwitchState(e.target.checked)} />
                    <div className="w-9 h-5 bg-input rounded-full peer peer-focus:ring-2 peer-focus:ring-ring peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                  </div>
                  <span className="text-sm">启用通知 {switchState ? '(开)' : '(关)'}</span>
                </label>
              </div>
            </div>

            {/* 选择器 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">选择器</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">选择一个选项</option>
                <option value="1">选项 1</option>
                <option value="2">选项 2</option>
                <option value="3">选项 3</option>
              </select>
            </div>

            {/* 表单操作 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">表单操作</label>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90">提交</button>
                <button className="px-4 py-2 rounded-md text-sm border hover:bg-accent">取消</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 反馈部分 */}
      {(selectedCategory === 'all' || selectedCategory === 'feedback') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">反馈组件</h2>

          {/* 徽标 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">徽标</label>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary text-primary-foreground">默认</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">次要</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-destructive text-destructive-foreground">危险</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-success text-white">成功</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-warning text-white">警告</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-info text-white">信息</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground">轮廓</span>
            </div>
          </div>

          {/* 进度条 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">进度条</label>
            <div className="space-y-3 max-w-md">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>处理中...</span>
                  <span>65%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: '65%' }}/>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>上传中...</span>
                  <span>30%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: '30%' }}/>
                </div>
              </div>
            </div>
          </div>

          {/* 提示 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">提示</label>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 border rounded-lg bg-destructive/10 border-destructive/20 text-destructive">
                <span className="text-lg">⚠</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">发生错误</div>
                  <div className="text-xs mt-1 opacity-80">出错了，请重试。</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 border rounded-lg bg-success/10 border-success/20 text-success">
                <span className="text-lg">✓</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">成功！</div>
                  <div className="text-xs mt-1 opacity-80">您的更改已保存。</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 导航部分 */}
      {(selectedCategory === 'all' || selectedCategory === 'navigation') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">导航组件</h2>

          {/* 标签页 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">标签页</label>
            <div className="border-b">
              <div className="flex gap-4">
                {['概览', '文档', 'API 参考', '示例'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedTab(tab.toLowerCase().replace(' ', '-'))}
                    className={`pb-3 px-1 text-sm border-b-2 transition-colors ${
                      selectedTab === tab.toLowerCase().replace(' ', '-')
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 面包屑 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">面包屑</label>
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground">首页</a>
              <span>/</span>
              <a href="#" className="hover:text-foreground">组件</a>
              <span>/</span>
              <span className="text-foreground">库</span>
            </nav>
          </div>
        </section>
      )}

      {/* 叠加层部分 */}
      {(selectedCategory === 'all' || selectedCategory === 'overlays') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">叠加层组件</h2>

          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">对话框</h3>
              <p className="text-muted-foreground text-xs">用于专注用户交互的模态对话框。</p>
              <button className="mt-3 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded">打开对话框</button>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">抽屉</h3>
              <p className="text-muted-foreground text-xs">从屏幕边缘滑入的侧边面板。</p>
              <button className="mt-3 px-3 py-1.5 text-xs border rounded hover:bg-accent">打开抽屉</button>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">下拉菜单</h3>
              <p className="text-muted-foreground text-xs">上下文菜单和操作列表。</p>
              <button className="mt-3 px-3 py-1.5 text-xs border rounded hover:bg-accent">▼ 打开菜单</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
