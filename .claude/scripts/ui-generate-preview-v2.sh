#!/bin/bash
#
# UI Generate Preview v2.0 - Simplified Preview Generation
# Purpose: Generate compare.html and index.html for style-centric prototypes
# No template substitution - just preview generation
#
# Usage: ui-generate-preview-v2.sh <prototypes_dir>
#

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

prototypes_dir="${1:-.}"

if [[ ! -d "$prototypes_dir" ]]; then
    echo -e "${RED}Error: Directory not found: $prototypes_dir${NC}"
    exit 1
fi

cd "$prototypes_dir" || exit 1

echo -e "${GREEN}📊 Auto-detecting matrix dimensions...${NC}"

# Auto-detect styles, layouts, targets from file patterns
# Pattern: {target}-style-{s}-layout-{l}.html
styles=$(find . -maxdepth 1 -name "*-style-*-layout-*.html" | \
         sed 's/.*-style-\([0-9]\+\)-.*/\1/' | sort -un)
layouts=$(find . -maxdepth 1 -name "*-style-*-layout-*.html" | \
          sed 's/.*-layout-\([0-9]\+\)\.html/\1/' | sort -un)
targets=$(find . -maxdepth 1 -name "*-style-*-layout-*.html" | \
          sed 's/\.\///; s/-style-.*//' | sort -u)

S=$(echo "$styles" | wc -l)
L=$(echo "$layouts" | wc -l)
T=$(echo "$targets" | wc -l)

echo -e "   Detected: ${GREEN}${S}${NC} styles × ${GREEN}${L}${NC} layouts × ${GREEN}${T}${NC} targets"

if [[ $S -eq 0 ]] || [[ $L -eq 0 ]] || [[ $T -eq 0 ]]; then
    echo -e "${RED}Error: No prototype files found matching pattern{target}-style-{s}-layout-{l}.html${NC}"
    exit 1
fi

# Generate compare.html
echo -e "${YELLOW}🎨 Generating compare.html...${NC}"

