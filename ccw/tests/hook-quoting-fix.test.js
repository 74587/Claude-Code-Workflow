/**
 * Test for hook quoting fix (Issue #73)
 * https://github.com/catlog22/Claude-Code-Workflow/issues/73
 *
 * Tests that bash -c commands use single quotes to avoid jq escaping issues
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import the convertToClaudeCodeFormat function logic
// Since it's in a browser JS file, we'll recreate it here for testing
function convertToClaudeCodeFormat(hookData) {
  if (hookData.hooks && Array.isArray(hookData.hooks)) {
    return hookData;
  }

  let commandStr = hookData.command || '';
  if (hookData.args && Array.isArray(hookData.args)) {
    if (commandStr === 'bash' && hookData.args.length >= 2 && hookData.args[0] === '-c') {
      const script = hookData.args[1];
      const escapedScript = script.replace(/'/g, "'\\''");
      commandStr = `bash -c '${escapedScript}'`;
      if (hookData.args.length > 2) {
        const additionalArgs = hookData.args.slice(2).map(arg => {
          if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
            return `"${arg.replace(/"/g, '\\"')}"`;
          }
          return arg;
        });
        commandStr += ' ' + additionalArgs.join(' ');
      }
    } else {
      const quotedArgs = hookData.args.map(arg => {
        if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
          return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
      });
      commandStr = `${commandStr} ${quotedArgs.join(' ')}`.trim();
    }
  }

  return {
    hooks: [{
      type: 'command',
      command: commandStr
    }]
  };
}

describe('Hook Quoting Fix (Issue #73)', () => {
  describe('convertToClaudeCodeFormat', () => {
    it('should use single quotes for bash -c commands', () => {
      const hookData = {
        command: 'bash',
        args: ['-c', 'echo "hello"']
      };

      const result = convertToClaudeCodeFormat(hookData);

      assert.match(result.hooks[0].command, /^bash -c '/);
      assert.match(result.hooks[0].command, /'$/);
      assert.doesNotMatch(result.hooks[0].command, /^bash -c "/);
    });

    it('should preserve jq command double quotes without excessive escaping', () => {
      const hookData = {
        command: 'bash',
        args: ['-c', 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty"); exit 0']
      };

      const result = convertToClaudeCodeFormat(hookData);
      const cmd = result.hooks[0].command;

      // The jq pattern should remain readable
      assert.ok(cmd.includes('jq -r ".tool_input.command // empty"'));
      // Should not have excessive escaping like \\\"
      assert.ok(!cmd.includes('\\\\\\"'));
    });

    it('should correctly escape single quotes in script using \'\\\'\'', () => {
      const hookData = {
        command: 'bash',
        args: ['-c', "echo 'hello world'"]
      };

      const result = convertToClaudeCodeFormat(hookData);
      const cmd = result.hooks[0].command;

      // Single quotes should be escaped as '\''
      assert.ok(cmd.includes("'\\''"));
      assert.equal(cmd, "bash -c 'echo '\\''hello world'\\'''");
    });

    it('should handle danger-bash-confirm hook template correctly', () => {
      const hookData = {
        command: 'bash',
        args: ['-c', 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty"); DANGEROUS_PATTERNS="rm -rf|rmdir|del /|format |shutdown|reboot|kill -9|pkill|mkfs|dd if=|chmod 777|chown -R|>/dev/|wget.*\\|.*sh|curl.*\\|.*bash"; if echo "$CMD" | grep -qiE "$DANGEROUS_PATTERNS"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"ask\\",\\"permissionDecisionReason\\":\\"Potentially dangerous command detected: requires user confirmation\\"}}"; exit 0; fi; exit 0']
      };

      const result = convertToClaudeCodeFormat(hookData);
      const cmd = result.hooks[0].command;

      // Should use single quotes
      assert.match(cmd, /^bash -c '/);
      // jq pattern should be intact
      assert.ok(cmd.includes('jq -r ".tool_input.command // empty"'));
      // JSON output should have escaped double quotes (in shell)
      assert.ok(cmd.includes('{\\"hookSpecificOutput\\"'));
    });

    it('should handle non-bash commands with original logic', () => {
      const hookData = {
        command: 'ccw',
        args: ['memory', 'track', '--type', 'file', '--action', 'read']
      };

      const result = convertToClaudeCodeFormat(hookData);

      assert.equal(result.hooks[0].command, 'ccw memory track --type file --action read');
    });

    it('should handle bash commands without -c flag with original logic', () => {
      const hookData = {
        command: 'bash',
        args: ['script.sh', '--arg', 'value']
      };

      const result = convertToClaudeCodeFormat(hookData);

      assert.equal(result.hooks[0].command, 'bash script.sh --arg value');
    });

    it('should handle args with spaces in non-bash commands', () => {
      const hookData = {
        command: 'echo',
        args: ['hello world', 'another arg']
      };

      const result = convertToClaudeCodeFormat(hookData);

      assert.equal(result.hooks[0].command, 'echo "hello world" "another arg"');
    });

    it('should handle already formatted hook data', () => {
      const hookData = {
        hooks: [{
          type: 'command',
          command: 'existing command'
        }]
      };

      const result = convertToClaudeCodeFormat(hookData);

      assert.equal(result, hookData);
    });

    it('should handle additional args after bash -c script', () => {
      const hookData = {
        command: 'bash',
        args: ['-c', 'echo $1', 'bash', 'hello world']
      };

      const result = convertToClaudeCodeFormat(hookData);
      const cmd = result.hooks[0].command;

      assert.match(cmd, /^bash -c 'echo \$1'/);
      assert.ok(cmd.includes('"hello world"'));
    });
  });

  describe('Real-world hook templates', () => {
    const HOOK_TEMPLATES = {
      'danger-bash-confirm': {
        command: 'bash',
        args: ['-c', 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty"); DANGEROUS_PATTERNS="rm -rf|rmdir|del /|format |shutdown|reboot|kill -9|pkill|mkfs|dd if=|chmod 777|chown -R|>/dev/|wget.*\\|.*sh|curl.*\\|.*bash"; if echo "$CMD" | grep -qiE "$DANGEROUS_PATTERNS"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"ask\\",\\"permissionDecisionReason\\":\\"Potentially dangerous command detected: requires user confirmation\\"}}"; exit 0; fi; exit 0']
      },
      'danger-file-protection': {
        command: 'bash',
        args: ['-c', 'INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty"); PROTECTED=".env|.git/|package-lock.json|yarn.lock|.credentials|secrets|id_rsa|.pem$|.key$"; if echo "$FILE" | grep -qiE "$PROTECTED"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"deny\\",\\"permissionDecisionReason\\":\\"Protected file cannot be modified: $FILE\\"}}"; exit 0; fi; exit 0']
      },
      'ccw-notify': {
        command: 'bash',
        args: ['-c', 'INPUT=$(cat); FILE_PATH=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty"); [ -n "$FILE_PATH" ] && curl -s -X POST -H "Content-Type: application/json" -d "{\\"type\\":\\"file_written\\",\\"filePath\\":\\"$FILE_PATH\\"}" http://localhost:3456/api/hook || true']
      },
      'log-tool': {
        command: 'bash',
        args: ['-c', 'mkdir -p "$HOME/.claude"; INPUT=$(cat); TOOL=$(echo "$INPUT" | jq -r ".tool_name // empty" 2>/dev/null); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty" 2>/dev/null); echo "[$(date)] Tool: $TOOL, File: $FILE" >> "$HOME/.claude/tool-usage.log"']
      }
    };

    for (const [name, template] of Object.entries(HOOK_TEMPLATES)) {
      it(`should convert ${name} template correctly`, () => {
        const result = convertToClaudeCodeFormat(template);
        const cmd = result.hooks[0].command;

        // All bash -c commands should use single quotes
        assert.match(cmd, /^bash -c '/);
        assert.match(cmd, /'$/);

        // jq patterns should be intact
        assert.ok(cmd.includes('jq -r ".'));
      });
    }
  });
});
