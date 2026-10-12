# token-stats

> 🖥️ **DSH 专属插件 —— 仅适用于 DeepSeek Harness (DSH)**
>
> 本插件依赖 DSH 独有的两套机制，**不能用于 Claude Code / Codex / Gemini CLI 等其他 Agent**：
>
> - **宿主侧**：DSH host 插件 API —— `ctx.inject(['sessionQuery', 'sessionPersistence', 'llm', 'webServer'])`
> - **客户端侧**：DSH 的 bundle patch 机制 —— `package.json` 里的 `dsh.bundle.patch` 与 `dsh.client`

DSH 桌面端 GUI 的 **Token 用量统计面板**。

侧边栏「插件」分组下的入口名为 `token-stats`（柱状图图标），点开即是统计主面板。

---

## 功能

- 从本机**全部会话日志**里折叠出按 provider / model 维度的 token 消耗
- 提供 **今日 / 近 7 天 / 近 30 天 / 自定义区间** 快捷筛选；时间过滤在浏览器侧完成，切换是瞬时的
- 附带按会话（session）维度的明细拆解；会话标题从同一遍日志里折叠，不额外读盘
- 宿主侧按持久化**版本号（revision）**缓存每个会话的折叠结果：首次请求付一次全量扫描，之后只重读新增或已变更的日志；`?force=1` 可绕过缓存强制重算

---

## 文件构成

| 文件 | 半边 | 作用 |
|:---|:---|:---|
| `index.js` | 宿主（host） | 扫描会话日志、按 revision 缓存、暴露 `GET /api/token-stats/stats` |
| `client.js` | 浏览器（client） | 注册 `token-stats` 主面板与侧边栏入口 |
| `cordis.patch.yml` | bundle 层 | 向 profile 插入插件行（`id: token-stats`） |
| `package.json` | 清单 | 声明 `dsh.bundle.patch` 与 `dsh.client.platform = "web"` |

---

## 依赖与构建

**没有 npm 依赖，也不需要构建步骤。**

- `index.js` 零 `import`，所有能力由 DSH 宿主注入
- `client.js` 是手写的 lazy-CJS bundle（`window.__ModuleLoader__.load`），React 由 DSH 客户端的模块加载器按需 `require` 提供，不需要打包

---

## 换电脑怎么装回来

本插件是**以本地链接（junction / `link:`）方式挂载进 DSH profile 的**，没有发布到 npm，
所以换机器时包管理器拉不到，必须手动恢复。三步：

**第 1 步**：把 `plugins/token-stats/` 整个复制到新机器上任意目录，记作 `<插件源码目录>`。

**第 2 步**：编辑桌面端 profile 的 `package.json`（默认路径 `~/.dsh/profiles/desktop/package.json`），加两处：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "...保留原有条目...",
        "@local/dsh-token-stats"
      ]
    }
  },
  "dependencies": {
    "...保留原有条目...",
    "@local/dsh-token-stats": "link:<插件源码目录>"
  }
}
```

**第 3 步**：在 profile 目录执行 `pnpm install`（或直接用 DSH 的插件管理界面添加本地插件），然后重启 DSH。

> ⚠️ `link:` 后面必须是**绝对路径**。换盘符或换目录时，这里是唯一需要改的地方。
>
> ⚠️ 装好后 `~/.dsh/profiles/desktop/node_modules/@local/dsh-token-stats` 是一个指向源码目录的 **Junction**，
> 也就是说**源码目录不能删也不能移** —— 删了插件立刻失效。这也是它必须入库备份的原因。

---

## 版本

`1.0.0`
