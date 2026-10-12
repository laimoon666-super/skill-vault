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

> ⚠️ **不同 Agent 读的目录不一样，装错地方 skill 不生效，而且不会有任何报错。**
> 按你用的 Agent 选目标目录：

| Agent | 目标目录 | 命令 |
|:---|:---|:---|
| **DSH** | `~/.agents/skills` | `.\install.ps1 -Target "$HOME\.agents\skills"` |
| Claude Code | `~/.claude/skills`（脚本默认值） | `.\install.ps1` |
| Codex | `~/.codex/skills` | `.\install.ps1 -Target "$HOME\.codex\skills"` |
| Gemini CLI | `~/.gemini/config/skills` | `.\install.ps1 -Target "$HOME\.gemini\config\skills"` |

macOS / Linux 对应 `./install.sh -t <目录>`。机器可读的完整对照见 [`skills.json`](./skills.json) 的 `defaultInstallTargets`。

**第 3 步：处理环境变量与 Python 依赖**

安装完成后，检查 `skills.json` 里各条目的两个字段：

- `env` 不为空 → 提示用户配置对应的环境变量，**不要尝试猜测或硬编码密钥**。
- `pythonDependencies` 不为空 → 这些 skill 缺包会直接报错。让用户执行 `pip install <包名>`，或直接跑 `.\install.ps1 -InstallDeps` 自动装。

安装脚本结尾会列出所需的依赖（`-DryRun` 预览时也会列）。

> ⚠️ **本仓库是公开的，绝不包含任何 API Key / Token / 密码。**
> 所有密钥一律通过环境变量注入。如果你在仓库里发现了疑似密钥，请立即告知用户。

---

## 📦 快速开始（人类视角）

### 还原到新电脑

```powershell
git clone https://github.com/laimoon666-super/skill-vault.git
cd skill-vault
.\install.ps1 -Target "$HOME\.agents\skills" -InstallDeps
```

> `-Target` 按你用的 Agent 选（见上方对照表）。DSH 是 `~/.agents/skills`；**直接用默认的 `~/.claude/skills` 装，DSH 读不到，而且不报错。**
> `-InstallDeps` 会顺带把各 skill 的 Python 依赖装上，可省略。

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

> 这一节随新增 skill 同步更新。

| Skill | 用途 | 需要密钥 | 含脚本 |
|:---|:---|:---:|:---:|
| [`pdf-iap-funnel-analysis`](./skills/pdf-iap-funnel-analysis/SKILL.md) | PDF IAP 订阅产品的日常全链路漏斗分析 SOP：吃进 CSV / Excel / 截图数据，按「启动品宣 → 商业化订阅 → 系统权限 → 端内功能留存」四阶段建标准漏斗，输出归因结论与异常预警。默认给全量总汇总（高信息密度，可直接发飞书 / 钉钉 / 微信）；明确点名「用户分组 / AB 测试」时才下钻组间横向对比 | 否 | ✅ `scripts/funnel_analyzer.py` |
| [`browser-delegation`](./skills/browser-delegation/SKILL.md) | 让 AI 直接操作你**正在用的那个真实 Chrome**：走扩展桥接，100% 复用现有登录态与多账号 Cookie，不用重新登录、不用重启浏览器。在专属紫色标签组里代操作，用完自动销毁标签页、撤销调试白条。换机器后需手动加载一次 `extension/` | 否 | ✅ `scripts/`（`client.py` SDK + `server.py` 桥接服务）<br>🧩 `extension/` Chrome 扩展源码 |
| [`cleaner-iaa-funnel-analysis`](./skills/cleaner-iaa-funnel-analysis/SKILL.md) | 清理 / 优化类工具 App 的 **IAA 广告变现**日常漏斗分析 SOP：把原始数据文档（Excel / CSV / 截图 / 剪贴板表格）丢进目录就能跑。四大链路标准漏斗（冷启权限 → 开屏广告与首清 → 主页到达与核心交互 → 常驻桌面留存），指标强制按「点击率 → 步骤授权成功率 → 全局授权率 → 后续流转率」顺序呈现；含地区下钻噪声门槛（Base UV > 50、默认非美） | 否 | ✅ `scripts/analyzer.py` |

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
