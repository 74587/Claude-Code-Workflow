#!/usr/bin/env python3
"""Fix SQL statements in test files to match new schema."""
import re
from pathlib import Path

def fix_insert_statement(line):
    """Fix INSERT statements to provide both name and full_path."""
    # Match pattern: (test_path, test_content, "python")
    # or ("test/file1.py", "content1", "python")
    pattern = r'\(([^,]+),\s*([^,]+),\s*([^)]+)\)'
    
    def replace_values(match):
        path_var, content_var, lang_var = match.groups()
        # If it's a variable, we need to extract name from it
        # For now, use path_var for both name and full_path
        return f'({path_var}.split("/")[-1] if "/" in {path_var} else {path_var}, {path_var}, {content_var}, {lang_var}, 1234567890.0)'
    
    # Check if this is an INSERT VALUES line
    if 'INSERT INTO files' in line and 'VALUES' in line:
        # Simple string values like ("test/file1.py", "content1", "python")
        if re.search(r'\("[^"]+",\s*"[^"]+",\s*"[^"]+"\)', line):
            def replace_str_values(match):
                parts = match.group(0)[1:-1].split('", "')
                if len(parts) == 3:
                    path = parts[0].strip('"')
                    content = parts[1]
                    lang = parts[2].strip('"')
                    name = path.split('/')[-1]
                    return f'("{name}", "{path}", "{content}", "{lang}", 1234567890.0)'
                return match.group(0)
            
            line = re.sub(r'\("[^"]+",\s*"[^"]+",\s*"[^"]+"\)', replace_str_values, line)
    
    return line

def main():
    test_files = [
        Path("test_dual_fts.py"),
        Path("test_incremental_indexing.py"),
        Path("test_hybrid_search_e2e.py")
    ]
    
    for test_file in test_files:
        if not test_file.exists():
            continue
            
        lines = test_file.read_text(encoding='utf-8').splitlines(keepends=True)
        
        # Fix tuple values in execute calls
        new_lines = []
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Check if this is an execute with VALUES and tuple on next line
            if 'conn.execute(' in line or 'conn.executemany(' in line:
                # Look ahead for VALUES pattern
                if i + 2 < len(lines) and 'VALUES' in lines[i+1]:
                    # Check for tuple pattern on line after VALUES
                    if i + 2 < len(lines) and re.search(r'^\s*\([^)]+\)\s*$', lines[i+2]):
                        tuple_line = lines[i+2]
                        # Extract values: (test_path, test_content, "python")
                        match = re.search(r'\(([^,]+),\s*([^,]+),\s*"([^"]+)"\)', tuple_line)
                        if match:
                            var1, var2, var3 = match.groups()
                            var1 = var1.strip()
                            var2 = var2.strip()
                            # Create new tuple with name extraction
                            indent = re.match(r'^(\s*)', tuple_line).group(1)
                            new_tuple = f'{indent}({var1}.split("/")[-1], {var1}, {var2}, "{var3}", 1234567890.0)\n'
                            new_lines.append(line)
                            new_lines.append(lines[i+1])
                            new_lines.append(new_tuple)
                            i += 3
                            continue
            
            new_lines.append(line)
            i += 1
        
        test_file.write_text(''.join(new_lines), encoding='utf-8')
        print(f"Fixed {test_file}")

if __name__ == "__main__":
    main()
