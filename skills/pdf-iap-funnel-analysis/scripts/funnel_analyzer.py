# -*- coding: utf-8 -*-
"""
PDF IAP Funnel Analyzer Tool
Utility script for pdf-iap-funnel-analysis skill.
"""

import sys, csv, io
from collections import defaultdict

STANDARD_EVENTS = [
    ('logo_start', '应用启动 (基准大盘)'),
    ('logo_show', '启动页展示'),
    ('logo_next', '完成品宣引导'),
    ('page_brand_show_1', '品宣页1展示'),
    ('page_brand_show_2', '品宣页2展示'),
    ('page_brand_show_3', '品宣页3展示 (完播)'),
    ('paypage_freeopen', '试用开启动效'),
    ('paypage_show', '订阅页真实曝光'),
    ('paypage_click', '订阅按钮点击'),
    ('paypage_close', '订阅页关闭'),
    ('paypage_succ', '免费试用订阅成功'),
    ('payback_show', '挽留弹窗展示'),
    ('payback_click', '挽留弹窗点击'),
    ('payback_close', '挽留弹窗关闭'),
    ('payback_succ', '挽留试用成功'),
    ('sys_pop_show', '权限引导弹窗展示'),
    ('sys_pop_agree', '权限弹窗点击同意'),
    ('sys_pop_deny', '权限弹窗点击拒绝'),
    ('sys_show', '系统权限弹窗展示'),
    ('sys_agree', '系统权限最终授权'),
    ('home_show', '首页到达曝光'),
    ('home_file_click', '首页文件点击'),
    ('file_show', '文件列表展示'),
    ('PDF_view', 'PDF阅读查看'),
    ('PDF_edit', 'PDF编辑工具打开'),
    ('PDF_func_click', 'PDF编辑功能点击'),
    ('PDF_func_done', 'PDF编辑操作完成'),
    ('PDF_edit_save', 'PDF编辑保存导出'),
    ('tap_click', '端内Tab点击'),
    ('tap_discover_show', '探索Tab展示'),
    ('tap_discover_click', '探索Tab点击'),
    ('discover_func_show', '探索功能展示'),
    ('discover_func_done', '探索功能完成'),
    ('wish_show', '心愿单/反馈展示'),
]

def analyze_funnel(csv_content, group_by_ab=False):
    reader = csv.DictReader(io.StringIO(csv_content.strip()))
    rows = list(reader)
    
    # Check fields
    has_group = 'ab_group' in reader.fieldnames or 'pid' in reader.fieldnames
    grp_col = 'ab_group' if 'ab_group' in reader.fieldnames else ('pid' if 'pid' in reader.fieldnames else None)
    
    if not group_by_ab or not grp_col:
        # Global Aggregate Funnel
        tot = defaultdict(lambda: [0, 0])
        for r in rows:
            ev = r['event_name']
            tot[ev][0] += int(r['uv'])
            tot[ev][1] += int(r['pv'])
            
        base_uv = tot['logo_start'][0] if tot['logo_start'][0] > 0 else 1
        
        print("### 📊 PDF IAP 数据漏斗总汇总分析\n")
        print("| 阶段 | 事件名称 | 汇总数据量 (UV/PV) | 大盘渗透率 | 环节转化率与业务诊断 |")
        print("| :--- | :--- | :---: | :---: | :--- |")
        
        for ev, name in STANDARD_EVENTS:
            if ev in tot:
                u, p = tot[ev]
                rate = u / base_uv
                diag = ""
                if ev == 'paypage_click' and 'paypage_show' in tot and tot['paypage_show'][0] > 0:
                    diag = f"展点率: {u/tot['paypage_show'][0]:.1%}"
                elif ev == 'paypage_succ':
                    cvr = u / tot['paypage_click'][0] if ('paypage_click' in tot and tot['paypage_click'][0] > 0) else 0
                    diag = f"大盘转化: {rate:.1%}, CVR: {cvr:.1%}"
                elif ev == 'sys_pop_agree' and 'sys_pop_show' in tot and tot['sys_pop_show'][0] > 0:
                    diag = f"弹窗同意率: {u/tot['sys_pop_show'][0]:.1%}"
                elif ev == 'home_show':
                    diag = f"进端率: {rate:.1%}" + (" 🚨 严重偏低" if rate < 0.25 else "")
                elif ev == 'PDF_func_done' and 'PDF_edit' in tot and tot['PDF_edit'][0] > 0:
                    diag = f"编辑完成率: {u/tot['PDF_edit'][0]:.1%}"
                elif ev == 'PDF_edit_save' and 'PDF_edit' in tot and tot['PDF_edit'][0] > 0:
                    diag = f"编辑保存率: {u/tot['PDF_edit'][0]:.1%}"
                    
                print(f"| {name.split()[0]} | `{ev}` | {u} UV / {p} PV | {rate:.1%} | {diag} |")
    else:
        # Grouped AB Funnel
        groups = sorted(set(r[grp_col] for r in rows))
        grp_data = defaultdict(lambda: defaultdict(lambda: [0, 0]))
        for r in rows:
            g = r[grp_col]
            ev = r['event_name']
            grp_data[g][ev][0] += int(r['uv'])
            grp_data[g][ev][1] += int(r['pv'])
            
        print("### 📊 PDF IAP 分组漏斗对比分析\n")
        header = f"| 事件名称 |" + "".join([f" {g} (UV/PV) |" for g in groups])
        print(header)
        sep = "| :--- |" + "".join([" :---: |" for _ in groups])
        print(sep)
        
        base_uvs = {g: grp_data[g]['logo_start'][0] if grp_data[g]['logo_start'][0] > 0 else 1 for g in groups}
        
        for ev, name in STANDARD_EVENTS:
            if any(ev in grp_data[g] for g in groups):
                row_str = f"| {name} (`{ev}`) |"
                for g in groups:
                    u, p = grp_data[g].get(ev, [0, 0])
                    rate = u / base_uvs[g]
                    row_str += f" {u}/{p} ({rate:.1%}) |"
                print(row_str)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            content = f.read()
        group_mode = '--group' in sys.argv
        analyze_funnel(content, group_by_ab=group_mode)
    else:
        print("Usage: python funnel_analyzer.py <csv_file> [--group]")
