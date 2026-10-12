---
name: cleaner-iaa-funnel-analysis
description: Standard operating procedure (SOP) for Cleaner IAA (In-App Ad) daily funnel data analysis. Ingests raw data documents (CSV, Excel, screenshots, pasted tables), filters regions (UV > 50, non-US unless specified), constructs standardized 4-phase funnel (Permissions, Splash Ad & Onboarding Clean, Homepage & Tools, Widgets/Floatball), and outputs actionable operational insights with strict conversion sequencing.
---

# 清理工具 IAA 模式日常漏斗分析技能 (Cleaner IAA Funnel Analysis SOP)

## 📖 技能定位与核心原则
本 Skill 专门规范清理优化类移动端产品（以 Google Play / 第三方应用商店出海 IAA 广告变现模式为主，如 44358 系列渠道）的日常数据漏斗分析流程。
实现从 **“放入原始数据文档/表格/截图” -> “自动清洗过滤” -> “建立四大链路标准漏斗” -> “严格顺序指标计算” -> “智能归因与业务决策”** 的标准化闭环。

---

### 🚨 输出模式与业务铁律 (Core Business Rules)

1. **大盘基准分母 (Base UV)**：
   * 漏斗起点基准分母统一采用权限引导曝光：`float_guide_show`（或未上权限引导时的应用启动 `app_open`）。

2. **指标计算与展示顺序严格铁律 (Strict Step-Before-Global Sequence)**：
   * **绝对规则**：前置步骤点击率 $\rightarrow$ 步骤授权成功率 $\rightarrow$ 全局最终授权率 $\rightarrow$ 后续流转率。**完成必须在授权后面，授权必须在点击后面**！
   * **悬浮窗权限顺序**：
     1. 悬浮窗开启点击率 (`float_guide_click / Base UV`)
     2. 悬浮窗点击后授权成功率 (`s_permission_granted_float / float_guide_click`)
     3. 悬浮窗最终授权率 (全局) (`s_permission_granted_float / Base UV`)
     4. 悬浮窗跳过/流转率 (`float_guide_pass / Base UV`)
   * **开屏与广告顺序**：
     1. 开屏与广告播完率 (占启动) (`open_and_splash_loaded / app_open`)
     2. 开屏展示渗透率 (全局) (`open_and_splash_loaded / Base UV`)
   * **主页到达顺序**：
     1. 主页展示渗透率 (占启动) (`s_homepage / app_open`)
     2. 主页展示渗透率 (全局) (`s_homepage / Base UV`)

3. **分地区下钻过滤门槛 (Regional Noise Filter)**：
   * 当原始数据具备地区/国家（`country` / `region`）维度时：
     * **样本量阈值**：**用户 Base UV > 50** 的国家/地区才进行下钻分析与表格展示，剔除低于 50 人的长尾噪声地区。
     * **默认非美下钻**：日常默认聚焦非美国地区（India, Philippines, Korea, Japan, Norway, Malaysia 等），除非用户明确指示“全地区”、“对比美国”或“查看美国”。

4. **排版格式规范**：
   * 采用适合直接复制发送**飞书 / 钉钉 / 微信**的高密度 Markdown 表格排版，拒绝空行堆叠与碎片化单行输出。

---

## 🔄 标准执行流 (Standard Execution Workflow)

```
[Step 1] 接收原始数据输入 (Excel / CSV / 剪贴板文本 / 看板截图)
   ├── 识别维度：dt (日期), channel (渠道), country (国家), event_name, uv, pv
   └── 区域过滤：若存在国家维度，筛选 UV > 50 且非 US 地区（除非要求大盘总计）
           ↓
[Step 2] 映射四大阶段全链路标准漏斗 (Four-Phase Funnel)
   ├── 阶段 1：冷启权限引导链 (float_guide_show -> local_notify_pop -> float_guide_click -> s_permission_granted_float -> float_guide_pass)
   ├── 阶段 2：开屏广告与首清冷启链 (app_open -> rcv_ad_shown -> open_and_splash_loaded -> device_scan -> clean_result_show)
   ├── 阶段 3：主页到达与核心交互健康链 (s_homepage -> c_homepage -> c_function -> junk_scan -> junk_result_show)
   └── 阶段 4：常驻桌面与留存护城河 (home_card_show -> home_card_add -> floatball_panel -> more_feature)
           ↓
[Step 3] 严格顺序计算核心指标
   ├── 权限授权率 (点击率 -> 点击后成功率 -> 全局最终率)
   ├── 开屏广告渗透 (占启动播完率 -> 全局大盘渗透率)
   └── 主页进端渗透 (占启动渗透率 -> 全局大盘渗透率)
           ↓
[Step 4] 异常红黄线诊断与运营决策建议 (输出标准报告)
```

