---
name: browser-delegation
description: Drive user's real Chrome browser via Extension Relay Bridge with existing login sessions, cookies, multi-profile credentials, purple tab-group isolation, and clean lifecycle auto-teardown. Use when user asks to operate authenticated websites, download reports, click/fill forms, or automate browser tasks using their existing logged-in accounts.
metadata: {"moltbot":{"emoji":"🤖","requires":{"bins":["python3"]}}}
---

# Browser Delegation (浏览器代操作能力)

通过 **Chrome 扩展原生桥接（Extension Relay Bridge）** 架构，让 AI Agent 代替用户安全、平滑地操作其正在使用的真实 Chrome 浏览器，**100% 复用现有登录态与多账号 Cookie，且零破坏系统加密凭证**。

## 适用场景（When to Use）

- 用户需要 AI 代替其登录、查看、操作企业内部后台或带有登录态的数据平台（如广告后台、统计平台、云控制台）。
- 用户需要下载报表、点击导出、筛选表单、填写复杂数据。
- 严禁要求用户重新登录账号、重新扫码或重启浏览器。

---

## 核心设计铁律（Guardrails）

1. **绝对禁止命令行强起 Chrome 调试端口**：
   - 严禁执行 `chrome.exe --remote-debugging-port=9222`！Chrome 127+ 的 App-Bound Encryption 会把这判定为恶意攻击，**直接拒绝解密 Cookie，导致用户所有账号全部被强制下线！**
2. **专属物理隔离（Tab Groups）**：
   - 所有 AI 代操作必须在专属的**紫色标签组** `[🤖 AI 代操作进行中...]` 中进行，绝不侵入、抢占用户正在使用的日常标签页。
3. **严格的生命周期闭环（Auto Clean-up）**：
   - 操作完成后必须先 `detach` 撤销顶部系统调试白条，再 `close` 彻底销毁标签页，不留任何视觉残留与内存泄漏。

---

## 首次安装（换机器后必做）

本 skill 需要一个 Chrome 扩展作为桥接端，源码已随本 skill 一起入库（`extension/`），恢复时手动加载一次即可：

1. 打开 `chrome://extensions`，右上角开启 **开发者模式**。
2. 点 **加载已解压的扩展程序**，选择本 skill 的 `extension/` 目录。
3. 确认扩展已启用；它会主动连接本机 `ws://127.0.0.1:18999`，等待 AI 侧的服务端拉起。
4. Python 侧依赖：`pip install aiohttp websockets`。

---

## 快速使用方法

### 方式 A：Python 脚本调用（最推荐）

引入内置 SDK `client.py`，使用 `with` 语法糖自动管理生命周期：

```python
import sys
import os

# 先定位本 skill 的安装目录，再把它的 scripts/ 加入 sys.path。
# 默认安装目标见仓库 README：~/.claude/skills、~/.codex/skills、~/.dsh/skills
SKILL_DIR = os.path.expanduser("~/.claude/skills/browser-delegation")
sys.path.append(os.path.join(SKILL_DIR, "scripts"))

from client import BrowserDelegation

browser = BrowserDelegation()

# 1. 检查状态 (如果服务未启动会自动在后台唤醒)
status = browser.status()
print("桥接状态:", status)

# 2. 在专属紫色标签组中打开页面并代操作 (退出 with 时自动 detach 并销毁标签页)
with browser.open_tab("https://example.com/admin", group_name="🤖 AI 数据下载中...") as tab:
    print("页面标题:", tab.get_title())
    
    # 填写 React/Vue 受控表单 (自动穿透原型 Setter)
    tab.fill('input[placeholder="搜索"]', "核心关键词")
    
    # 点击按钮
    tab.click('button.submit-btn')
    
    # 执行原生 JS 或 CDP 操作
    tab.evaluate("console.log('Done')")
    
    # 截取快照
    tab.screenshot("report_preview.png")

# 标签页已自动关闭，调试白条已自动撤销，环境彻底恢复！
```

### 方式 B：CLI 命令行快速调用

```bash
cd ~/.claude/skills/browser-delegation/scripts   # 换成你的实际安装目录

# 检查连接状态
python cli.py status

# 打开并测试
python cli.py open "https://example.com"
```

---

## 架构组件

- `scripts/server.py`：本地双模通信服务端（WebSocket 18999 连插件 + HTTP RPC 18998 接 AI）。
- `scripts/client.py`：开箱即用的高阶面向对象 Python 控制库，支持自动自愈拉起服务。
- `extension/`：持久化存放的 Chrome 扩展源码（Manifest V3，包含权限与保活机制）。
