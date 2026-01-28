# Script Template

统一的脚本模板，覆盖 Bash 和 Python 两种运行时。

## Usage Context

| Phase | Usage |
|-------|-------|
| Optional | Phase/Action 中声明 `## Scripts` 时使用 |
| Execution | 通过 `ExecuteScript('script-id', params)` 调用 |
| Output Location | `.claude/skills/{skill-name}/scripts/{script-id}.{ext}` |

---

## 调用接口规范

所有脚本共享相同的调用约定：

```
调用者
    ↓ ExecuteScript('script-id', { key: value })
    ↓
脚本入口
    ├─ 参数解析 (--key value)
    ├─ 输入验证 (必需参数检查, 文件存在)
    ├─ 核心处理 (数据读取 → 转换 → 写入)
    └─ 输出结果 (最后一行: 单行 JSON → stdout)
         ├─ 成功: {"status":"success", "output_file":"...", ...}
         └─ 失败: stderr 输出错误信息, exit 1
```

### 返回格式

```typescript
interface ScriptResult {
  success: boolean;    // exit code === 0
  stdout: string;      // 标准输出
  stderr: string;      // 标准错误
  outputs: object;     // 从 stdout 最后一行解析的 JSON
}
```

### 参数约定

| 参数 | 必需 | 说明 |
|------|------|------|
| `--input-path` | ✓ | 输入文件路径 |
| `--output-dir` | ✓ | 输出目录（由调用方指定） |
| 其他 | 按需 | 脚本特定参数 |

---

## Bash 实现

```bash
#!/bin/bash
# {{script_description}}

set -euo pipefail

# ============================================================
# 参数解析
# ============================================================

INPUT_PATH=""
OUTPUT_DIR=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --input-path)  INPUT_PATH="$2"; shift ;;
        --output-dir)  OUTPUT_DIR="$2"; shift ;;
        --help)
            echo "用法: $0 --input-path <path> --output-dir <dir>"
            exit 0
            ;;
        *)
            echo "错误: 未知参数 $1" >&2
            exit 1
            ;;
    esac
    shift
done

# ============================================================
# 参数验证
# ============================================================

[[ -z "$INPUT_PATH" ]] && { echo "错误: --input-path 是必需参数" >&2; exit 1; }
[[ -z "$OUTPUT_DIR" ]] && { echo "错误: --output-dir 是必需参数" >&2; exit 1; }
[[ ! -f "$INPUT_PATH" ]] && { echo "错误: 输入文件不存在: $INPUT_PATH" >&2; exit 1; }
command -v jq &> /dev/null || { echo "错误: 需要安装 jq" >&2; exit 1; }

mkdir -p "$OUTPUT_DIR"

# ============================================================
# 核心逻辑
# ============================================================

OUTPUT_FILE="$OUTPUT_DIR/result.txt"
ITEMS_COUNT=0

# TODO: 实现处理逻辑
while IFS= read -r line; do
    echo "$line" >> "$OUTPUT_FILE"
    ((ITEMS_COUNT++))
done < "$INPUT_PATH"

# ============================================================
# 输出 JSON 结果（使用 jq 构建，避免转义问题）
# ============================================================

jq -n \
    --arg output_file "$OUTPUT_FILE" \
    --argjson items_processed "$ITEMS_COUNT" \
    '{output_file: $output_file, items_processed: $items_processed, status: "success"}'
```

### Bash 常用模式

```bash
# 文件遍历
for file in "$INPUT_DIR"/*.json; do
    [[ -f "$file" ]] || continue
    # 处理逻辑...
done

# 临时文件 (自动清理)
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

# 工具依赖检查
require_command() {
    command -v "$1" &> /dev/null || { echo "错误: 需要 $1" >&2; exit 1; }
}
require_command jq

# jq 处理
VALUE=$(jq -r '.field' "$INPUT_PATH")                    # 读取字段
jq '.field = "new"' input.json > output.json             # 修改字段
jq -s 'add' file1.json file2.json > merged.json          # 合并文件
```

---

## Python 实现