---

## 🛠️ 自动化解析脚本工具 (Built-in Script)

Skill 内置了 Python 自动化数据漏斗解析工具：[`analyzer.py`](./scripts/analyzer.py)

可以直接对原始 Excel / CSV 运行快速输出（示例用默认安装目标 `~/.claude/skills`，换成你的实际目录即可）：
* **全量大盘总汇总**：
  ```bash
  python ~/.claude/skills/cleaner-iaa-funnel-analysis/scripts/analyzer.py <文件路径.xlsx>
  ```
* **非美核心地区对比 (Base UV > 50)**：
  ```bash
  python ~/.claude/skills/cleaner-iaa-funnel-analysis/scripts/analyzer.py <文件路径.xlsx> --regions --min_uv 50
  ```

---

## 📐 全链路标准漏斗事件字典 (Event Dictionary)

| 阶段 | 标准事件标识 | 核心业务含义 | 漏斗角色 / 计算关系 |
| :--- | :--- | :--- | :--- |
| **阶段 1：冷启权限** | `float_guide_show` | 悬浮窗/应用权限引导展示 | **全量大盘分母基准 (Base UV)** |
| | `local_notify_pop` | 本地通知权限引导弹窗 | 通知权限前置触达 |
| | `notify_perm_granted_splash` | 开屏通知权限已授权 | 系统通知权限成功 |
| | `float_guide_click` | 点击悬浮窗开启按钮 | 索权点击强意向 |
| | `s_permission_granted_float` | **悬浮窗权限授权成功** | **核心权限获取 (关乎常驻保活与触达)** |
| | `float_guide_pass` | 悬浮窗引导通过/跳过 | 权限向后流转 |
| **阶段 2：开屏与首清** | `app_open` | 应用正式启动 | 核心流转基准 |
| | `open_loaded` | 启动加载完成 | 启动成功率衡量 |
| | `rcv_ad_request_first` | 首次开屏广告请求 | 广告变现首触达 |
| | `rcv_ad_shown` | 开屏广告真实曝光 | 广告展示收益点 |
| | `open_and_splash_loaded` | **开屏与广告加载播放完毕** | **冷启商业化完成点** |
| | `device_scan_start` | 设备垃圾预检开始 | 首清引导体验开始 |
| | `device_scan_finish` | 设备预检完成 | 垃圾结果产生 |
| | `device_result_show` | 扫描结果展示 | 呈现可清理垃圾体积 |
| | `skip_new_button_show` | 跳过首清按钮曝光 | 跳过流失点 |
| | `skip_new_button_click` | 跳过首清按钮点击 | 用户跳过首清直接进端 |
| | `clean_button_click` | 点击立即清理按钮 | 用户主动清理意向 |
| | `clean_process_start` | 清理动效开始 | 核心体验进行中 |
| | `clean_process_finish` | 清理动效结束 | 清理操作完成 |
| | `clean_result_show` | **清理完成结果页展示** | **首清闭环点 (首清插屏广告曝光点)** |
| **阶段 3：主页与核心功能** | `s_homepage` | **主界面/首页曝光展示** | **端内留存生命线 (进端率核心指标)** |
| | `c_homepage` | 主界面元素交互点击 | 首页活跃互动 |
| | `c_function` | 点击端内具体子功能 (如省电/降温/加速) | 子功能意向 |
| | `c_function_finished` | 子功能执行完毕 | 子功能闭环 |
| | `junk_scan_start` | 深度垃圾扫描开始 | 端内常规清理开始 |
| | `junk_scan_finish` | 深度垃圾扫描完成 | 深度垃圾结果出炉 |
| | `junk_result_show` | 深度垃圾扫描结果展示 | 深度垃圾清理插屏展示点 |
| **阶段 4：常驻与护城河** | `home_card_show` | 桌面卡片/Widget 引导展示 | 桌面渗透引导 |
| | `home_card_add` | 成功添加桌面卡片 | 桌面常驻留存护城河 |
| | `floatball_guide_show` | 桌面悬浮球引导展示 | 悬浮球触达 |
| | `floatball_panel_show` | 悬浮球面板展开展示 | 悬浮球深度使用 |
| | `floatball_panel_click` | 悬浮球面板功能点击 | 悬浮球带来回流与广告曝光 |
| | `more_feature_guide_show` | 更多功能引导展示 | 工具矩阵扩展触达 |
| | `more_feature_guide_click`| 更多功能引导点击 | 工具矩阵扩展转化 |

---

