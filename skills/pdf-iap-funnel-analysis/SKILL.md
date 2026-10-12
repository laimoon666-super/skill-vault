---
name: pdf-iap-funnel-analysis
description: Standard operating procedure (SOP) for PDF IAP daily funnel data analysis. Ingests raw data documents (CSV, Excel, screenshots), constructs standardized full-lifecycle event funnels, and outputs actionable insights. Defaults to compact, high-density total aggregate funnel; drills down into AB testing / user configuration groups only when explicitly requested.
---

# PDF IAP 模式日常漏斗分析技能 (PDF IAP Funnel Analysis SOP)

## 📖 技能定位与核心原则
本 Skill 专门规范 PDF 工具类移动端产品（以 Google Play / App Store 出海 IAP 订阅模式为主）的日常数据漏斗分析流程。
实现从 **“拿到数据文档” -> “建立全链路标准漏斗” -> “智能归因与业务决策”** 的标准化闭环。

### 🚨 输出模式核心铁律 (Interaction Rule)
1. **默认模式（用户未强求分组）**：
   * **必须默认输出【全量用户总汇总数据漏斗】**；
   * 采用适合直接复制发送**飞书 / 钉钉 / 微信**的高信息密度排版（拒绝冗长空行与碎片分段）；
   * 提炼核心结论：大盘规模、试用付费率、首页到达率、核心编辑保存深度。
2. **分组下钻模式（用户明确强调“用户分组 / AB测试 / 用户配置”）**：
   * 展开横向对比视图（如 A组 vs B组、默认配置 vs 实验配置）；
   * 重点剖析组间三大核心剪刀差：**商业化变现（付费率/CVR）**、**流失阻碍（首页到达率）**、**功能活跃（编辑与阅读深度）**；
   * 给出清晰的实验胜出结论与产品推全决策建议。

---

## 🔄 标准执行流 (Standard Execution Workflow)

```
[Step 1] 拿到数据文档 (CSV / Excel / 截图 / 看板)
   ├── 识别维度：dt (日期), ab_group / pid (分组/版本), event_name, uv, pv
   └── 清洗过滤：剔除全为 1 的内部测试包/测试设备 (如 44642000 测试残留)
           ↓
[Step 2] 建立标准化数据漏斗 (Four-Stage Funnel Architecture)
   ├── 阶段 1：冷启动与品宣心智链 (logo_start -> logo_next -> page_brand_1..3)
   ├── 阶段 2：商业化与付费转化链 (paypage_freeopen -> paypage_show -> click -> succ / payback)
   ├── 阶段 3：权限引导转化链 (sys_pop_show -> sys_pop_agree / deny -> sys_agree)
   └── 阶段 4：端内核心功能与留存链 (home_show -> file_show -> PDF_view -> edit -> done -> save)
           ↓
[Step 3] 校验用户诉求与输出分流
   ├── 【无特殊分组要求】 -> 输出《大盘总汇总全链路漏斗分析报告》
   └── 【强调分组/AB组】  -> 输出《AB组/多配置横向对比深度复盘报告》
           ↓
[Step 4] 异常阈值智能诊断与预警 (触发 Bug/断流红黄线检测)
```

---

## 📐 全链路标准漏斗事件字典与计算口径

### 1. 标准事件映射与业务含义

