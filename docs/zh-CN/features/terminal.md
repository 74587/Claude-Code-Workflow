# 终端仪表板

## 一句话概述
**终端仪表板提供以终端为首的工作空间，具有可调整大小的窗格、浮动面板和用于会话监控与编排的集成工具。**

---

## 解决的痛点

| 痛点 | 当前状态 | 终端仪表板解决方案 |
|------|----------|---------------------|
| **终端分散** | 多个终端窗口 | 统一的 tmux 风格网格布局 |
| **无上下文关联** | 无法将终端输出与问题关联 | 关联高亮提供程序 |
| **面板过多** | 固定布局浪费空间 | 浮动面板（互斥） |
| **缺少工具** | 在应用间切换 | 集成问题、队列、检查器、调度器 |
| **工作空间有限** | 无法同时查看代码和终端 | 可调整大小的三列布局 |

---

## 概述

**位置**: `ccw/frontend/src/pages/TerminalDashboardPage.tsx`

**用途**: 用于多终端会话管理的终端优先布局，配备集成工具和可调整大小的面板。

**访问方式**: 导航 → 终端仪表板 (`/terminal-dashboard`)

**布局**:
```
+--------------------------------------------------------------------------+
|  仪表板工具栏（面板切换、布局预设、全屏）                                    |
+--------------------------------------------------------------------------+
|  +----------------+-------------------------------------------+------------+ |
|  | 会话           |  终端网格（tmux 风格）               | 文件       | |
|  | 分组树         |  +----------+  +----------+              | 侧边栏     | |
|  | （可调整大小） |  | 终端 1   |  | 终端 2   |              |（可调整大小）| |
|  |                |  +----------+  +----------+              |            | |
|  |                |  +----------+  +----------+              |            | |
|  |                |  | 终端 3   |  | 终端 4   |              |            | |
|  |                |  +----------+  +----------+              |            | |
|  +----------------+-------------------------------------------+------------+ |
+--------------------------------------------------------------------------+
|  [浮动面板: 问题+队列 或 检查器 或 执行 或 调度器]                         |
+--------------------------------------------------------------------------+
```

---

## 实时演示

:::demo TerminalDashboardOverview
# terminal-dashboard-overview.tsx
/**
 * Terminal Dashboard Overview Demo
 * Shows the three-column layout with resizable panes and toolbar
 */