## 🧮 严格顺序计算公式汇总 (Strict Calculation Formulas)

### 1. 权限引导链指标
* **悬浮窗开启点击率**：
  $$\text{悬浮窗开启点击率} = \frac{\text{float\_guide\_click UV}}{\text{Base UV (float\_guide\_show)}} \times 100\%$$
* **悬浮窗点击后授权成功率**：
  $$\text{悬浮窗点击后授权成功率} = \frac{\text{s\_permission\_granted\_float UV}}{\text{float\_guide\_click UV}} \times 100\%$$
* **悬浮窗最终授权率 (全局)**：
  $$\text{悬浮窗最终授权率 (全局)} = \frac{\text{s\_permission\_granted\_float UV}}{\text{Base UV}} \times 100\%$$
* **悬浮窗通过/跳过率**：
  $$\text{悬浮窗通过率} = \frac{\text{float\_guide\_pass UV}}{\text{Base UV}} \times 100\%$$

### 2. 开屏广告与首清链路指标
* **开屏与广告播完率 (占启动)**：
  $$\text{开屏与广告播完率 (占启动)} = \frac{\text{open\_and\_splash\_loaded UV}}{\text{app\_open UV}} \times 100\%$$
* **开屏展示渗透率 (全局)**：
  $$\text{开屏展示渗透率 (全局)} = \frac{\text{open\_and\_splash\_loaded UV}}{\text{Base UV}} \times 100\%$$
* **首清触发率 (占开屏完播)**：
  $$\text{首清触发率} = \frac{\text{device\_scan\_start UV}}{\text{open\_and\_splash\_loaded UV}} \times 100\%$$
* **首清清理点击率 (占结果展示)**：
  $$\text{首清清理点击率} = \frac{\text{clean\_button_click UV}}{\text{device\_result\_show UV}} \times 100\%$$
* **首清完成率 (占大盘 Base)**：
  $$\text{首清完成大盘率} = \frac{\text{clean\_result\_show UV}}{\text{Base UV}} \times 100\%$$

### 3. 主页到达与核心交互指标
* **主页展示渗透率 (占启动)**：
  $$\text{主页展示渗透率 (占启动)} = \frac{\text{s\_homepage UV}}{\text{app\_open UV}} \times 100\%$$
* **主页展示渗透率 (全局)**：
  $$\text{主页展示渗透率 (全局)} = \frac{\text{s\_homepage UV}}{\text{Base UV}} \times 100\%$$
* **端内常规清理渗透率 (全局)**：
  $$\text{深度清理渗透率} = \frac{\text{junk\_result\_show UV}}{\text{Base UV}} \times 100\%$$

---

## 🚨 异常检测与报警规则 (Diagnosis & Alert Rules)

| 异常现象 | 触发判定阈值 | 潜在根因与排查建议 |
| :--- | :--- | :--- |
| **悬浮窗点击塌陷 🚨** | `float_guide_click / Base < 50%` | 引导页文案或 UI 缺乏吸引力，用户感知不到开启悬浮球/权限的价值，需优化文案与交互动效。 |
| **系统授权严重受阻 🚨** | `s_permission_granted_float / click < 35%` | **P0 阻断风险**！跳转系统设置页后，用户找不到授权开关，或 Android 高版本权限拦截严重，需排查引导图示与系统适配。 |
| **开屏广告加载超时/卡死 🚨** | `open_and_splash_loaded / app_open < 75%` | 开屏广告请求超时设置过长，或无填充导致启动黑屏/白屏，需优化广告 Waterfall 与底价策略。 |
| **首清进端严重流失 ⚠️** | `s_homepage / app_open < 45%` | 首清流程过长（预检+清理+插屏广告耗时过长），用户在到达主页前流失，建议缩短扫描动效或提供更明确的跳过。 |
| **桌面卡片转化亮眼 🏆** | `home_card_add / home_card_show > 30%` | 用户对常驻桌面有强需求，可加大桌面卡片曝光权重以稳固 D1/D7 留存。 |

---

## 📝 交付输出标准模板 (Delivery Templates)

### 模板 1：大盘总汇总全链路漏斗分析（适合直接复制到飞书/钉钉）

