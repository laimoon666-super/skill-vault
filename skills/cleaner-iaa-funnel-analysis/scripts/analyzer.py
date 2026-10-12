# -*- coding: utf-8 -*-
"""
Cleaner IAA Funnel Analyzer Tool
Utility script for cleaner-iaa-funnel-analysis skill.
Processes raw CSV/Excel data and outputs standardized high-density funnels.
"""

import sys
import os
import argparse
from collections import defaultdict

# Reconfigure stdout for Windows console UTF-8 support
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# 28 Standard Cleaner IAA Events in logical lifecycle order
FUNNEL_STAGES = [
    ("1. 权限引导", [
        ("float_guide_show", "悬浮窗引导曝光 (基准 Base)"),
        ("local_notify_pop", "通知引导弹窗"),
        ("notify_perm_granted_splash", "开屏通知权限授权"),
        ("float_guide_click", "悬浮窗开启点击"),
        ("s_permission_granted_float", "悬浮窗授权成功"),
        ("float_guide_pass", "悬浮窗引导通过/跳过"),
    ]),
    ("2. 开屏与首清", [
        ("app_open", "应用正式启动"),
        ("open_loaded", "启动加载完成"),
        ("rcv_ad_request_first", "开屏广告首请"),
        ("rcv_ad_shown", "开屏广告真实展示"),
        ("open_and_splash_loaded", "开屏与广告播放完成"),
        ("device_scan_start", "设备垃圾预检开始"),
        ("device_scan_finish", "设备预检完成"),
        ("device_result_show", "扫描结果展示"),
        ("skip_new_button_show", "跳过首清按钮曝光"),
        ("skip_new_button_click", "跳过首清按钮点击"),
        ("clean_button_click", "点击立即清理"),
        ("clean_process_start", "清理动效开始"),
        ("clean_process_finish", "清理动效结束"),
        ("clean_result_show", "首清结果页展示"),
    ]),
    ("3. 主页与核心功能", [
        ("s_homepage", "主界面曝光展示"),
        ("c_homepage", "主页元素交互点击"),
        ("c_function", "子功能点击 (省电/加速等)"),
        ("c_function_finished", "子功能执行完成"),
        ("junk_scan_start", "深度垃圾扫描开始"),
        ("junk_scan_finish", "深度垃圾扫描结束"),
        ("junk_result_show", "深度垃圾结果展示"),
    ]),
    ("4. 桌面护城河", [
        ("home_card_show", "桌面卡片引导展示"),
        ("home_card_add", "桌面卡片添加成功"),
        ("floatball_guide_show", "桌面悬浮球引导展示"),
        ("floatball_panel_show", "悬浮球面板展开展示"),
        ("floatball_panel_click", "悬浮球面板功能点击"),
        ("more_feature_guide_show", "更多功能引导展示"),
        ("more_feature_guide_click", "更多功能引导点击"),
    ])
]

def load_data(file_path):
    import pandas as pd
    if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
        return pd.read_excel(file_path)
    elif file_path.endswith('.csv'):
        return pd.read_csv(file_path)
    else:
        raise ValueError("Unsupported file format. Please provide .xlsx or .csv")