```python
#!/usr/bin/env python3
"""
{{script_description}}
"""

import argparse
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='{{script_description}}')
    parser.add_argument('--input-path', type=str, required=True, help='输入文件路径')
    parser.add_argument('--output-dir', type=str, required=True, help='输出目录')
    args = parser.parse_args()

    # 验证输入
    input_path = Path(args.input_path)
    if not input_path.exists():
        print(f"错误: 输入文件不存在: {input_path}", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 执行处理
    try:
        result = process(input_path, output_dir)
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)

    # 输出 JSON 结果
    print(json.dumps(result))


def process(input_path: Path, output_dir: Path) -> dict:
    """核心处理逻辑"""
    # TODO: 实现处理逻辑

    output_file = output_dir / 'result.json'

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    processed_count = len(data) if isinstance(data, list) else 1

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return {
        'output_file': str(output_file),
        'items_processed': processed_count,
        'status': 'success'
    }


if __name__ == '__main__':
    main()
```

### Python 常用模式

```python
# 文件遍历
def process_files(input_dir: Path, pattern: str = '*.json') -> list:
    return [
        {'file': str(f), 'data': json.load(f.open())}
        for f in input_dir.glob(pattern)
    ]

# 数据转换
def transform(data: dict) -> dict:
    return {
        'id': data.get('id'),
        'name': data.get('name', '').strip(),
        'timestamp': datetime.now().isoformat()
    }

# 外部命令调用
import subprocess

def run_command(cmd: list) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return result.stdout
```

---

## 运行时选择指南

```
任务特征
    ↓
    ├─ 文件处理 / 系统命令 / 管道操作
    │   └─ 选 Bash (.sh)
    │
    ├─ JSON 数据处理 / 复杂转换 / 数据分析
    │   └─ 选 Python (.py)
    │
    └─ 简单读写 / 格式转换
        └─ 任选（Bash 更轻量）
```

---

## 生成函数

```javascript
function generateScript(scriptConfig) {
  const runtime = scriptConfig.runtime || 'bash';  // 'bash' | 'python'
  const ext = runtime === 'python' ? '.py' : '.sh';

  if (runtime === 'python') {
    return generatePythonScript(scriptConfig);
  }
  return generateBashScript(scriptConfig);
}

function generateBashScript(scriptConfig) {
  const { description, inputs = [], outputs = [] } = scriptConfig;

  const paramDefs = inputs.map(i =>
    `${i.name.toUpperCase().replace(/-/g, '_')}="${i.default || ''}"`
  ).join('\n');

  const paramParse = inputs.map(i =>
    `        --${i.name}) ${i.name.toUpperCase().replace(/-/g, '_')}="$2"; shift ;;`
  ).join('\n');

  const paramValidation = inputs.filter(i => i.required).map(i => {
    const VAR = i.name.toUpperCase().replace(/-/g, '_');
    return `[[ -z "$${VAR}" ]] && { echo "错误: --${i.name} 是必需参数" >&2; exit 1; }`;
  }).join('\n');

  return `#!/bin/bash
# ${description}

set -euo pipefail

${paramDefs}

while [[ "$#" -gt 0 ]]; do
    case $1 in
${paramParse}
        *) echo "未知参数: $1" >&2; exit 1 ;;
    esac
    shift
done

${paramValidation}

# TODO: 实现处理逻辑

# 输出结果 (jq 构建)
jq -n ${outputs.map(o =>
  `--arg ${o.name} "$${o.name.toUpperCase().replace(/-/g, '_')}"`
).join(' \\\n    ')} \
    '{${outputs.map(o => `${o.name}: $${o.name}`).join(', ')}}'
`;
}

function generatePythonScript(scriptConfig) {
  const { description, inputs = [], outputs = [] } = scriptConfig;

  const argDefs = inputs.map(i =>
    `    parser.add_argument('--${i.name}', type=${i.type || 'str'}, ${
      i.required ? 'required=True' : `default='${i.default || ''}'`
    }, help='${i.description || i.name}')`
  ).join('\n');

  const resultFields = outputs.map(o =>
    `        '${o.name}': None  # ${o.description || o.name}`
  ).join(',\n');

  return `#!/usr/bin/env python3
"""
${description}
"""

import argparse
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='${description}')
${argDefs}
    args = parser.parse_args()

    # TODO: 实现处理逻辑
    result = {
${resultFields}
    }

    print(json.dumps(result))


if __name__ == '__main__':
    main()
`;
}
```

---

## 目录约定

```
scripts/
├── process-data.py    # id: process-data, runtime: python
├── validate.sh        # id: validate, runtime: bash
└── transform.js       # id: transform, runtime: node
```

- **命名即 ID**: 文件名（不含扩展名）= 脚本 ID
- **扩展名即运行时**: `.py` → python, `.sh` → bash, `.js` → node