```markdown
### 📊 [产品名称/渠道] [日期区间] 数据漏斗全景分析报告

**【核心大盘速览】**
* **大盘基准 (Base UV)**：[X] UV（权限引导曝光 `float_guide_show`）
* **悬浮窗权限授权**：开启点击率 **[X]%** ｜ 点击后成功率 **[X]%** ｜ 全局最终授权率 **[X]%**
* **开屏广告完播**：占启动完播率 **[X]%** ｜ 全局大盘渗透率 **[X]%**
* **主页最终进端**：占启动进端率 **[X]%** ｜ 全局主页到达率 **[X]%**
* **首清完成闭环**：[X] UV 完成首清并触达结果页（全局渗透率 [X]%）

#### 一、 四大核心阶段全链路数据漏斗表
| 漏斗阶段 | 关键事件名称 | 原始数据 (UV / PV) | 阶段转化率 / 步骤转化 | 大盘渗透率 (vs Base) | 关键业务诊断 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **1. 权限引导** | float_guide_show | [X] / [Y] | 100.0% | 100.0% | 大盘基准分母 |
| | local_notify_pop | [X] / [Y] | [X]% | [X]% | 通知引导触达 |
| | notify_perm_granted_splash| [X] / [Y] | [X]% | [X]% | 通知授权成功 |
| | float_guide_click | [X] / [Y] | [X]% (开启点击率) | [X]% | 索权点击强意向 |
| | s_permission_granted_float| [X] / [Y] | [X]% (点击后成功率) | [X]% (最终授权率) | 核心常驻权限达成 |
| | float_guide_pass | [X] / [Y] | [X]% | [X]% | 引导通过流转 |
| **2. 开屏与首清**| app_open | [X] / [Y] | [X]% | [X]% | 正式启动流转 |
| | rcv_ad_shown | [X] / [Y] | [X]% | [X]% | 开屏广告真实展示 |
| | open_and_splash_loaded | [X] / [Y] | [X]% (占启动) | [X]% (全局) | 开屏与广告播放完成 |
| | device_scan_start | [X] / [Y] | [X]% | [X]% | 首清垃圾预检开始 |
| | device_result_show | [X] / [Y] | [X]% | [X]% | 首清垃圾结果曝光 |
| | clean_button_click | [X] / [Y] | [X]% (展点率) | [X]% | 首清点击清理意向 |
| | clean_result_show | [X] / [Y] | [X]% | [X]% | 首清完整闭环 (插屏曝光) |
| **3. 主页与功能**| s_homepage | [X] / [Y] | [X]% (占启动) | [X]% (全局) | 进端核心生命线 |
| | c_homepage | [X] / [Y] | [X]% | [X]% | 主页功能交互活跃 |
| | c_function_finished | [X] / [Y] | [X]% | [X]% | 常用功能闭环完成 |
| | junk_result_show | [X] / [Y] | [X]% | [X]% | 深度清理二次完成 |
| **4. 桌面护城河**| home_card_show | [X] / [Y] | [X]% | [X]% | 桌面 Widget 触达 |
| | home_card_add | [X] / [Y] | [X]% (添加转化率) | [X]% | 桌面常驻护城河达成 |
| | floatball_panel_show | [X] / [Y] | [X]% | [X]% | 悬浮球面板深度活跃 |

#### 二、 核心业务洞察与问题归因
1. **权限链路瓶颈分析**：...
2. **商业化与首清流转损耗**：...
3. **主页到达与高价值留存建议**：...
```

---

### 模板 2：非美分地区（Base UV > 50）横向对比深度复盘

```markdown
### 📊 [产品名称] 非美国核心地区横向对比复盘 (过滤 Base UV > 50)

**【核心结论】**
* 优质地区：**[地区A]** 悬浮窗授权率高达 **[X]%**，主页进端率 **[X]%**，综合表现最佳；
* 异常洼地：**[地区B]** 存在 [开屏广告加载低/权限授权断层]，需针对性优化。

#### 一、 重点非美地区核心转化率指标对比表
*(严格顺序：悬浮窗开启点击率 -> 点击后授权成功率 -> 悬浮窗最终授权率 -> 开屏占启动完播 -> 开屏全局渗透 -> 主页占启动渗透 -> 主页全局渗透)*

| 地区/国家 | Base UV (引导曝光) | 悬浮窗开启点击率 | 悬浮窗点击后授权成功率 | 悬浮窗最终授权率 (全局) | 开屏与广告播完率 (占启动) | 开屏展示渗透率 (全局) | 主页展示渗透率 (占启动) | 主页展示渗透率 (全局) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **[地区 1]** | [X] | [X]% | [X]% | [X]% | [X]% | [X]% | [X]% | [X]% |
| **[地区 2]** | [X] | [X]% | [X]% | [X]% | [X]% | [X]% | [X]% | [X]% |
| **[地区 3]** | [X] | [X]% | [X]% | [X]% | [X]% | [X]% | [X]% | [X]% |

#### 二、 地区差异深度归因与本地化策略
1. **机型与系统底层差异**：...
2. **广告网络与填充率差异**：...
3. **针对性优化方案**：...
```
