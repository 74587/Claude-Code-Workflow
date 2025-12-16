#!/bin/bash
# 重新索引项目以提取代码关系数据
# 用于解决 Graph Explorer 显示为空的问题

set -e

PROJECT_PATH="${1:-D:/Claude_dms3}"
INDEX_DIR="$HOME/.codexlens/indexes"

# 规范化路径用于索引目录
NORMALIZED_PATH=$(echo "$PROJECT_PATH" | sed 's|^/\([a-z]\)/|\U\1/|' | sed 's|^/||')
INDEX_DB_DIR="$INDEX_DIR/$NORMALIZED_PATH"
INDEX_DB="$INDEX_DB_DIR/_index.db"

echo "=========================================="
echo "CodexLens 重新索引工具"
echo "=========================================="
echo "项目路径: $PROJECT_PATH"
echo "索引路径: $INDEX_DB"
echo ""

# 检查数据库是否存在
if [ ! -f "$INDEX_DB" ]; then
    echo "❌ 索引数据库不存在: $INDEX_DB"
    echo "请先运行: codex init $PROJECT_PATH"
    exit 1
fi

# 检查当前数据统计
echo "📊 当前数据统计："
sqlite3 "$INDEX_DB" "
SELECT
    '文件数: ' || (SELECT COUNT(*) FROM files) ||
    ' | 符号数: ' || (SELECT COUNT(*) FROM symbols) ||
    ' | 关系数: ' || (SELECT COUNT(*) FROM code_relationships);
"

RELATIONSHIPS_COUNT=$(sqlite3 "$INDEX_DB" "SELECT COUNT(*) FROM code_relationships;")

if [ "$RELATIONSHIPS_COUNT" -gt 0 ]; then
    echo ""
    echo "✅ 数据库已包含 $RELATIONSHIPS_COUNT 个代码关系"
    echo "如果 Graph Explorer 仍然显示为空，请检查前端控制台错误"
    exit 0
fi

echo ""
echo "⚠️  检测到 code_relationships 表为空"
echo ""
echo "解决方案："
echo "1. 备份现有索引（推荐）"
echo "2. 删除旧索引"
echo "3. 重新索引项目"
echo ""

read -p "是否继续？这将删除并重建索引。(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 1. 备份现有索引
BACKUP_DIR="$INDEX_DB_DIR/backup_$(date +%Y%m%d_%H%M%S)"
echo ""
echo "📦 备份现有索引到: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp "$INDEX_DB" "$BACKUP_DIR/"
echo "✓ 备份完成"

# 2. 删除旧索引
echo ""
echo "🗑️  删除旧索引..."
rm -f "$INDEX_DB"
echo "✓ 已删除"

# 3. 重新索引
echo ""
echo "🔍 重新索引项目（这可能需要几分钟）..."
cd "$PROJECT_PATH"

# 使用 CodexLens CLI 重新索引
if command -v codex &> /dev/null; then
    codex init .
else
    echo "❌ 未找到 codex 命令"
    echo "请先安装 CodexLens:"
    echo "  cd codex-lens"
    echo "  pip install -e ."
    exit 1
fi

# 4. 验证结果
echo ""
echo "📊 重新索引后的数据统计："
sqlite3 "$INDEX_DB" "
SELECT
    '文件数: ' || (SELECT COUNT(*) FROM files) ||
    ' | 符号数: ' || (SELECT COUNT(*) FROM symbols) ||
    ' | 关系数: ' || (SELECT COUNT(*) FROM code_relationships);
"

RELATIONSHIPS_AFTER=$(sqlite3 "$INDEX_DB" "SELECT COUNT(*) FROM code_relationships;")

echo ""
if [ "$RELATIONSHIPS_AFTER" -gt 0 ]; then
    echo "✅ 成功！已提取 $RELATIONSHIPS_AFTER 个代码关系"
    echo ""
    echo "📋 示例关系："
    sqlite3 "$INDEX_DB" "
    SELECT
        s.name || ' --[' || r.relationship_type || ']--> ' || r.target_qualified_name
    FROM code_relationships r
    JOIN symbols s ON r.source_symbol_id = s.id
    LIMIT 5;
    " | head -5
    echo ""
    echo "下一步："
    echo "1. 启动 CCW Dashboard: ccw view"
    echo "2. 点击左侧边栏的 Graph 图标"
    echo "3. 应该能看到代码关系图谱"
else
    echo "⚠️  警告：关系数据仍然为 0"
    echo ""
    echo "可能原因："
    echo "1. 项目中没有 Python/JavaScript/TypeScript 文件"
    echo "2. TreeSitter 解析器未正确安装"
    echo "3. 文件语法错误导致解析失败"
    echo ""
    echo "调试步骤："
    echo "1. 检查项目语言："
    sqlite3 "$INDEX_DB" "SELECT DISTINCT language FROM files LIMIT 10;"
    echo ""
    echo "2. 测试 GraphAnalyzer："
    echo "   python -c 'from codexlens.semantic.graph_analyzer import GraphAnalyzer; print(GraphAnalyzer(\"python\").is_available())'"
fi

echo ""
echo "=========================================="
echo "完成"
echo "=========================================="