export function TerminalDashboardOverview() {
  const [fileSidebarOpen, setFileSidebarOpen] = React.useState(true)
  const [sessionSidebarOpen, setSessionSidebarOpen] = React.useState(true)
  const [activePanel, setActivePanel] = React.useState(null)

  return (
    <div className="h-[600px] flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Terminal Dashboard</span>
        </div>
        <div className="flex items-center gap-1">
          {['Sessions', 'Files', 'Issues', 'Queue', 'Inspector', 'Scheduler'].map((item) => (
            <button
              key={item}
              onClick={() => {
                if (item === 'Sessions') setSessionSidebarOpen(!sessionSidebarOpen)
                else if (item === 'Files') setFileSidebarOpen(!fileSidebarOpen)
                else setActivePanel(activePanel === item.toLowerCase() ? null : item.toLowerCase())
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                (item === 'Sessions' && sessionSidebarOpen) ||
                (item === 'Files' && fileSidebarOpen) ||
                activePanel === item.toLowerCase()
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Session Sidebar */}
        {sessionSidebarOpen && (
          <div className="w-60 border-r flex flex-col">
            <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/30">
              Session Groups
            </div>
            <div className="flex-1 p-2 space-y-1 text-sm overflow-auto">
              {['Active Sessions', 'Completed', 'Archived'].map((group) => (
                <div key={group}>
                  <div className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer">
                    <span className="text-xs">▼</span>
                    <span>{group}</span>
                  </div>
                  <div className="ml-4 space-y-0.5">
                    <div className="px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded cursor-pointer">
                      Session 1
                    </div>
                    <div className="px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded cursor-pointer">
                      Session 2
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terminal Grid */}
        <div className="flex-1 bg-muted/20 p-2">
          <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-background border rounded p-3 font-mono text-xs">
                <div className="text-green-500 mb-2">$ Terminal {i}</div>
                <div className="text-muted-foreground">
                  <div>Working directory: /project</div>
                  <div>Type a command to begin...</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* File Sidebar */}
        {fileSidebarOpen && (
          <div className="w-64 border-l flex flex-col">
            <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/30">
              Project Files
            </div>
            <div className="flex-1 p-2 text-sm overflow-auto">
              <div className="space-y-1">
                {['src', 'docs', 'tests', 'package.json', 'README.md'].map((item) => (
                  <div key={item} className="px-2 py-1 rounded hover:bg-accent cursor-pointer flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">📁</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Panel */}
      {activePanel && (
        <div className="absolute top-12 right-4 w-80 bg-background border rounded-lg shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium capitalize">{activePanel} Panel</span>
            <button onClick={() => setActivePanel(null)} className="text-xs hover:bg-accent px-2 py-1 rounded">
              ✕
            </button>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            {activePanel} content placeholder
          </div>
        </div>
      )}
    </div>
  )
}
:::

---

## 核心功能

| 功能 | 描述 |
|------|------|
| **三列布局** | 使用 Allotment 的可调整大小窗格：会话树（左）、终端网格（中）、文件侧边栏（右） |
| **终端网格** | Tmux 风格的分割窗格，带布局预设（单格、水平分割、垂直分割、2x2 网格） |
| **会话分组树** | CLI 会话的分层视图，按标签分组 |
| **浮动面板** | 互斥的叠加面板（问题+队列、检查器、执行监控器、调度器） |
| **关联高亮** | 终端、问题和队列项之间的跨面板链接 |
| **布局预设** | 快速布局按钮：单格窗格、水平分割、垂直分割、2x2 网格 |
| **启动 CLI** | 用于创建新 CLI 会话的配置模态框，可选择工具、模型和设置 |
| **全屏模式** | 沉浸模式隐藏应用框架（标题栏 + 侧边栏） |
| **功能标志** | 面板可见性由功能标志控制（队列、检查器、执行监控器） |

---

## 组件层次结构

```
TerminalDashboardPage
├── AssociationHighlightProvider（上下文）
├── DashboardToolbar
│   ├── 布局预设按钮（单格 | 水平分割 | 垂直分割 | 2x2 网格）
│   ├── 面板切换（会话 | 文件 | 问题 | 队列 | 检查器 | 执行 | 调度器）
│   ├── 全屏切换
│   └── 启动 CLI 按钮
├── Allotment（三列布局）
│   ├── SessionGroupTree
│   │   └── 会话分组项（可折叠）
│   ├── TerminalGrid
│   │   ├── GridGroupRenderer（递归）
│   │   └── TerminalPane
│   └── FileSidebarPanel
│       └── 文件树视图
└── FloatingPanel（多个，互斥）
    ├── 问题+队列（分割面板）
    │   ├── IssuePanel
    │   └── QueueListColumn
    ├── QueuePanel（功能标志）
    ├── InspectorContent（功能标志）
    ├── ExecutionMonitorPanel（功能标志）
    └── SchedulerPanel
```

---

## Props API

### TerminalDashboardPage

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| - | - | - | 此页面组件不接受任何 props（状态通过 hooks 和 Zustand stores 管理） |

### DashboardToolbar

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `activePanel` | `PanelId \| null` | `null` | 当前活动的浮动面板 |
| `onTogglePanel` | `(panelId: PanelId) => void` | - | 切换面板可见性的回调 |
| `isFileSidebarOpen` | `boolean` | `true` | 文件侧边栏可见性状态 |
| `onToggleFileSidebar` | `() => void` | - | 切换文件侧边栏回调 |
| `isSessionSidebarOpen` | `boolean` | `true` | 会话侧边栏可见性状态 |
| `onToggleSessionSidebar` | `() => void` | - | 切换会话侧边栏回调 |
| `isFullscreen` | `boolean` | `false` | 全屏模式状态 |
| `onToggleFullscreen` | `() => void` | - | 切换全屏回调 |

### FloatingPanel

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `isOpen` | `boolean` | `false` | 面板打开状态 |
| `onClose` | `() => void` | - | 关闭回调 |
| `title` | `string` | - | 面板标题 |
| `side` | `'left' \| 'right'` | `'left'` | 面板侧边 |
| `width` | `number` | `400` | 面板宽度（像素） |
| `children` | `ReactNode` | - | 面板内容 |

---

## 状态管理

### 本地状态

| 状态 | 类型 | 描述 |
|------|------|------|
| `activePanel` | `PanelId \| null` | 当前活动的浮动面板（互斥） |
| `isFileSidebarOpen` | `boolean` | 文件侧边栏可见性 |
| `isSessionSidebarOpen` | `boolean` | 会话侧边栏可见性 |

### Zustand Stores

| Store | 选择器 | 用途 |
|-------|--------|------|
| `workflowStore` | `selectProjectPath` | 文件侧边栏的当前项目路径 |
| `appStore` | `selectIsImmersiveMode` | 全屏模式状态 |
| `configStore` | `featureFlags` | 功能标志配置 |
| `terminalGridStore` | 网格布局和焦点窗格状态 |
| `executionMonitorStore` | 活动执行计数 |
| `queueSchedulerStore` | 调度器状态和设置 |

### 面板 ID 类型

```typescript
type PanelId = 'issues' | 'queue' | 'inspector' | 'execution' | 'scheduler';
```

---

## 使用示例

### 基本终端仪表板

```tsx
import { TerminalDashboardPage } from '@/pages/TerminalDashboardPage'

// 终端仪表板自动在 /terminal-dashboard 渲染
// 不需要 props - 布局状态内部管理
```

### 使用 FloatingPanel 组件

```tsx
import { FloatingPanel } from '@/components/terminal-dashboard/FloatingPanel'
import { IssuePanel } from '@/components/terminal-dashboard/IssuePanel'

function CustomLayout() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <FloatingPanel
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="问题"
      side="left"
      width={700}
    >
      <IssuePanel />
    </FloatingPanel>
  )
}
```

---

## 交互演示

### 布局预设演示

:::demo TerminalLayoutPresets
# terminal-layout-presets.tsx
/**
 * Terminal Layout Presets Demo
 * Interactive layout preset buttons
 */
export function TerminalLayoutPresets() {
  const [layout, setLayout] = React.useState('grid-2x2')

  const layouts = {
    single: 'grid-cols-1 grid-rows-1',
    'split-h': 'grid-cols-2 grid-rows-1',
    'split-v': 'grid-cols-1 grid-rows-2',
    'grid-2x2': 'grid-cols-2 grid-rows-2',
  }

  return (
    <div className="p-6 bg-background space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Terminal Layout Presets</h3>
        <div className="flex gap-2">
          {Object.keys(layouts).map((preset) => (
            <button
              key={preset}
              onClick={() => setLayout(preset)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                layout === preset
                  ? 'bg-primary text-primary-foreground'
                  : 'border hover:bg-accent'
              }`}
            >
              {preset.replace('-', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-2 h-64 ${layouts[layout]}`}>
        {Array.from({ length: layout === 'single' ? 1 : layout.includes('2x') ? 4 : 2 }).map((_, i) => (
          <div key={i} className="bg-muted/20 border rounded p-4 font-mono text-xs">
            <div className="text-green-500">$ Terminal {i + 1}</div>
            <div className="text-muted-foreground mt-1">Ready for input...</div>
          </div>
        ))}
      </div>
    </div>
  )
}
:::

### 浮动面板演示

:::demo FloatingPanelsDemo
# floating-panels-demo.tsx
/**
 * Floating Panels Demo
 * Mutually exclusive overlay panels
 */
export function FloatingPanelsDemo() {
  const [activePanel, setActivePanel] = React.useState(null)

  const panels = [
    { id: 'issues', title: 'Issues + Queue', side: 'left', width: 700 },
    { id: 'queue', title: 'Queue', side: 'right', width: 400 },
    { id: 'inspector', title: 'Inspector', side: 'right', width: 360 },
    { id: 'execution', title: 'Execution Monitor', side: 'right', width: 380 },
    { id: 'scheduler', title: 'Scheduler', side: 'right', width: 340 },
  ]

  return (
    <div className="relative h-[500px] p-6 bg-background border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Floating Panels</h3>
        <div className="flex gap-2">
          {panels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => setActivePanel(activePanel === panel.id ? null : panel.id)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                activePanel === panel.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border hover:bg-accent'
              }`}
            >
              {panel.title}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[380px] bg-muted/20 border rounded flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {activePanel ? `"${panels.find((p) => p.id === activePanel)?.title}" panel is open` : 'Click a button to open a floating panel'}
        </p>
      </div>

      {/* Floating Panel Overlay */}
      {activePanel && (
        <div
          className={`absolute top-16 border rounded-lg shadow-lg bg-background ${
            panels.find((p) => p.id === activePanel)?.side === 'left' ? 'left-6' : 'right-6'
          }`}
          style={{ width: panels.find((p) => p.id === activePanel)?.width }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">{panels.find((p) => p.id === activePanel)?.title}</span>
            <button
              onClick={() => setActivePanel(null)}
              className="text-xs hover:bg-accent px-2 py-1 rounded"
            >
              ✕
            </button>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"/>
                <span>Item 1</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"/>
                <span>Item 2</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"/>
                <span>Item 3</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
:::

### 可调整大小窗格演示

:::demo ResizablePanesDemo
# resizable-panes-demo.tsx
/**
 * Resizable Panes Demo
 * Simulates the Allotment resizable split behavior
 */
export function ResizablePanesDemo() {
  const [leftWidth, setLeftWidth] = React.useState(240)
  const [rightWidth, setRightWidth] = React.useState(280)
  const [isDragging, setIsDragging] = React.useState(null)

  const handleDragStart = (side) => (e) => {
    setIsDragging(side)
    e.preventDefault()
  }

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging === 'left') {
        setLeftWidth(Math.max(180, Math.min(320, e.clientX)))
      } else if (isDragging === 'right') {
        setRightWidth(Math.max(200, Math.min(400, window.innerWidth - e.clientX)))
      }
    }

    const handleMouseUp = () => setIsDragging(null)

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  return (
    <div className="h-[400px] flex bg-background border rounded-lg overflow-hidden">
      {/* Left Sidebar */}
      <div style={{ width: leftWidth }} className="border-r flex flex-col">
        <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/30">
          Session Groups
        </div>
        <div className="flex-1 p-2 text-sm space-y-1">
          {['Active Sessions', 'Completed'].map((g) => (
            <div key={g} className="px-2 py-1 hover:bg-accent rounded cursor-pointer">{g}</div>
          ))}
        </div>
      </div>

      {/* Left Drag Handle */}
      <div
        onMouseDown={handleDragStart('left')}
        className={`w-1 bg-border hover:bg-primary cursor-col-resize transition-colors ${
          isDragging === 'left' ? 'bg-primary' : ''
        }`}
      />

      {/* Main Content */}
      <div className="flex-1 bg-muted/20 flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Terminal Grid Area</span>
      </div>

      {/* Right Drag Handle */}
      <div
        onMouseDown={handleDragStart('right')}
        className={`w-1 bg-border hover:bg-primary cursor-col-resize transition-colors ${
          isDragging === 'right' ? 'bg-primary' : ''
        }`}
      />

      {/* Right Sidebar */}
      <div style={{ width: rightWidth }} className="border-l flex flex-col">
        <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/30">
          Project Files
        </div>
        <div className="flex-1 p-2 text-sm space-y-1">
          {['src/', 'docs/', 'tests/'].map((f) => (
            <div key={f} className="px-2 py-1 hover:bg-accent rounded cursor-pointer">{f}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
:::

---

## 配置

### 功能标志

| 标志 | 控制 |
|------|------|
| `dashboardQueuePanelEnabled` | 队列面板可见性 |
| `dashboardInspectorEnabled` | 检查器面板可见性 |
| `dashboardExecutionMonitorEnabled` | 执行监控器面板可见性 |

### 布局预设

| 预设 | 布局 |
|------|------|
| **单格** | 一个终端窗格 |
| **水平分割** | 两个窗格并排 |
| **垂直分割** | 两个窗格垂直堆叠 |
| **2x2 网格** | 2x2 网格中的四个窗格 |

### 面板类型

| 面板 | 内容 | 位置 | 功能标志 |
|------|------|------|----------|
| **问题+队列** | 组合的问题面板 + 队列列表列 | 左侧（叠加） | - |
| **队列** | 完整的队列管理面板 | 右侧（叠加） | `dashboardQueuePanelEnabled` |
| **检查器** | 关联链检查器 | 右侧（叠加） | `dashboardInspectorEnabled` |
| **执行监控器** | 实时执行跟踪 | 右侧（叠加） | `dashboardExecutionMonitorEnabled` |
| **调度器** | 队列调度器控制 | 右侧（叠加） | - |

---

## 可访问性

- **键盘导航**:
  - <kbd>Tab</kbd> - 在工具栏按钮之间导航
  - <kbd>Enter</kbd>/<kbd>Space</kbd> - 激活工具栏按钮
  - <kbd>Escape</kbd> - 关闭浮动面板
  - <kbd>F11</kbd> - 切换全屏模式

- **ARIA 属性**:
  - 工具栏按钮上的 `aria-label`
  - 侧边栏切换上的 `aria-expanded`
  - 非活动浮动面板上的 `aria-hidden`
  - 浮动面板上的 `role="dialog"`

- **屏幕阅读器支持**:
  - 切换面板时宣布面板状态
  - 布局更改被宣布
  - 面板打开/关闭时的焦点管理

---

## 相关链接

- [编排器](/features/orchestrator) - 可视化工作流编辑器
- [会话](/features/sessions) - 会话管理
- [问题中心](/features/issue-hub) - 问题、队列、发现
- [资源管理器](/features/explorer) - 文件资源管理器
- [队列](/features/queue) - 队列管理独立页面
