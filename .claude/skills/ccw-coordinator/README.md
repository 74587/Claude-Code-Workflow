# CCW Coordinator

交互式命令编排工具

## 使用

```
/ccw-coordinator
或
/coordinator
```

## 流程

1. 用户描述任务
2. Claude推荐命令链
3. 用户确认或调整
4. 执行命令链
5. 生成报告

## 示例

**Bug修复**
```
任务: 修复登录bug
推荐: lite-fix → test-cycle-execute
```

**新功能**
```
任务: 实现注册功能
推荐: plan → execute → test-cycle-execute
```

## 文件说明

| 文件 | 用途 |
|------|------|
| SKILL.md | Skill入口 |
| phases/orchestrator.md | 编排逻辑 |
| phases/state-schema.md | 状态定义 |
| phases/actions/*.md | 动作实现 |
| specs/chain-registry.json | 命令元数据 |
| specs/chain-validation-rules.md | 验证规则 |
| tools/chain-validate.js | 验证工具 |
