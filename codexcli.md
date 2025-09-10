codex exec "..."	非交互式“自动化模式”	codex exec "explain utils.ts"

codex --full-auto "create the fanciest todo-list app"

用于文件搜索@
键入会触发对工作区根目录的模糊文件名搜索。使用向上/向下在结果中进行选择，并使用 Tab 键或 Enter 键将 替换为所选路径。您可以使用 Esc 取消搜索。@@

--cd/-C flag
Sometimes it is not convenient to to the directory you want Codex to use as the "working root" before running Codex. Fortunately, supports a option so you can specify whatever folder you want. You can confirm that Codex is honoring by double-checking the workdir it reports in the TUI at the start of a new session.cdcodex--cd--cd