cat > compare.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI Design Matrix - Style × Layout Comparison</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header h1 { margin-bottom: 10px; color: #333; }
        .header .stats { color: #666; font-size: 14px; }
        .controls {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .controls label { margin-right: 10px; font-weight: 500; }
        .controls select {
            padding: 5px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-right: 20px;
        }
        .matrix-container { margin-bottom: 40px; }
        .matrix-title {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px 8px 0 0;
            font-size: 18px;
            font-weight: 600;
        }
        .matrix {
            display: grid;
            gap: 20px;
            padding: 20px;
            background: white;
            border-radius: 0 0 8px 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .cell {
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            background: #fafafa;
            transition: all 0.3s ease;
        }
        .cell:hover {
            border-color: #667eea;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
            transform: translateY(-2px);
        }
        .cell-header {
            padding: 12px 15px;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
            font-weight: 600;
            color: #495057;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .cell-header .badge {
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
        }
        .iframe-wrapper {
            position: relative;
            width: 100%;
            padding-top: 75%; /* 4:3 aspect ratio */
            background: white;
        }
        iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
        .cell-footer {
            padding: 10px 15px;
            background: #f8f9fa;
            border-top: 1px solid #e0e0e0;
            font-size: 12px;
            color: #6c757d;
            text-align: center;
        }
        .cell-footer a {
            color: #667eea;
            text-decoration: none;
            margin: 0 5px;
        }
        .cell-footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎨 UI Design Matrix Comparison</h1>
        <div class="stats">
            <span id="matrix-stats"></span>
        </div>
    </div>

    <div class="controls">
        <label for="target-selector">Target:</label>
        <select id="target-selector"></select>

        <label for="layout-cols">Columns:</label>
        <select id="layout-cols">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3" selected>3</option>
            <option value="4">4</option>
        </select>
    </div>

    <div id="matrices-container"></div>

    <script>
        // Data from script
        const styles = STYLES_PLACEHOLDER;
        const layouts = LAYOUTS_PLACEHOLDER;
        const targets = TARGETS_PLACEHOLDER;

        // Update stats
        document.getElementById('matrix-stats').textContent =
            `${styles.length} styles × ${layouts.length} layouts × ${targets.length} targets = ${styles.length * layouts.length * targets.length} prototypes`;

        // Populate target selector
        const targetSelector = document.getElementById('target-selector');
        targets.forEach((target, index) => {
            const option = document.createElement('option');
            option.value = target;
            option.textContent = target.charAt(0).toUpperCase() + target.slice(1);
            if (index === 0) option.selected = true;
            targetSelector.appendChild(option);
        });

        // Generate matrices
        function renderMatrices(target) {
            const container = document.getElementById('matrices-container');
            container.innerHTML = '';

            styles.forEach(styleId => {
                const matrixContainer = document.createElement('div');
                matrixContainer.className = 'matrix-container';

                const title = document.createElement('div');
                title.className = 'matrix-title';
                title.textContent = `Style ${styleId} - ${target.charAt(0).toUpperCase() + target.slice(1)}`;

                const matrix = document.createElement('div');
                matrix.className = 'matrix';
                matrix.id = `matrix-style-${styleId}`;

                layouts.forEach(layoutId => {
                    const cell = document.createElement('div');
                    cell.className = 'cell';

                    const header = document.createElement('div');
                    header.className = 'cell-header';
                    header.innerHTML = `
                        <span>Layout ${layoutId}</span>
                        <span class="badge">S${styleId}L${layoutId}</span>
                    `;

                    const iframeWrapper = document.createElement('div');
                    iframeWrapper.className = 'iframe-wrapper';

                    const iframe = document.createElement('iframe');
                    iframe.src = `./${target}-style-${styleId}-layout-${layoutId}.html`;
                    iframe.loading = 'lazy';

                    const footer = document.createElement('div');
                    footer.className = 'cell-footer';
                    footer.innerHTML = `
                        <a href="./${target}-style-${styleId}-layout-${layoutId}.html" target="_blank">Open ↗</a>
                        <a href="./${target}-style-${styleId}-layout-${layoutId}.css" target="_blank">CSS</a>
                    `;

                    iframeWrapper.appendChild(iframe);
                    cell.appendChild(header);
                    cell.appendChild(iframeWrapper);
                    cell.appendChild(footer);
                    matrix.appendChild(cell);
                });

                matrixContainer.appendChild(title);
                matrixContainer.appendChild(matrix);
                container.appendChild(matrixContainer);
            });

            updateGridColumns();
        }

        function updateGridColumns() {
            const cols = document.getElementById('layout-cols').value;
            styles.forEach(styleId => {
                const matrix = document.getElementById(`matrix-style-${styleId}`);
                if (matrix) {
                    matrix.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                }
            });
        }

        // Event listeners
        targetSelector.addEventListener('change', (e) => {
            renderMatrices(e.target.value);
        });

        document.getElementById('layout-cols').addEventListener('change', updateGridColumns);

        // Initial render
        renderMatrices(targets[0]);
    </script>
</body>
</html>
EOF

# Replace placeholders with actual data
sed -i "s/STYLES_PLACEHOLDER/[$(echo "$styles" | tr '\n' ',' | sed 's/,$//' | sed 's/\([0-9]\+\)/"\1"/g')]/" compare.html
sed -i "s/LAYOUTS_PLACEHOLDER/[$(echo "$layouts" | tr '\n' ',' | sed 's/,$//' | sed 's/\([0-9]\+\)/"\1"/g')]/" compare.html
sed -i "s/TARGETS_PLACEHOLDER/[$(echo "$targets" | tr '\n' ',' | sed 's/,$//' | sed 's/\(.*\)/"\1"/g')]/" compare.html

echo -e "${GREEN}   ✓ Generated compare.html${NC}"

# Generate index.html
echo -e "${YELLOW}📋 Generating index.html...${NC}"

cat > index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI Prototypes Index</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f5f5f5;
        }
        h1 { margin-bottom: 10px; color: #333; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .cta {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .cta h2 { margin-bottom: 10px; }
        .cta a {
            display: inline-block;
            background: white;
            color: #667eea;
            padding: 10px 20px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 10px;
        }
        .cta a:hover { background: #f8f9fa; }
        .style-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .style-section h2 {
            color: #495057;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e9ecef;
        }
        .target-group {
            margin-bottom: 20px;
        }
        .target-group h3 {
            color: #6c757d;
            font-size: 16px;
            margin-bottom: 10px;
        }
        .link-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 10px;
        }
        .prototype-link {
            padding: 12px 16px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            text-decoration: none;
            color: #495057;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        }
        .prototype-link:hover {
            background: #e9ecef;
            border-color: #667eea;
            transform: translateX(2px);
        }
        .prototype-link .label { font-weight: 500; }
        .prototype-link .icon { color: #667eea; }
    </style>
</head>
<body>
    <h1>🎨 UI Prototypes Index</h1>
    <p class="subtitle">Generated ${S}×${L}×${T} = $((S*L*T)) prototypes</p>

    <div class="cta">
        <h2>📊 Interactive Comparison</h2>
        <p>View all styles and layouts side-by-side in an interactive matrix</p>
        <a href="compare.html">Open Matrix View →</a>
    </div>

    <h2>📂 All Prototypes</h2>
EOF

# Generate index content
for style in $styles; do
    echo "<div class='style-section'>" >> index.html
    echo "<h2>Style ${style}</h2>" >> index.html

    for target in $targets; do
        target_capitalized="$(echo ${target:0:1} | tr '[:lower:]' '[:upper:]')${target:1}"
        echo "<div class='target-group'>" >> index.html
        echo "<h3>${target_capitalized}</h3>" >> index.html
        echo "<div class='link-grid'>" >> index.html

        for layout in $layouts; do
            html_file="${target}-style-${style}-layout-${layout}.html"
            if [[ -f "$html_file" ]]; then
                echo "<a href='${html_file}' class='prototype-link' target='_blank'>" >> index.html
                echo "<span class='label'>Layout ${layout}</span>" >> index.html
                echo "<span class='icon'>↗</span>" >> index.html
                echo "</a>" >> index.html
            fi
        done

        echo "</div></div>" >> index.html
    done

    echo "</div>" >> index.html
done

cat >> index.html << EOF
</body>
</html>
EOF

echo -e "${GREEN}   ✓ Generated index.html${NC}"

# Generate PREVIEW.md
echo -e "${YELLOW}📝 Generating PREVIEW.md...${NC}"

cat > PREVIEW.md << EOF
# UI Prototypes Preview Guide

Generated: $(date +"%Y-%m-%d %H:%M:%S")

## 📊 Matrix Dimensions

- **Styles**: ${S}
- **Layouts**: ${L}
- **Targets**: ${T}
- **Total Prototypes**: $((S*L*T))

## 🌐 How to View

### Option 1: Interactive Matrix (Recommended)

Open \`compare.html\` in your browser to see all prototypes in an interactive matrix view.

**Features**:
- Side-by-side comparison of all styles and layouts
- Switch between targets using the dropdown
- Adjust grid columns for better viewing
- Direct links to full-page views

### Option 2: Simple Index

Open \`index.html\` for a simple list of all prototypes with direct links.

### Option 3: Direct File Access

Each prototype can be opened directly:
- Pattern: \`{target}-style-{s}-layout-{l}.html\`
- Example: \`dashboard-style-1-layout-1.html\`

## 📁 File Structure

\`\`\`
prototypes/
├── compare.html           # Interactive matrix view
├── index.html             # Simple navigation index
├── PREVIEW.md             # This file
$(for style in $styles; do
    for target in $targets; do
        for layout in $layouts; do
            echo "├── ${target}-style-${style}-layout-${layout}.html"
            echo "├── ${target}-style-${style}-layout-${layout}.css"
        done
    done
done)
\`\`\`

## 🎨 Style Variants

$(for style in $styles; do
    echo "### Style ${style}"
    echo ""
    style_guide="../style-consolidation/style-${style}/style-guide.md"
    if [[ -f "$style_guide" ]]; then
        head -n 10 "$style_guide" | tail -n +2 || echo "Design philosophy and tokens"
    else
        echo "Design system ${style}"
    fi
    echo ""
done)

## 📐 Layout Variants

$(for layout in $layouts; do
    echo "### Layout ${layout}"
    echo ""
    for target in $targets; do
        layout_plan="_templates/${target}-layout-${layout}.json"
        if [[ -f "$layout_plan" ]]; then
            name=$(grep -o '"name":[[:space:]]*"[^"]*"' "$layout_plan" | head -1 | cut -d'"' -f4 || echo "Layout ${layout}")
            echo "- **${target}**: ${name}"
        fi
    done
    echo ""
done)

## 🎯 Targets

$(for target in $targets; do
    target_capitalized="$(echo ${target:0:1} | tr '[:lower:]' '[:upper:]')${target:1}"
    echo "- **${target_capitalized}**: ${L} layouts × ${S} styles = $((L*S)) variations"
done)

## 💡 Tips

1. **Comparison**: Use compare.html to see how different styles affect the same layout
2. **Navigation**: Use index.html for quick access to specific prototypes
3. **Inspection**: Open browser DevTools to inspect HTML structure and CSS
4. **Sharing**: All files are standalone - can be shared or deployed directly

## 📝 Next Steps

1. Review prototypes in compare.html
2. Select preferred style × layout combinations
3. Provide feedback for refinement
4. Use selected designs for implementation

---

Generated by /workflow:ui-design:generate-v2 (Style-Centric Architecture)
EOF

echo -e "${GREEN}   ✓ Generated PREVIEW.md${NC}"

echo ""
echo -e "${GREEN}✅ Preview generation complete!${NC}"
echo -e "   Files created: compare.html, index.html, PREVIEW.md"
echo -e "   Matrix: ${S} styles × ${L} layouts × ${T} targets = $((S*L*T)) prototypes"
echo ""
echo -e "${YELLOW}🌐 Open compare.html to view interactive matrix${NC}"