def analyze_aggregate(df):
    # Sum uv and pv grouped by event_name
    agg = df.groupby('event_name', as_index=False)[['uv', 'pv']].sum()
    data_map = {r['event_name']: (int(r['uv']), int(r['pv'])) for _, r in agg.iterrows()}
    
    base_uv = data_map.get('float_guide_show', (0, 0))[0]
    if base_uv == 0:
        base_uv = data_map.get('app_open', (1, 1))[0]
        
    app_open_uv = data_map.get('app_open', (0, 0))[0]
    float_click_uv = data_map.get('float_guide_click', (0, 0))[0]
    float_perm_uv = data_map.get('s_permission_granted_float', (0, 0))[0]
    splash_loaded_uv = data_map.get('open_and_splash_loaded', (0, 0))[0]
    homepage_uv = data_map.get('s_homepage', (0, 0))[0]
    
    # Summary header
    print("### 📊 清理 IAA 数据漏斗全景总汇总分析\n")
    print(f"**【核心大盘速览】**")
    print(f"* **大盘基准 (Base UV)**: {base_uv:,} 人 (float_guide_show)")
    if float_click_uv > 0:
        click_rate = float_click_uv / base_uv
        auth_rate = float_perm_uv / float_click_uv if float_click_uv > 0 else 0
        final_auth_rate = float_perm_uv / base_uv
        print(f"* **悬浮窗权限授权**: 开启点击率 **{click_rate:.2%}** ｜ 点击后成功率 **{auth_rate:.2%}** ｜ 全局最终授权率 **{final_auth_rate:.2%}**")
    if app_open_uv > 0:
        splash_open_rate = splash_loaded_uv / app_open_uv
        splash_global_rate = splash_loaded_uv / base_uv
        home_open_rate = homepage_uv / app_open_uv
        home_global_rate = homepage_uv / base_uv
        print(f"* **开屏与广告完播**: 占启动完播率 **{splash_open_rate:.2%}** ｜ 全局大盘渗透率 **{splash_global_rate:.2%}**")
        print(f"* **主页展示渗透**: 占启动渗透率 **{home_open_rate:.2%}** ｜ 全局主页到达率 **{home_global_rate:.2%}**")
    print("\n#### 一、 四大核心阶段全链路漏斗详情表\n")
    print("| 漏斗阶段 | 关键事件名称 | 原始数据量 (UV / PV) | 阶段转化率 / 步骤转化 | 大盘渗透率 (vs Base) | 关键业务诊断 |")
    print("| :--- | :--- | :---: | :---: | :---: | :--- |")
    
    for stage_name, events in FUNNEL_STAGES:
        for ev, desc in events:
            if ev in data_map:
                u, p = data_map[ev]
                glob_rate = u / base_uv if base_uv > 0 else 0
                step_diag = "-"
                
                # Contextual step rate
                if ev == 'float_guide_click':
                    step_diag = f"{glob_rate:.2%} (开启点击率)"
                elif ev == 's_permission_granted_float':
                    p_rate = u / float_click_uv if float_click_uv > 0 else 0
                    step_diag = f"{p_rate:.2%} (点击后成功率)"
                elif ev == 'open_and_splash_loaded':
                    o_rate = u / app_open_uv if app_open_uv > 0 else 0
                    step_diag = f"{o_rate:.2%} (占启动完播)"
                elif ev == 's_homepage':
                    h_rate = u / app_open_uv if app_open_uv > 0 else 0
                    step_diag = f"{h_rate:.2%} (占启动进端)"
                elif ev == 'clean_button_click':
                    dev_res = data_map.get('device_result_show', (0,0))[0]
                    c_rate = u / dev_res if dev_res > 0 else 0
                    step_diag = f"{c_rate:.2%} (结果展点率)"
                elif ev == 'clean_result_show':
                    c_click = data_map.get('clean_button_click', (0,0))[0]
                    c_fin = u / c_click if c_click > 0 else 0
                    step_diag = f"{c_fin:.2%} (清理完成率)"
                elif ev == 'home_card_add':
                    c_show = data_map.get('home_card_show', (0,0))[0]
                    add_rate = u / c_show if c_show > 0 else 0
                    step_diag = f"{add_rate:.2%} (卡片添加率)"
                
                status_icon = ""
                if ev == 's_homepage' and (u / app_open_uv if app_open_uv > 0 else 0) < 0.45:
                    status_icon = " ⚠️ 进端偏低"
                elif ev == 'open_and_splash_loaded' and (u / app_open_uv if app_open_uv > 0 else 0) < 0.70:
                    status_icon = " 🚨 广告加载损耗"
                elif ev == 's_permission_granted_float' and glob_rate < 0.25:
                    status_icon = " ⚠️ 授权转化受阻"
                
                print(f"| **{stage_name}** | `{ev}` ({desc.split()[0]}) | {u:,} / {p:,} | {step_diag} | {glob_rate:.2%} | {desc}{status_icon} |")

