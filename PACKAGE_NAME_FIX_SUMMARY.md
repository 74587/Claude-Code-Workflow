# Package Name Fix Summary

## 问题描述

用户在使用 `ccw view` 界面安装 CodexLens 时遇到错误：

```
Error: Failed to install codexlens: Using Python 3.12.3 environment at: .codexlens/venv
× No solution found when resolving dependencies:
╰─▶ Because there are no versions of codexlens[semantic] and you require codexlens[semantic], we can conclude that your requirements are unsatisfiable.
```

## 根本原因

1. **包名不一致**：pyproject.toml 中定义的包名是 `codex-lens`（带连字符），但代码中尝试安装 `codexlens`（没有连字符）
2. **包未发布到 PyPI**：`codex-lens` 是本地开发包，没有发布到 PyPI，只能通过本地路径安装
3. **本地路径查找逻辑问题**：`findLocalPackagePath()` 函数在非开发环境（从 node_modules 运行）时会提前返回 null，导致找不到本地路径

## 修复内容

### 1. 核心文件修复 (ccw/src/tools/codex-lens.ts)

#### 1.1 修改 `findLocalPackagePath()` 函数
- **移除** `isDevEnvironment()` 早期返回逻辑
- **添加** 更多本地路径搜索位置（包括父目录）
- **总是** 尝试查找本地路径，即使从 node_modules 运行

#### 1.2 修改 `bootstrapWithUv()` 函数
- **移除** PyPI 安装的 fallback 逻辑
- **改为** 找不到本地路径时直接返回错误，提供清晰的修复指导

#### 1.3 修改 `installSemanticWithUv()` 函数
- **移除** PyPI 安装的 fallback 逻辑
- **改为** 找不到本地路径时直接返回错误

#### 1.4 修改 `bootstrapVenv()` 函数（pip fallback）
- **移除** PyPI 安装的 fallback 逻辑
- **改为** 找不到本地路径时抛出错误

#### 1.5 修复包名引用
- 将所有 `codexlens` 更改为 `codex-lens`（3 处）

### 2. 文档和脚本修复

修复以下文件中的包名引用（`codexlens` → `codex-lens`）：

- ✅ `ccw/scripts/memory_embedder.py`
- ✅ `ccw/scripts/README-memory-embedder.md`
- ✅ `ccw/scripts/QUICK-REFERENCE.md`
- ✅ `ccw/scripts/IMPLEMENTATION-SUMMARY.md`

## 修复后的行为

### 安装流程

1. **查找本地路径**：
   - 检查 `process.cwd()/codex-lens`
   - 检查 `__dirname/../../../codex-lens`（项目根目录）
   - 检查 `homedir()/codex-lens`
   - 检查 `parent(cwd)/codex-lens`（新增）

2. **本地安装**（找到路径）：
   ```bash
   uv pip install -e /path/to/codex-lens[semantic]
   ```

3. **失败并提示**（找不到路径）：
   ```
   Cannot find codex-lens directory for local installation.

   codex-lens is a local development package (not published to PyPI) and must be installed from local files.

   To fix this:
   1. Ensure the 'codex-lens' directory exists in your project root
   2. Verify pyproject.toml exists in codex-lens directory
   3. Run ccw from the correct working directory
   4. Or manually install: cd codex-lens && pip install -e .[semantic]
   ```

## 验证步骤

1. 确认 `codex-lens` 目录存在于项目根目录
2. 确认 `codex-lens/pyproject.toml` 存在
3. 从项目根目录运行 ccw
4. 尝试安装 CodexLens semantic 依赖

## 正确的手动安装方式

```bash
# 从项目根目录
cd D:\Claude_dms3\codex-lens
pip install -e .[semantic]

# 或者使用绝对路径
pip install -e D:\Claude_dms3\codex-lens[semantic]

# GPU 加速（CUDA）
pip install -e .[semantic-gpu]

# GPU 加速（DirectML，Windows）
pip install -e .[semantic-directml]
```

## 注意事项

- **不要** 使用 `pip install codex-lens[semantic]`（会失败，包未发布到 PyPI）
- **必须** 使用 `-e` 参数进行 editable 安装
- **必须** 从正确的工作目录运行（包含 codex-lens 目录的目录）

## 影响范围

- ✅ ccw view 界面安装
- ✅ 命令行 UV 安装
- ✅ 命令行 pip fallback 安装
- ✅ 文档和脚本中的安装说明

## 测试建议

1. 从全局安装的 ccw 运行（npm install -g）
2. 从本地开发目录运行（npm link）
3. 从不同的工作目录运行
4. 测试所有三种 GPU 模式（cpu, cuda, directml）
