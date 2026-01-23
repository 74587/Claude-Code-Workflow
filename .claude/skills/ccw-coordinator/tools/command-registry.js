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
   * 解析 YAML 头
   */
  parseYamlHeader(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const yamlContent = match[1];
    const result = {};

    const lines = yamlContent.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      let cleanValue = value.replace(/^["']|["']$/g, '');

      if (key === 'allowed-tools') {
        cleanValue = cleanValue.split(',').map(t => t.trim());
      }

      result[key] = cleanValue;
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

  if (args.length === 0) {
    console.error('用法: node command-registry.js <command-name> [command-name2] ...');
    console.error('示例: node command-registry.js lite-plan lite-execute');
    console.error('      node command-registry.js /workflow:lite-plan');
    process.exit(1);
  }

  const registry = new CommandRegistry();
  const commands = registry.getCommands(args);

  console.log(JSON.stringify(commands, null, 2));
}

module.exports = CommandRegistry;