def analyze_regions(df, min_uv=50, exclude_us=True):
    # Detect country column
    c_cols = [c for c in df.columns if c.lower() in ['country', 'region', 'geo', 'nation', 'area']]
    if not c_cols:
        print("未检测到国家/地区维度，转为全量大盘分析。")
        analyze_aggregate(df)
        return
        
    c_col = c_cols[0]
    countries = df[c_col].unique()
    
    # Pivot
    piv = df.pivot_table(index=c_col, columns='event_name', values='uv', aggfunc='sum').fillna(0)
    
    # Filter
    base_col = 'float_guide_show' if 'float_guide_show' in piv.columns else 'app_open'
    filtered = piv[piv[base_col] > min_uv]
    if exclude_us:
        filtered = filtered[~filtered.index.str.upper().isin(['US', 'USA', 'UNITED STATES', '美国'])]
        
    filtered = filtered.sort_values(by=base_col, ascending=False)
    
    print(f"### 📊 重点非美地区横向对比复盘 (过滤 Base UV > {min_uv})\n")
    print("*(严格顺序：悬浮窗开启点击率 -> 点击后授权成功率 -> 悬浮窗最终授权率 -> 开屏占启动完播 -> 开屏全局渗透 -> 主页占启动渗透 -> 主页全局渗透)*\n")
    print("| 地区/国家 | Base UV (引导曝光) | 悬浮窗开启点击率 | 悬浮窗点击后授权成功率 | 悬浮窗最终授权率 (全局) | 开屏与广告播完率 (占启动) | 开屏展示渗透率 (全局) | 主页展示渗透率 (占启动) | 主页展示渗透率 (全局) |")
    print("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    
    for country, r in filtered.iterrows():
        base = r.get('float_guide_show', 0)
        if base == 0: base = r.get('app_open', 1)
        app_open = r.get('app_open', 0)
        f_click = r.get('float_guide_click', 0)
        f_perm = r.get('s_permission_granted_float', 0)
        splash_loaded = r.get('open_and_splash_loaded', 0)
        home = r.get('s_homepage', 0)
        
        click_r = f"{f_click / base:.2%}" if base > 0 else "-"
        auth_step_r = f"{f_perm / f_click:.2%}" if f_click > 0 else "-"
        auth_glob_r = f"{f_perm / base:.2%}" if base > 0 else "-"
        splash_open_r = f"{splash_loaded / app_open:.2%}" if app_open > 0 else "-"
        splash_glob_r = f"{splash_loaded / base:.2%}" if base > 0 else "-"
        home_open_r = f"{home / app_open:.2%}" if app_open > 0 else "-"
        home_glob_r = f"{home / base:.2%}" if base > 0 else "-"
        
        print(f"| **{country}** | {int(base):,} | {click_r} | {auth_step_r} | {auth_glob_r} | {splash_open_r} | {splash_glob_r} | {home_open_r} | {home_glob_r} |")

def main():
    parser = argparse.ArgumentParser(description="Cleaner IAA Funnel Analyzer")
    parser.add_argument("file_path", help="Path to raw data file (.xlsx or .csv)")
    parser.add_argument("--regions", action="store_true", help="Analyze by region (UV > 50, non-US)")
    parser.add_argument("--min_uv", type=int, default=50, help="Minimum UV threshold for region filtering (default: 50)")
    parser.add_argument("--include_us", action="store_true", help="Include US in regional analysis")
    
    args = parser.parse_args()
    if not os.path.exists(args.file_path):
        print(f"File not found: {args.file_path}")
        sys.exit(1)
        
    df = load_data(args.file_path)
    if args.regions:
        analyze_regions(df, min_uv=args.min_uv, exclude_us=not args.include_us)
    else:
        analyze_aggregate(df)

if __name__ == '__main__':
    main()
