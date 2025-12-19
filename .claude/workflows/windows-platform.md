# Windows Platform Guidelines

## Path Format Guidelines

### MCP Tools
- Use double backslash: `D:\\path\\file.txt`
- Example: `read_file(paths="D:\\Claude_dms3\\src\\index.ts")`

### Bash Commands
- Use forward slash: `D:/path/file.txt` or `/d/path/file.txt`
- Example: `cd D:/Claude_dms3/src`

### Relative Paths
- Universal format works in both MCP and Bash contexts
- Example: `./src/index.ts` or `../shared/utils.ts`