| 阶段 | 标准事件标识 | 核心业务含义 | 说明 / 漏斗位置 |
| :--- | :--- | :--- | :--- |
| **阶段 1：启动品宣** | `logo_start` | 应用冷启动 | **全量大盘分母基准 (Base UV)** |
| | `logo_show` | 启动页曝光展示 | 启动首屏展示 |
| | `logo_next` | 离开启动页进入后续引导 | 启动向后流转 |
| | `page_brand_show_1/2/3`| 品宣页第 1/2/3 页展示 | 了解产品功能价值（3 为完播） |
| | `page_brand_click_1/2/3`| 品宣页点击下一步 | 品宣交互意向 |
| **阶段 2：商业化订阅** | `paypage_freeopen` | 试用开启动效展示 | 引导体验试用动效 |
| | `paypage_show` | 订阅页真实曝光展示 | 商业化核心触达点 |
| | `paypage_click` | 订阅按钮点击 | 付费强意向 |
| | `paypage_close` | 订阅页关闭/跳过 | 放弃付费流向端内 |
| | `paypage_succ` | **免费试用订阅成功** | **商业化最终变现转化 (核心KPI)** |
| | `payback_show/click/succ`| 挽留弹窗展示/点击/成功 | 放弃退出时的二次拦截变现 |
| **阶段 3：系统权限** | `sys_pop_show` | 应用内权限说明弹窗展示 | 首次索权前置引导 |
| | `sys_pop_agree` | 弹窗点击同意 | 接受权限说明 |
| | `sys_pop_deny` | 弹窗点击拒绝 | 拒绝授权风险点 |
| | `sys_agree` | 系统底层弹窗最终授权成功 | 真实获取读取/存储权限 |
| **阶段 4：功能留存** | `home_show` | **主界面/首页到达曝光** | **端内留存生命线 (关键阻断指标)** |
| | `home_file_click` | 首页点击具体文件 | 开始使用文档 |
| | `file_show` | 核心文件列表展示 | 列表加载完成 |
| | `PDF_view` | **PDF 文档打开阅读** | 基础功能消费量 |
| | `PDF_edit` | 进入 PDF 编辑工具 | 深度功能尝鲜 |
| | `PDF_func_click` | 点击具体编辑小工具 | 高频操作行为 |
| | `PDF_func_done` | **完成一次编辑修改** | 工具闭环达成 |
| | `PDF_edit_save` | **保存/导出编辑后文档** | **核心深度高价值行为** |
| | `tap_discover_*` | 探索 Tab 展示/点击 | 扩展功能渗透 |
| | `wish_show` | 心愿单/功能反馈触达 | 需求挖掘触达 |

---

### 2. 核心比率计算公式

1. **大盘触达/渗透率 (Base Penetration)**：
   $$\text{渗透率} = \frac{\text{当前事件 UV}}{\text{logo\_start UV}} \times 100\%$$
2. **订阅页展点率 (Paywall CTR)**：
   $$\text{展点率} = \frac{\text{paypage\_click UV}}{\text{paypage\_show UV}} \times 100\%$$
3. **大盘试用付费转化率 (Trial Conversion Rate)**：
   $$\text{大盘试用转化率} = \frac{\text{paypage\_succ UV}}{\text{logo\_start UV}} \times 100\%$$
4. **点击付费转化率 (CVR - Click to Value)**：
   $$\text{CVR} = \frac{\text{paypage\_succ UV}}{\text{paypage\_click UV}} \times 100\%$$
5. **权限弹窗同意率 (Permission Agree Rate)**：
   $$\text{弹窗同意率} = \frac{\text{sys\_pop\_agree UV}}{\text{sys\_pop\_show UV}} \times 100\%$$
6. **首页到达率 (Home Arrival Rate - 进端率)**：
   $$\text{首页到达率} = \frac{\text{home\_show UV}}{\text{logo\_start UV}} \times 100\%$$
7. **编辑完成率 (Edit Completion Rate)**：
   $$\text{编辑完成率} = \frac{\text{PDF\_func\_done UV}}{\text{PDF\_edit UV}} \times 100\%$$
8. **编辑保存率 (Edit Save Rate)**：
   $$\text{编辑保存率} = \frac{\text{PDF\_edit\_save UV}}{\text{PDF\_edit UV}} \times 100\%$$

---

## 🚨 异常检测与报警规则 (Diagnosis & Alert Rules)

在分析过程中，若计算指标触发以下阈值，必须在报告中作为 **⚠️ P0 / P1 重点异常** 单独高亮提示：

| 异常现象 | 触发判定阈值 | 潜在根因与排查方向 |
| :--- | :--- | :--- |
| **进端链路断裂 🚨** | `home_show / logo_start < 25%` 或 `sys_pop_show < 20%` | **P0 严重 Bug**！关闭订阅页后无法触发权限弹窗或进端崩溃/卡死。 |
| **品宣到订阅严重漏水 🚨** | `paypage_show / page_brand_show_3 < 80%` | **跳转丢失**！品宣完播后点击下一步未正常拉起订阅页，存在流失死角。 |
| **权限阻抗剧烈反弹 ⚠️** | `sys_pop_deny / sys_pop_show > 35%` | **文案/时机不当**！引导说明未能打消顾虑，需检查索权时机是否过于突兀。 |
| **商业化 CVR 塌陷 ⚠️** | `paypage_succ / paypage_click < 15%` | **支付阻力**！存在支付接入失败、价格感知不符或商品权益说明不清晰。 |
| **挽留突破亮眼 🏆** | `payback_succ > 0` | **高光动作**！挽留弹窗有效承接了弃单用户，说明挽留折扣/权益有吸引力。 |

