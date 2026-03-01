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

:::demo ComponentGallery
# component-gallery.tsx
/**
 * 组件库展示演示
 * 所有 UI 组件的交互式展示
 */
export function ComponentGallery() {
  const [selectedCategory, setSelectedCategory] = React.useState('all')
  const [buttonVariant, setButtonVariant] = React.useState('default')
  const [switchState, setSwitchState] = React.useState(false)
  const [checkboxState, setCheckboxState] = React.useState(false)
  const [selectedTab, setSelectedTab] = React.useState('variants')

  const categories = [
    { id: 'all', label: '全部组件' },
    { id: 'buttons', label: '按钮' },
    { id: 'forms', label: '表单' },
    { id: 'feedback', label: '反馈' },
    { id: 'navigation', label: '导航' },
    { id: 'overlays', label: '叠加层' },
  ]

  const components = {
    buttons: [
      { name: 'Button', variants: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'gradient'] },
    ],
    forms: [
      { name: 'Input', type: 'text' },
      { name: 'Textarea', type: 'textarea' },
      { name: 'Select', type: 'select' },
      { name: 'Checkbox', type: 'checkbox' },
      { name: 'Switch', type: 'switch' },
    ],
    feedback: [
      { name: 'Badge', variants: ['default', 'secondary', 'success', 'warning', 'destructive'] },
      { name: 'Progress', type: 'progress' },
      { name: 'Alert', type: 'alert' },
    ],
    navigation: [
      { name: 'Tabs', type: 'tabs' },
      { name: 'Breadcrumb', type: 'breadcrumb' },
    ],
    overlays: [
      { name: 'Dialog', type: 'dialog' },
      { name: 'Drawer', type: 'drawer' },
      { name: 'Dropdown', type: 'dropdown' },
    ],
  }

  const buttonVariants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']

  return (
    <div className="p-6 bg-background space-y-8">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">UI 组件库</h1>
        <p className="text-muted-foreground">所有可用 UI 组件的交互式展示</p>
      </div>

      {/* 分类过滤 */}
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

            {/* 文本区域 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">文本区域</label>
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

            {/* 下拉选择 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">下拉选择</label>
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

          {/* 徽章 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">徽章</label>
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

          {/* 警告 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">警告提示</label>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 border rounded-lg bg-destructive/10 border-destructive/20 text-destructive">
                <span className="text-lg">⚠</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">发生错误</div>
                  <div className="text-xs mt-1 opacity-80">出现了一些问题，请重试。</div>
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
              <p className="text-muted-foreground text-xs">用于焦点用户交互的模态对话框。</p>
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
:::

---

## 可用组件

### 表单组件

| 组件 | 描述 | Props |
|------|------|------|
| [Button](/components/ui/button) | 可点击的操作按钮，带变体和尺寸 | `variant`, `size`, `asChild` |
| [Input](/components/ui/input) | 文本输入字段 | `error` |
| [Textarea](/components/ui/textarea) | 多行文本输入 | `error` |
| [Select](/components/ui/select) | 下拉选择（Radix） | Select 组件 |
| [Checkbox](/components/ui/checkbox) | 布尔复选框（Radix） | `checked`, `onCheckedChange` |
| [Switch](/components/ui/switch) | 切换开关 | `checked`, `onCheckedChange` |

### 布局组件

| 组件 | 描述 | Props |
|------|------|------|
| [Card](/components/ui/card) | 带标题/脚注的内容容器 | 嵌套组件 |
| [Separator](/components/ui/separator) | 视觉分隔符 | `orientation` |
| [ScrollArea](/components/ui/scroll-area) | 自定义滚动条容器 | - |

### 反馈组件

| 组件 | 描述 | Props |
|------|------|------|
| [Badge](/components/ui/badge) | 状态指示器标签 | `variant` |
| [Progress](/components/ui/progress) | 进度条 | `value` |
| [Alert](/components/ui/alert) | 通知消息 | `variant` |
| [Toast](/components/ui/toast) | 临时通知（Radix） | Toast 组件 |

### 导航组件

| 组件 | 描述 | Props |
|------|------|------|
| [Tabs](/components/ui/tabs) | 标签页导航（Radix） | Tabs 组件 |
| [TabsNavigation](/components/ui/tabs-navigation) | 自定义标签栏 | `tabs`, `value`, `onValueChange` |
| [Breadcrumb](/components/ui/breadcrumb) | 导航面包屑 | Breadcrumb 组件 |

### 叠加层组件

| 组件 | 描述 | Props |
|------|------|------|
| [Dialog](/components/ui/dialog) | 模态对话框（Radix） | `open`, `onOpenChange` |
| [Drawer](/components/ui/drawer) | 侧边面板（Radix） | `open`, `onOpenChange` |
| [Dropdown Menu](/components/ui/dropdown) | 上下文菜单（Radix） | Dropdown 组件 |
| [Popover](/components/ui/popover) | 浮动内容（Radix） | `open`, `onOpenChange` |
| [Tooltip](/components/ui/tooltip) | 悬停工具提示（Radix） | `content` |
| [AlertDialog](/components/ui/alert-dialog) | 确认对话框（Radix） | Dialog 组件 |

### 展开组件

| 组件 | 描述 | Props |
|------|------|------|
| [Collapsible](/components/ui/collapsible) | 展开/折叠内容（Radix） | `open`, `onOpenChange` |
| [Accordion](/components/ui/accordion) | 可折叠部分（Radix） | Accordion 组件 |

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
