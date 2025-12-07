# Tool Strategy

## ⚡ Exa Triggering Mechanisms

**Auto-Trigger**:
- User mentions "exa-code" or code-related queries → `mcp__exa__get_code_context_exa`
- Need current web information → `mcp__exa__web_search_exa`

**Manual Trigger**:
- Complex API research → Exa Code Context
- Real-time information needs → Exa Web Search

## ⚡ Bash Text Processing (sed/awk)

**When to Use**: Edit tool fails 2+ times on same file

### sed Quick Reference

```bash
# Replace first occurrence per line
sed 's/old/new/' file.txt

# Replace all occurrences (global)
sed 's/old/new/g' file.txt

# In-place edit (modify file directly)
sed -i 's/old/new/g' file.txt

# Delete lines matching pattern
sed '/pattern/d' file.txt

# Insert line before match
sed '/pattern/i\new line' file.txt

# Insert line after match
sed '/pattern/a\new line' file.txt

# Replace on specific line number
sed '5s/old/new/' file.txt

# Multi-line replacement (escape newlines)
sed ':a;N;$!ba;s/old\npattern/new\ntext/g' file.txt
```

### awk Quick Reference

```bash
# Print specific column
awk '{print $1}' file.txt

# Print lines matching pattern
awk '/pattern/' file.txt

# Replace field value
awk '{$2="new"; print}' file.txt

# Conditional replacement
awk '/pattern/{gsub(/old/,"new")}1' file.txt

# Insert line after match
awk '/pattern/{print; print "new line"; next}1' file.txt

# Multi-field operations
awk -F',' '{print $1, $3}' file.csv
```

### Fallback Strategy

1. **Edit fails 2+ times** → Try sed for simple replacements
2. **sed fails** → Try awk for complex patterns
3. **awk fails** → Use Write to recreate file
