# Skill Vault

个人 AI 技能仓库 —— 存放我常用的 **Skill** 与 **插件清单**。

目的很简单：**换电脑、换 AI Agent 之后，一条命令把能力全部还原回来。**

---

## 🤖 如果你是 AI Agent，请先读这一段

你正在读取一个个人技能库。用户希望你把这里的 skill 安装到当前环境。

**第 1 步：搞清楚有哪些 skill**

读 [`skills.json`](./skills.json)，它是机器可读清单，每个条目包含：

| 字段 | 含义 |
|---|---|
| `name` | skill 名称，也是目录名 |
| `path` | 在本仓库中的相对路径 |
| `description` | 这个 skill 干什么用的、什么时候该用 |
| `env` | 需要用户提前设置的环境变量（没有则为空数组） |
| `requires` | 依赖的外部命令或运行时（没有则为空数组） |

**第 2 步：安装**

```powershell
git clone https://github.com/laimoon666-super/skill-vault.git
cd skill-vault
.\install.ps1              # Windows
```

```bash
./install.sh               # macOS / Linux
```

脚本会把 `skills/` 下的每个文件夹复制到本机 AI Agent 的 skills 目录（默认 `~/.claude/skills`）。
如果你的 Agent 用别的目录，加参数指定：

```powershell
.\install.ps1 -Target "$HOME\.codex\skills"
```

**第 3 步：处理环境变量**

安装完成后，检查 `skills.json` 里各条目的 `env` 字段。若不为空，提示用户配置对应的环境变量，不要尝试猜测或硬编码密钥。

> ⚠️ **本仓库是公开的，绝不包含任何 API Key / Token / 密码。**
> 所有密钥一律通过环境变量注入。如果你在仓库里发现了疑似密钥，请立即告知用户。

---

## 📦 快速开始（人类视角）

### 还原到新电脑

```powershell
git clone https://github.com/laimoon666-super/skill-vault.git
cd skill-vault
.\install.ps1
```

### 升级已有安装

```powershell
cd skill-vault
git pull
.\install.ps1 -Force      # -Force 才会覆盖已存在的同名 skill
```

不加 `-Force` 时，脚本会跳过已存在的 skill 并提示，不会动你本地改过的版本。

### 预览会做什么（不实际写入）

```powershell
.\install.ps1 -DryRun
```

---

## 📚 Skill 目录

> 这一节随新增 skill 同步更新。当前为空 —— 等你点名。

| Skill | 用途 | 需要密钥 | 含脚本 |
|:---|:---|:---:|:---:|
| _（暂无）_ | | | |

---

## 🔌 插件清单

第三方插件（如 Figma、GitHub 官方插件）**不备份文件**，只记录名称与来源，需要时照着重装。
详见 [`plugins/installed.md`](./plugins/installed.md)。

理由：这些插件从官方商店下载，随时可重装；单个插件动辄 1.5 MB 且带图标资源，入库没有价值。

---

## 📁 目录结构

```
skill-vault/
├── README.md              ← 你正在看的文件
├── skills.json            ← 机器可读清单（AI Agent 读这个）
├── install.ps1            ← Windows 一键安装
├── install.sh             ← macOS / Linux 一键安装
├── plugins/
│   └── installed.md       ← 插件清单（仅名称与来源，无二进制）
└── skills/                ← skill 全文存放处
    └── <skill-name>/
        ├── SKILL.md       ← 必需：告诉 AI 这个 skill 是什么、何时用
        ├── references/    ← 可选：供 AI 查阅的参考文档
        └── scripts/       ← 可选：可执行脚本
```

---

## ➕ 如何新增一个 skill

1. 把 skill 文件夹整个复制到 `skills/` 下
2. 在 `README.md` 的 **Skill 目录** 表格里加一行
3. 在 `skills.json` 的 `skills` 数组里加一个条目
4. 提交：

```powershell
git add .
git commit -m "add: <skill-name>"
git push
```

**入库前自检：**

- [ ] 文件夹里有 `SKILL.md`
- [ ] 没有任何硬编码的 API Key / Token / 密码
- [ ] 没有 `node_modules`、`__pycache__`、构建产物等可再生成的文件
- [ ] 单个文件不超过 5 MB

---

## 📄 License

个人技能收藏，供自己跨设备同步使用。第三方来源的 skill 版权归原作者所有。
