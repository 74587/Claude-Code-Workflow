# 仪表板

## 一句话概述
**仪表板通过直观的基于小部件的界面，提供项目工作流状态、统计信息和最近活动的概览。**

---

## 解决的痛点

| 痛点 | 当前状态 | 仪表板解决方案 |
|------|----------|----------------|
| **项目可见性不足** | 无法查看整体项目健康状况 | 带有技术栈和开发索引的项目信息横幅 |
| **指标分散** | 统计信息分布在多个位置 | 集中式统计数据，带有迷你趋势图 |
| **工作流状态未知** | 难以跟踪会话进度 | 带有状态细分的饼图 |
| **最近工作丢失** | 无法快速访问活动会话 | 带有任务详情的会话轮播 |
| **索引状态不明确** | 不知道代码是否已索引 | 实时索引状态指示器 |

---

## 概述

**位置**: `ccw/frontend/src/pages/HomePage.tsx`

**用途**: 仪表板主页，提供项目概览、统计信息、工作流状态和最近活动监控。

**访问**: 导航 → 仪表板（默认首页，路径为 `/`）

**布局**:
```
+--------------------------------------------------------------------------+
|  仪表板头部（标题 + 刷新）                                            |
+--------------------------------------------------------------------------+
|  WorkflowTaskWidget（组合卡片）                                        |
|  +--------------------------------------------------------------------+  |
|  | 项目信息横幅（可展开）                                           |  |
|  | - 项目名称、描述、技术栈徽章                                    |  |
|  | - 快速统计（功能、bug修复、增强）                                |  |
|  | - 索引状态指示器                                                 |  |
|  +----------------------------------+---------------------------------+  |
|  | 统计部分 | 工作流状态 |  任务详情（轮播）         |  |
|  | - 6 个迷你卡片 | - 饼图       | - 会话导航                 |  |
|  | - 迷你趋势图   | - 图例       | - 任务列表（2 列）         |  |
|  +----------------+-----------------+-------------------------------+  |
+--------------------------------------------------------------------------+
|  RecentSessionsWidget                                                     |
|  +--------------------------------------------------------------------+  |
|  | 标签页：所有任务 | 工作流 | 轻量任务                            |  |
|  | +---------------+---------------+-------------------------------+ |  |
|  | | 带有状态、进度、标签、时间的任务卡片                        | |  |
|  | +---------------------------------------------------------------+ |  |
+--------------------------------------------------------------------------+
```

---

## 实时演示

:::demo DashboardOverview
# dashboard-overview.tsx
/**
 * 仪表板概览演示
 * 显示带有小部件的主仪表板布局
 */
