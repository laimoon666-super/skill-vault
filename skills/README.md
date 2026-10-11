这个目录存放 skill 全文。

每个 skill 是 `skills/` 下的一个子文件夹，其中必须包含 SKILL.md：

    skills/
    └── <skill-name>/
        ├── SKILL.md       ← 必需
        ├── references/    ← 可选，供 AI 查阅的参考文档
        └── scripts/       ← 可选，可执行脚本

安装时整个文件夹会被复制到 AI Agent 的 skills 目录（默认 ~/.claude/skills）。

新增 skill 后，记得同步更新仓库根目录的 README.md 目录表格和 skills.json 清单。
