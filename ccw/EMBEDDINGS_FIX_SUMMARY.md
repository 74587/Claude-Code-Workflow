# CodexLens Embeddings 修复总结

## 修复成果

### ✅ 已完成

1. **递归 embeddings 生成功能** (`embedding_manager.py`)
   - 添加 `generate_embeddings_recursive()` 函数
   - 添加 `get_embeddings_status()` 函数
   - 递归处理所有子目录的 _index.db 文件

2. **CLI 命令增强** (`commands.py`)
   - `embeddings-generate` 添加 `--recursive` 标志
   - `init` 命令使用递归生成（自动处理所有子目录）
   - `status` 命令显示 embeddings 覆盖率统计

3. **Smart Search 智能路由** (`smart-search.ts`)
   - 添加 50% 覆盖率阈值
   - embeddings 不足时自动降级到 exact 模式
   - 提供明确的警告信息
   - Strip ANSI 颜色码以正确解析 JSON

### ✅ 测试结果

**CCW 项目 (d:\Claude_dms3\ccw)**:
- 索引数据库：26 个
- 文件总数：303
- Embeddings 覆盖：**100%** (所有 303 个文件)
- 生成 chunks：**2,042** (之前只有 10)

**对比**:
| 指标 | 修复前 | 修复后 | 改进 |
|------|--------|--------|------|
| 覆盖率 | 1.6% (5/303) | 100% (303/303) | **62.5x** |
| Chunks | 10 | 2,042 | **204x** |
| 有 embeddings 的索引 | 1/26 | 26/26 | **26x** |

## 当前问题

### ⚠️ 遗留问题

1. **路径映射问题**
   - `embeddings-generate --recursive` 需要使用索引路径而非源路径
   - 用户应该能够使用源路径（`d:\Claude_dms3\ccw`）
   - 当前需要使用：`C:\Users\dyw\.codexlens\indexes\D\Claude_dms3\ccw`

2. **Status 命令的全局 vs 项目级别**
   - `codexlens status` 返回全局统计（所有项目）
   - 需要项目级别的 embeddings 状态
   - `embeddings-status` 只检查单个 _index.db，不递归

## 建议的后续修复

### P1 - 路径映射修复

修改 `commands.py` 中的 `embeddings_generate` 命令（line 1996-2000）：

```python
elif target_path.is_dir():
    if recursive:
        # Recursive mode: Map source path to index root
        registry = RegistryStore()
        try:
            registry.initialize()
            mapper = PathMapper()
            index_db_path = mapper.source_to_index_db(target_path)
            index_root = index_db_path.parent  # Use index directory root
            use_recursive = True
        finally:
            registry.close()
```

### P2 - 项目级别 Status

选项 A：扩展 `embeddings-status` 命令支持递归
```bash
codexlens embeddings-status . --recursive --json
```

选项 B：修改 `status` 命令接受路径参数
```bash
codexlens status --project . --json
```

## 使用指南

### 当前工作流程

**生成 embeddings（完整覆盖）**:
```bash
# 方法 1: 使用索引路径（当前工作方式）
cd C:\Users\dyw\.codexlens\indexes\D\Claude_dms3\ccw
python -m codexlens embeddings-generate . --recursive --force --model fast

# 方法 2: init 命令（自动递归，推荐）
cd d:\Claude_dms3\ccw
python -m codexlens init . --force
```

**检查覆盖率**:
```bash
# 项目根目录
cd C:\Users\dyw\.codexlens\indexes\D\Claude_dms3\ccw
python check_embeddings.py  # 显示详细的每目录统计

# 全局状态
python -m codexlens status --json  # 所有项目的汇总
```

**Smart Search**:
```javascript
// MCP 工具调用
smart_search(query="authentication patterns")

// 现在会：
// 1. 检查 embeddings 覆盖率
// 2. 如果 >= 50%，使用 hybrid 模式
// 3. 如果 < 50%，降级到 exact 模式
// 4. 显示警告信息
```

### 最佳实践

1. **初始化项目时自动生成 embeddings**:
   ```bash
   codexlens init /path/to/project --force
   ```

2. **定期重新生成以更新**:
   ```bash
   codexlens embeddings-generate /index/path --recursive --force
   ```

3. **使用 fast 模型快速测试**:
   ```bash
   codexlens embeddings-generate . --recursive --model fast
   ```

4. **使用 code 模型获得最佳质量**:
   ```bash
   codexlens embeddings-generate . --recursive --model code
   ```

## 技术细节

### 文件修改清单

**Python (CodexLens)**:
- `codex-lens/src/codexlens/cli/embedding_manager.py` - 添加递归函数
- `codex-lens/src/codexlens/cli/commands.py` - 更新 init, status, embeddings-generate

**TypeScript (CCW)**:
- `ccw/src/tools/smart-search.ts` - 智能路由 + ANSI stripping
- `ccw/src/tools/codex-lens.ts` - （未修改，使用现有实现）

### 依赖版本

- CodexLens: 当前开发版本
- Fastembed: 已安装（ONNX backend）
- Models: fast (~80MB), code (~150MB)

---

**修复时间**: 2025-12-17  
**验证状态**: ✅ 核心功能正常，遗留路径映射问题待修复