export function DashboardOverview() {
  return (
    <div className="space-y-6 p-6 bg-background min-h-[600px]">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">仪表板</h1>
          <p className="text-sm text-muted-foreground">
            项目概览和活动监控
          </p>
        </div>
        <button className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent">
          刷新
        </button>
      </div>

      {/* 工作流统计小部件 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold">项目概览与统计</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">统计数据</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '活动会话', value: '12', color: 'text-blue-500' },
                  { label: '总任务', value: '48', color: 'text-green-500' },
                  { label: '已完成', value: '35', color: 'text-emerald-500' },
                  { label: '待处理', value: '8', color: 'text-amber-500' },
                ].map((stat, i) => (
                  <div key={i} className="p-2 bg-muted/50 rounded">
                    <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground truncate">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">工作流状态</div>
              <div className="flex items-center justify-center h-24">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted opacity-20"/>
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-500" strokeDasharray="70 100"/>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">70%</div>
                </div>
              </div>
              <div className="text-xs text-center space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"/>
                  <span>已完成：70%</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">最近会话</div>
              <div className="p-3 bg-accent/20 rounded border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">功能：身份验证流程</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600">运行中</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded bg-green-500"/>
                    <span>实现登录表单</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded bg-amber-500"/>
                    <span>添加 OAuth 提供商</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded bg-muted"/>
                    <span className="text-muted-foreground">测试流程</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 最近会话小部件 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="border-b bg-muted/30">
          <div className="flex gap-1 p-2">
            {['所有任务', '工作流', '轻量任务'].map((tab, i) => (
              <button
                key={tab}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  i === 0 ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-foreground/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: '重构 UI 组件', status: '进行中', progress: 65 },
              { name: '修复登录 Bug', status: '待处理', progress: 0 },
              { name: '添加深色模式', status: '已完成', progress: 100 },
            ].map((task, i) => (
              <div key={i} className="p-3 bg-muted/30 rounded border cursor-pointer hover:border-primary/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium line-clamp-1">{task.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    task.status === '已完成' ? 'bg-green-500/20 text-green-600' :
                    task.status === '进行中' ? 'bg-blue-500/20 text-blue-600' :
                    'bg-gray-500/20 text-gray-600'
                  }`}>{task.status}</span>
                </div>
                {task.progress > 0 && task.progress < 100 && (
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${task.progress}%` }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
:::

---

## 核心功能

| 功能 | 描述 |
|------|------|
| **项目信息横幅** | 可展开的横幅，显示项目名称、描述、技术栈（语言、框架、架构）、开发索引（功能/bug修复/增强）和实时索引状态 |
| **统计部分** | 6 个迷你统计卡片（活动会话、总任务、已完成任务、待处理任务、失败任务、今日活动），带有 7 天迷你趋势图 |
| **工作流状态饼图** | 环形图显示会话状态细分（已完成、进行中、计划中、已暂停、已归档），附带百分比 |
| **会话轮播** | 自动轮播（5秒间隔）的会话卡片，带有任务列表、进度条和手动导航箭头 |
| **最近会话小部件** | 所有任务类型的标签页视图，带有筛选、状态徽章和进度指示器 |
| **实时更新** | 统计数据每 60 秒自动刷新，索引状态每 30 秒刷新 |

---

## 组件层次结构

```
HomePage
├── DashboardHeader
│   ├── 标题
│   └── 刷新操作按钮
├── WorkflowTaskWidget
│   ├── ProjectInfoBanner（可展开）
│   │   ├── 项目名称和描述
│   │   ├── 技术栈徽章
│   │   ├── 快速统计卡片
│   │   ├── 索引状态指示器
│   │   ├── 架构部分
│   │   ├── 关键组件
│   │   └── 设计模式
│   ├── 统计部分
│   │   └── MiniStatCard（6 个卡片，带迷你趋势图）
│   ├── WorkflowStatusChart
│   │   └── 饼图与图例
│   └── SessionCarousel
│       ├── 导航箭头
│       └── 会话卡片（任务列表）
└── RecentSessionsWidget
    ├── 标签导航（全部 | 工作流 | 轻量任务）
    ├── 任务网格
    │   └── TaskItemCard
    └── 加载/空状态
```

---

## Props API

### HomePage 组件

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| - | - | - | 此页面组件不接受任何 props（数据通过 hooks 获取） |

### WorkflowTaskWidget

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `className` | `string` | `undefined` | 用于样式的额外 CSS 类 |

### RecentSessionsWidget

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `className` | `string` | `undefined` | 用于样式的额外 CSS 类 |
| `maxItems` | `number` | `6` | 要显示的最大项目数量 |

---

## 使用示例

### 基础仪表板

```tsx
import { HomePage } from '@/pages/HomePage'

// 仪表板在根路由 (/) 自动渲染
// 不需要 props - 数据通过 hooks 获取
```

### 嵌入 WorkflowTaskWidget

```tsx
import { WorkflowTaskWidget } from '@/components/dashboard/widgets/WorkflowTaskWidget'

function CustomDashboard() {
  return (
    <div className="p-6">
      <WorkflowTaskWidget />
    </div>
  )
}
```

### 自定义最近会话小部件

```tsx
import { RecentSessionsWidget } from '@/components/dashboard/widgets/RecentSessionsWidget'

function ActivityFeed() {
  return (
    <div className="p-6">
      <RecentSessionsWidget maxItems={10} />
    </div>
  )
}
```

---

## 状态管理

### 本地状态

| 状态 | 类型 | 描述 |
|------|------|------|
| `hasError` | `boolean` | 关键错误的错误跟踪 |
| `projectExpanded` | `boolean` | 项目信息横幅展开状态 |
| `currentSessionIndex` | `number` | 轮播中活动会话的索引 |
| `activeTab` | `'all' \| 'workflow' \| 'lite'` | 最近会话小部件筛选标签页 |

### Store 选择器（Zustand）

| Store | 选择器 | 用途 |
|-------|--------|------|
| `appStore` | `selectIsImmersiveMode` | 检查沉浸模式是否激活 |

### 自定义 Hooks（数据获取）

| Hook | 描述 | 重新获取间隔 |
|------|-------------|--------------|
| `useWorkflowStatusCounts` | 会话状态分布数据 | - |
| `useDashboardStats` | 带迷你趋势图的统计数据 | 60 秒 |
| `useProjectOverview` | 项目信息和技术栈 | - |
| `useIndexStatus` | 实时索引状态 | 30 秒 |
| `useSessions` | 活动会话数据 | - |
| `useLiteTasks` | 最近小部件的轻量任务数据 | - |

---

## 交互演示

### 统计卡片演示

:::demo MiniStatCards
# mini-stat-cards.tsx
/**
 * 迷你统计卡片演示
 * 带有迷你趋势图的独立统计卡片
 */
export function MiniStatCards() {
  const stats = [
    { label: '活动会话', value: 12, trend: [8, 10, 9, 11, 10, 12, 12], color: 'blue' },
    { label: '总任务', value: 48, trend: [40, 42, 45, 44, 46, 47, 48], color: 'green' },
    { label: '已完成', value: 35, trend: [25, 28, 30, 32, 33, 34, 35], color: 'emerald' },
    { label: '待处理', value: 8, trend: [12, 10, 11, 9, 8, 7, 8], color: 'amber' },
    { label: '失败', value: 5, trend: [3, 4, 3, 5, 4, 5, 5], color: 'red' },
    { label: '今日活动', value: 23, trend: [5, 10, 15, 18, 20, 22, 23], color: 'purple' },
  ]

  const colorMap = {
    blue: 'text-blue-500 bg-blue-500/10',
    green: 'text-green-500 bg-green-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    amber: 'text-amber-500 bg-amber-500/10',
    red: 'text-red-500 bg-red-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  }

  return (
    <div className="p-6 bg-background">
      <h3 className="text-sm font-semibold mb-4">带迷你趋势图的统计</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <div className={`w-2 h-2 rounded-full ${colorMap[stat.color].split(' ')[1]}`}/>
            </div>
            <div className={`text-2xl font-bold ${colorMap[stat.color].split(' ')[0]}`}>{stat.value}</div>
            <div className="mt-2 h-8 flex items-end gap-0.5">
              {stat.trend.map((v, j) => (
                <div
                  key={j}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${(v / Math.max(...stat.trend)) * 100}%`,
                    backgroundColor: v === stat.value ? 'currentColor' : 'rgba(59, 130, 246, 0.3)',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
:::

### 项目信息横幅演示

:::demo ProjectInfoBanner
# project-info-banner.tsx
/**
 * 项目信息横幅演示
 * 带有技术栈的可展开项目信息
 */
export function ProjectInfoBanner() {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="p-6 bg-background">
      <h3 className="text-sm font-semibold mb-4">项目信息横幅</h3>
      <div className="border rounded-lg overflow-hidden">
        {/* 横幅头部 */}
        <div className="p-4 bg-muted/30 flex items-center justify-between">
          <div>
            <h4 className="font-semibold">我的项目</h4>
            <p className="text-sm text-muted-foreground">使用 React 构建的现代化 Web 应用</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-md hover:bg-accent"
          >
            <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* 技术栈徽章 */}
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {['TypeScript', 'React', 'Vite', 'Tailwind CSS', 'Zustand'].map((tech) => (
            <span key={tech} className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
              {tech}
            </span>
          ))}
        </div>

        {/* 展开内容 */}
        {expanded && (
          <div className="p-4 border-t bg-muted/20 space-y-4">
            <div>
              <h5 className="text-xs font-semibold mb-2">架构</h5>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>• 基于组件的 UI 架构</div>
                <div>• 集中式状态管理</div>
                <div>• RESTful API 集成</div>
              </div>
            </div>
            <div>
              <h5 className="text-xs font-semibold mb-2">关键组件</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {['会话管理器', '仪表板', '任务调度器', '分析'].map((comp) => (
                  <div key={comp} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary"/>
                    {comp}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
:::

### 会话轮播演示

:::demo SessionCarousel
# session-carousel.tsx
/**
 * 会话轮播演示
 * 带有导航的自动轮播会话卡片
 */
export function SessionCarousel() {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const sessions = [
    {
      name: '功能：用户身份验证',
      status: 'running',
      tasks: [
        { name: '实现登录表单', status: 'completed' },
        { name: '添加 OAuth 提供商', status: 'in-progress' },
        { name: '创建会话管理', status: 'pending' },
      ],
    },
    {
      name: 'Bug 修复：内存泄漏',
      status: 'running',
      tasks: [
        { name: '识别泄漏源', status: 'completed' },
        { name: '修复清理处理器', status: 'in-progress' },
        { name: '添加单元测试', status: 'pending' },
      ],
    },
    {
      name: '重构：API 层',
      status: 'planning',
      tasks: [
        { name: '设计新接口', status: 'pending' },
        { name: '迁移现有端点', status: 'pending' },
        { name: '更新文档', status: 'pending' },
      ],
    },
  ]

  const statusColors = {
    completed: 'bg-green-500',
    'in-progress': 'bg-amber-500',
    pending: 'bg-muted',
  }

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % sessions.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [sessions.length])

  return (
    <div className="p-6 bg-background">
      <h3 className="text-sm font-semibold mb-4">会话轮播（每 5 秒自动轮播）</h3>
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">会话 {currentIndex + 1} / {sessions.length}</span>
          <div className="flex gap-1">
            {sessions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-4 bg-accent/20 rounded border">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">{sessions[currentIndex].name}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              sessions[currentIndex].status === 'running' ? 'bg-green-500/20 text-green-600' : 'bg-blue-500/20 text-blue-600'
            }`}>
              {sessions[currentIndex].status === 'running' ? '运行中' : sessions[currentIndex].status === 'planning' ? '计划中' : sessions[currentIndex].status}
            </span>
          </div>

          <div className="space-y-2">
            {sessions[currentIndex].tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded ${statusColors[task.status]}`}/>
                <span className={task.status === 'pending' ? 'text-muted-foreground' : ''}>{task.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between mt-3">
          <button
            onClick={() => setCurrentIndex((i) => (i - 1 + sessions.length) % sessions.length)}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent"
          >
            ← 上一页
          </button>
          <button
            onClick={() => setCurrentIndex((i) => (i + 1) % sessions.length)}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent"
          >
            下一页 →
          </button>
        </div>
      </div>
    </div>
  )
}
:::

---

## 可访问性

- **键盘导航**：
  - <kbd>Tab</kbd> - 在交互元素之间导航
  - <kbd>Enter</kbd>/<kbd>Space</kbd> - 激活按钮和卡片
  - <kbd>方向键</kbd> - 导航轮播会话

- **ARIA 属性**：
  - 导航按钮上的 `aria-label`
  - 可展开部分的 `aria-expanded`
  - 实时更新的 `aria-live` 区域

- **屏幕阅读器支持**：
  - 所有图表都有文字描述
  - 状态指示器包含文字标签
  - 导航被正确宣布

---

## 相关链接

- [会话](/features/sessions) - 查看和管理所有会话
- [终端仪表板](/features/terminal) - 终端优先监控界面
- [队列](/features/queue) - 问题执行队列管理
- [内存](/features/memory) - 持久化内存管理
- [设置](/features/settings) - 全局应用设置
