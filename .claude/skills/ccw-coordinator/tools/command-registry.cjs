#!/usr/bin/env node

/**
 * Command Registry Tool
 *
 * 功能:
 * 1. 根据命令名称查找并提取 YAML 头
 * 2. 从全局 .claude/commands/workflow 目录读取
 * 3. 支持按需提取（不是全量扫描）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class CommandRegistry {
  constructor(commandDir = null) {
    // 优先使用传入的目录
    if (commandDir) {
      this.commandDir = commandDir;
    } else {
      // 自动查找 .claude/commands/workflow
      this.commandDir = this.findCommandDir();
    }
    this.cache = {};
  }

  /**
   * 自动查找 .claude/commands/workflow 目录
   * 支持: 项目相对路径、用户 home 目录
   */
  findCommandDir() {
    // 1. 尝试相对于当前工作目录
    const relativePath = path.join('.claude', 'commands', 'workflow');
    if (fs.existsSync(relativePath)) {
      return path.resolve(relativePath);
    }

    // 2. 尝试用户 home 目录
    const homeDir = os.homedir();
    const homeCommandDir = path.join(homeDir, '.claude', 'commands', 'workflow');
    if (fs.existsSync(homeCommandDir)) {
      return homeCommandDir;
    }

    // 未找到时返回 null，后续操作会失败并提示
    return null;
  }

  /**
   * 解析 YAML 头 (简化版本)
   *
   * 限制:
   * - 只支持简单的 key: value 对 (单行值)
   * - 不支持多行值、嵌套对象、复杂列表
   * - allowed-tools 字段支持逗号分隔的字符串，自动转为数组
   *
   * 示例:
   * ---
   * name: lite-plan
   * description: "Lightweight planning workflow"
   * allowed-tools: Read, Write, Bash
   * ---
   */
  parseYamlHeader(content) {
    // 处理 Windows 行结尾 (\r\n)
    const match = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
    if (!match) return null;

    const yamlContent = match[1];
    const result = {};

    try {
      const lines = yamlContent.split(/[\r\n]+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue; // 跳过空行和注释

        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;

        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (!key) continue; // 跳过无效行

        // 去除引号 (单引号或双引号)
        let cleanValue = value.replace(/^["']|["']$/g, '');

        // allowed-tools 字段特殊处理：转为数组
        // 支持格式: "Read, Write, Bash" 或 "Read,Write,Bash"
        if (key === 'allowed-tools') {
          cleanValue = Array.isArray(cleanValue)
            ? cleanValue
            : cleanValue.split(',').map(t => t.trim()).filter(t => t);
        }

        result[key] = cleanValue;
      }
    } catch (error) {
      console.error('YAML parsing error:', error.message);
      return null;
    }

    return result;
  }

  /**
   * 获取单个命令的元数据
   * @param {string} commandName 命令名称 (e.g., "lite-plan" 或 "/workflow:lite-plan")
   * @returns {object|null} 命令信息或 null
   */
  getCommand(commandName) {
    if (!this.commandDir) {
      console.error('ERROR: .claude/commands/workflow 目录未找到');
      return null;
    }

    // 标准化命令名称
    const normalized = commandName.startsWith('/workflow:')
      ? commandName.substring('/workflow:'.length)
      : commandName;

    // 检查缓存
    if (this.cache[normalized]) {
      return this.cache[normalized];
    }

    // 读取命令文件
    const filePath = path.join(this.commandDir, `${normalized}.md`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const header = this.parseYamlHeader(content);

      if (header && header.name) {
        const result = {
          name: header.name,
          command: `/workflow:${header.name}`,
          description: header.description || '',
          argumentHint: header['argument-hint'] || '',
          allowedTools: Array.isArray(header['allowed-tools'])
            ? header['allowed-tools']
            : (header['allowed-tools'] ? [header['allowed-tools']] : []),
          filePath: filePath
        };

        // 缓存结果
        this.cache[normalized] = result;
        return result;
      }
    } catch (error) {
      console.error(`读取命令失败 ${filePath}:`, error.message);
    }

    return null;
  }

  /**
   * 批量获取多个命令的元数据
   * @param {array} commandNames 命令名称数组
   * @returns {object} 命令信息映射
   */
  getCommands(commandNames) {
    const result = {};

    for (const name of commandNames) {
      const cmd = this.getCommand(name);
      if (cmd) {
        result[cmd.command] = cmd;
      }
    }

    return result;
  }

  /**
   * 获取所有命令的名称和描述
   * @returns {object} 命令名称和描述的映射
   */
  getAllCommandsSummary() {
    const result = {};
    const commandDir = this.commandDir;

    if (!commandDir) {
      return result;
    }

    try {
      const files = fs.readdirSync(commandDir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(commandDir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) continue;

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const header = this.parseYamlHeader(content);

          if (header && header.name) {
            const commandName = `/workflow:${header.name}`;
            result[commandName] = {
              name: header.name,
              description: header.description || ''
            };
          }
        } catch (error) {
          // 跳过读取失败的文件
          continue;
        }
      }
    } catch (error) {
      // 目录读取失败
      return result;
    }

    return result;
  }

  /**
   * 生成注册表 JSON
   */
  toJSON(commands = null) {
    const data = commands || this.cache;
    return JSON.stringify(data, null, 2);
  }
}

// CLI 模式
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--all') {
    // 获取所有命令的名称和描述
    const registry = new CommandRegistry();
    const commands = registry.getAllCommandsSummary();
    console.log(JSON.stringify(commands, null, 2));
    process.exit(0);
  }

  const registry = new CommandRegistry();
  const commands = registry.getCommands(args);

  console.log(JSON.stringify(commands, null, 2));
}

module.exports = CommandRegistry;

