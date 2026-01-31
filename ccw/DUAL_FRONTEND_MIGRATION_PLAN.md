# CCW 双前端并存迁移方案

## 目标
- 通过 `ccw view` 命令同时支持 JS 前端（旧版）和 React 前端（新版）
- 实现渐进式迁移，逐步将功能迁移到 React
- 用户可自由切换两个前端

## 架构设计

```
┌─────────────────┐     ┌──────────────────┐
│   ccw view      │────▶│   Node Server    │
│  (port 3456)    │     │   (3456)         │
└─────────────────┘     └────────┬─────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   JS Frontend   │    │  React Frontend │    │   /api/*        │
│   (/)           │    │   (/react/*)    │    │   REST API      │
│   dashboard-js  │    │   Vite dev/prod │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 实现方案

### Phase 1: 基础架构改造

#### 1.1 修改 `ccw/src/commands/serve.ts`

添加 `--frontend` 参数支持：

```typescript
interface ServeOptions {
  port?: number;
  path?: string;
  host?: string;
  browser?: boolean;
  frontend?: 'js' | 'react' | 'both';  // 新增
}

// 在 serveCommand 中处理
export async function serveCommand(options: ServeOptions): Promise<void> {
  const frontend = options.frontend || 'js';  // 默认 JS 前端
  
  if (frontend === 'react' || frontend === 'both') {
    // 启动 React 前端服务
    await startReactFrontend(port + 1);  // React 在 port+1
  }
  
  // 启动主服务器
  const server = await startServer({ 
    port, 
    host, 
    initialPath,
    frontend  // 传递给 server
  });
}
```

#### 1.2 修改 `ccw/src/core/server.ts`

添加 React 前端路由支持：

```typescript
// 在路由处理中添加
if (pathname === '/react' || pathname.startsWith('/react/')) {
  // 代理到 React 前端
  const reactUrl = `http://localhost:${options.reactPort || port + 1}${pathname.replace('/react', '')}`;
  // 使用 http-proxy 或 fetch 代理请求
  proxyToReact(req, res, reactUrl);
  return;
}

// 根路径根据配置决定默认前端
if (pathname === '/' || pathname === '/index.html') {
  if (options.frontend === 'react') {
    res.writeHead(302, { Location: '/react' });
    res.end();
    return;
  }
  // 默认 JS 前端
  const html = generateServerDashboard(initialPath);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
  return;
}
```

#### 1.3 创建 `ccw/src/utils/react-frontend.ts`

```typescript
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import chalk from 'chalk';

let reactProcess: ChildProcess | null = null;

export async function startReactFrontend(port: number): Promise<void> {
  const frontendDir = join(process.cwd(), 'frontend');
  
  console.log(chalk.cyan(`  Starting React frontend on port ${port}...`));
  
  reactProcess = spawn('npm', ['run', 'dev', '--', '--port', port.toString()], {
    cwd: frontendDir,
    stdio: 'pipe',
    shell: true
  });
  
  // 等待服务启动
  return new Promise((resolve, reject) => {
    let output = '';
    
    const timeout = setTimeout(() => {
      reject(new Error('React frontend startup timeout'));
    }, 30000);
    
    reactProcess?.stdout?.on('data', (data) => {
      output += data.toString();
      if (output.includes('Local:') || output.includes('ready')) {
        clearTimeout(timeout);
        console.log(chalk.green(`  React frontend ready at http://localhost:${port}`));
        resolve();
      }
    });
    
    reactProcess?.stderr?.on('data', (data) => {
      console.error(chalk.yellow(`  React: ${data.toString().trim()}`));
    });
    
    reactProcess?.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export function stopReactFrontend(): void {
  if (reactProcess) {
    reactProcess.kill('SIGTERM');
    reactProcess = null;
  }
}
```

### Phase 2: React 前端适配

#### 2.1 修改 `ccw/frontend/vite.config.ts`

添加基础路径配置：

```typescript
export default defineConfig({
  plugins: [react()],
  base: '/react/',  // 添加基础路径
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3456',
        ws: true,
      },
    },
  },
  // ...
})
```

#### 2.2 创建前端切换组件

在 JS 前端添加切换按钮（`ccw/src/templates/dashboard-js/components/react-switch.js`）：

```javascript
// 在导航栏添加切换按钮
function addReactSwitchButton() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  
  const switchBtn = document.createElement('button');
  switchBtn.className = 'btn btn-sm btn-outline-primary ml-2';
  switchBtn.innerHTML = '<span class="icon">⚛️</span> React 版本';
  switchBtn.title = '切换到 React 版本';
  switchBtn.onclick = () => {
    window.location.href = '/react';
  };
  
  nav.appendChild(switchBtn);
}

// 初始化
document.addEventListener('DOMContentLoaded', addReactSwitchButton);
```

### Phase 3: 命令行接口

#### 3.1 修改 `ccw/src/cli.ts`

添加 `--frontend` 选项：

```typescript
// View command
program
  .command('view')
  .description('Open workflow dashboard server with live path switching')
  .option('-p, --path <path>', 'Path to project directory', '.')
  .option('--port <port>', 'Server port', '3456')
  .option('--host <host>', 'Server host to bind', '127.0.0.1')
  .option('--no-browser', 'Start server without opening browser')
  .option('--frontend <type>', 'Frontend type: js, react, both', 'js')  // 新增
  .action(viewCommand);
```

### 使用方式

#### 1. 默认 JS 前端（向后兼容）
```bash
ccw view
# 或明确指定
ccw view --frontend js
```

#### 2. React 前端
```bash
ccw view --frontend react
# React 前端将在 http://localhost:3456/react 访问
```

#### 3. 同时启动两个前端（开发调试）
```bash
ccw view --frontend both
# JS: http://localhost:3456
# React: http://localhost:3456/react (开发模式) 或 5173
```

## 迁移路线图

```
Phase 1: 基础架构 (1-2 周)
  ├── 添加 --frontend 参数支持
  ├── 实现 React 前端代理
  └── 基础切换功能

Phase 2: 功能迁移 (4-8 周)
  ├── 逐个迁移功能模块到 React
  ├── 保持 JS 前端稳定
  └── 添加功能开关

Phase 3: 默认切换 (2 周)
  ├── React 成为默认前端
  ├── JS 前端进入维护模式
  └── 发布迁移公告

Phase 4: 完全迁移 (可选)
  ├── 移除 JS 前端
  └── React 成为唯一前端
```

这个方案的优点：
1. **向后兼容**：默认行为不变，现有用户无感知
2. **渐进迁移**：可以逐个功能迁移到 React
3. **灵活切换**：用户和开发者可以随时切换前端
4. **并行开发**：两个前端可以同时开发调试