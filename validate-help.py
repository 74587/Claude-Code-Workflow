#!/usr/bin/env python3
import os
import json
import sys

# Read command.json
command_json_path = os.path.expandvars('D:\\Claude_dms3\\.claude\\skills\\ccw-help\\command.json')

try:
    with open(command_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception as e:
    print(f"Error reading command.json: {e}")
    sys.exit(1)

base_dir = os.path.expandvars('D:\\Claude_dms3\\.claude\\skills\\ccw-help')
commands_base = os.path.expandvars('D:\\Claude_dms3\\.claude\\commands')

# Check commands
missing = []
existing = []

print("Checking command source files...")
print("=" * 70)

for cmd in data.get('commands', []):
    if cmd.get('source'):
        # Resolve path from ccw-help directory
        full_path = os.path.normpath(os.path.join(base_dir, cmd['source']))
        exists = os.path.isfile(full_path)

        if exists:
            existing.append((cmd['command'], full_path))
        else:
            missing.append((cmd['command'], cmd['source'], full_path))

# Print missing files
if missing:
    print(f"\n❌ MISSING SOURCE FILES ({len(missing)}):")
    print("-" * 70)
    for cmd, source, resolved in missing[:20]:  # Show first 20
        print(f"{cmd}")
        print(f"  Source: {source}")
        print(f"  Expected: {resolved}")
else:
    print(f"\n✅ All source files exist!")

print(f"\n" + "=" * 70)
print(f"SUMMARY:")
print(f"  Total commands: {len(data.get('commands', []))}")
print(f"  Source files exist: {len(existing)}")
print(f"  Source files missing: {len(missing)}")
print("=" * 70)

# List commands without source
no_source = [cmd['command'] for cmd in data.get('commands', []) if not cmd.get('source')]
if no_source:
    print(f"\n⚠️  Commands without 'source' field ({len(no_source)}):")
    for cmd_name in no_source[:10]:
        print(f"  - {cmd_name}")