---

## 📝 交付输出模板 (Delivery Templates)

### 模板 1：默认总汇总数据漏斗模式（适合飞书复制）
```markdown
### 📊 [项目/版本] [日期区间] 数据漏斗总汇总分析

**【核心大盘速览】**
* 启动规模：全量新增启动 **[X] UV / [Y] PV**
* 付费转化：大盘试用转化率 **[X]%**（[X]人成功，CVR [X]%）
* 进端留存：首页到达率 **[X]%**（进端 [X]人）
* 深度工具：阅读 [X]人（[X] PV），编辑 [X]人（完成 [X]人，保存 [X]人）

#### 一、 全链路关键事件总汇总漏斗表
| 业务环节 | 核心事件 | 汇总数据量 (UV / PV) | 大盘转化率 (vs 启动) | 环节转化率 / 诊断 |
| :--- | :--- | :---: | :---: | :--- |
| 应用启动 | logo_start | [X] UV / [Y] PV | 100.0% | 基准大盘 |
| 订阅展示 | paypage_show | [X] UV / [Y] PV | [X]% | 触达率 [X]% |
| 订阅点击 | paypage_click | [X] UV / [Y] PV | [X]% | 展点率 [X]% |
| 试用成功 | paypage_succ | [X] UV / [Y] PV | [X]% | CVR [X]% |
| 权限同意 | sys_pop_agree | [X] UV / [Y] PV | [X]% | 弹窗同意率 [X]% |
| 首页到达 | home_show | [X] UV / [Y] PV | [X]% | 进端率 [X]% |
| PDF阅读 | PDF_view | [X] UV / [Y] PV | [X]% | 人均阅读 [X]次 |
| PDF编辑 | PDF_edit | [X] UV / [Y] PV | [X]% | 保存率 [X]% |

#### 二、 核心业务洞察与异常诊断
1. 商业化表现评估：...
2. 权限与进端流转评估：...
3. 端内高频与高价值功能评估：...
```

---

### 模板 2：用户分组 / AB 测试下钻模式
```markdown
### 📊 [项目/版本] AB组 / 用户配置对比深度复盘

**【核心决策结论】**
* **胜出方案**：推荐推全 **[组别名称]**
* **核心优势**：商业化试用率比对照组高 **+[X]%**，首页到达率高 **+[X]%**

#### 一、 AB组核心链路汇总数据量全景对比表
| 核心链路指标 | A组: [方案名称] (UV/PV) | B组: [方案名称] (UV/PV) | 转化率对比 (A vs B) | 组间净差值 (B - A) | 胜出判定 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| 应用启动 | [X] / [Y] | [X] / [Y] | 100% vs 100% | 样本对齐 | 基准 |
| 订阅展示 | [X] / [Y] | [X] / [Y] | [X]% vs [X]% | [+/-X]% | ... |
| 订阅点击 | [X] / [Y] | [X] / [Y] | [X]% vs [X]% | [+/-X]% | ... |
| ★ 试用成功 | [X] / [Y] | [X] / [Y] | [X]% vs [X]% | [+/-X]% | 🏆 [胜出组] |
| ★ 点击付费CVR | [X]% | [X]% | [X]% vs [X]% | [+/-X]% | ... |
| ★ 首页到达 | [X] / [Y] | [X] / [Y] | [X]% vs [X]% | [+/-X]% | 🏆 [胜出组] |
| PDF阅读 | [X] / [Y] | [X] / [Y] | [X]% vs [X]% | [+/-X]% | ... |
| PDF编辑 | [X] / [Y] | [X] / [Y] | [X]% vs [X]% | [+/-X]% | ... |

#### 二、 深度组间归因与剪刀差分析
1. 变现路径归因：为什么该组付费更高？（心理预期、展点动机等）
2. 用户体验与留存归因：开屏强弹 vs 品宣铺垫对后续进端与编辑的差异。
3. 异常流失定位：落后组具体是在哪一步丢掉了用户。
```
