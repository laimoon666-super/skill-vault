#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Suki App 看广告得贝壳 - 核心自动化执行引擎
适配设备: 荣耀手机 (MagicOS 9.0 / Android 15, 分辨率 1224x2700)
"""

import os
import sys
import time
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

# 配置常量
ADB_PATH = r"C:\Users\Administrator\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not os.path.exists(ADB_PATH):
    ADB_PATH = "adb"

DEVICE_IP = "192.168.2.5:5555"
PACKAGE_NAME = "com.taoqidev.suki"

# 标准关键坐标 (基于 1224x2700 分辨率)
COORD_MASK_CLEAR = (300, 1400)      # 中立盲区（清除透明穿透遮罩）
COORD_POPUP_CONFIRM = (500, 1600)   # 弹窗【收下】/【领取】按钮
COORD_POPUP_REWARD = (500, 1570)    # 弹窗【领取奖励】黄色按钮
COORD_TASK_ICON_HOME = (918, 360)   # 主房间右上角【贝壳】日历图标
COORD_NAV_BACK = (91, 212)          # 顶部左侧返回箭头
COORD_AD_CLOSE_RIGHT = (1115, 235)  # 广告结算页右上角【✕】
COORD_AD_CLOSE_ALT = (1140, 195)    # 广告结算页右上角备用【✕】
COORD_WEBVIEW_CLOSE = (305, 190)    # 广告落地页左上角【✕】
COORD_AD_SKIP = (1115, 220)         # 广告右上角【跳过】/【激励已下发】
COORD_AD_SKIP_BANNER = (880, 92)    # 抖音类广告胶囊条内【跳过】

# 保存目录
BASE_DIR = Path(__file__).resolve().parent
SCREENSHOT_DIR = BASE_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def run_adb(args, timeout=20):
    """执行 adb 命令并返回输出"""
    cmd = [ADB_PATH, "-s", DEVICE_IP] + args
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="ignore")
        return res.stdout.strip()
    except Exception as e:
        print(f"[ADB Error] cmd={' '.join(cmd)} error={e}")
        return ""


def ensure_connected():
    """保证与荣耀手机的 ADB 连接正常"""
    # 检查当前在线设备
    try:
        check = subprocess.run([ADB_PATH, "devices"], capture_output=True, text=True, timeout=5, encoding="utf-8", errors="ignore")
        if DEVICE_IP in check.stdout and "device" in check.stdout:
            return True
    except Exception:
        pass

    print(f"Connecting to {DEVICE_IP}...")
    subprocess.run([ADB_PATH, "connect", DEVICE_IP], capture_output=True, text=True, timeout=10, encoding="utf-8", errors="ignore")
    time.sleep(1)
    
    check = subprocess.run([ADB_PATH, "devices"], capture_output=True, text=True, timeout=5, encoding="utf-8", errors="ignore")
    if DEVICE_IP in check.stdout and "device" in check.stdout:
        print(f"Connected to {DEVICE_IP} successfully.")
        return True
    print(f"[Warning] Failed to connect to {DEVICE_IP}. Please ensure phone Wi-Fi ADB is active.")
    return False


def tap(x, y, desc=""):
    """点击指定坐标"""
    ensure_connected()
    if desc:
        print(f"[Tap] {desc} -> ({x}, {y})")
    run_adb(["shell", "input", "tap", str(x), str(y)])


def clear_mask():
    """安全点击中立盲区清除透明遮罩"""
    tap(COORD_MASK_CLEAR[0], COORD_MASK_CLEAR[1], desc="Clear Mask")
    time.sleep(0.5)


def capture_screen(name="step_latest.png"):
    """截取当前屏幕并拉取到本地"""
    ensure_connected()
    local_path = SCREENSHOT_DIR / name
    run_adb(["shell", "screencap", "-p", "/sdcard/screen.png"])
    run_adb(["pull", "/sdcard/screen.png", str(local_path)])
    return local_path


def dump_ui():
    """导出并解析当前页面的 UI XML 结构"""
    ensure_connected()
    xml_remote = "/sdcard/window_dump.xml"
    local_xml = BASE_DIR / "window_dump.xml"
    run_adb(["shell", "uiautomator", "dump", xml_remote])
    run_adb(["pull", xml_remote, str(local_xml)])
    if local_xml.exists():
        try:
            with open(local_xml, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            pass
    return ""


def get_ui_elements():
    """解析 XML 获取所有带文本或描述的节点"""
    xml_str = dump_ui()
    if not xml_str or "<hierarchy" not in xml_str:
        return []
    
    elements = []
    try:
        root = ET.fromstring(xml_str)
        for node in root.iter("node"):
            desc = node.attrib.get("content-desc", "").strip()
            text = node.attrib.get("text", "").strip()
            bounds = node.attrib.get("bounds", "").strip()
            clickable = node.attrib.get("clickable", "false") == "true"
            
            # 解析 bounds [x1, y1][x2, y2]
            if bounds.startswith("[") and "][" in bounds:
                parts = bounds.replace("][", ",").replace("[", "").replace("]", "").split(",")
                if len(parts) == 4:
                    x1, y1, x2, y2 = map(int, parts)
                    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                    elements.append({
                        "desc": desc,
                        "text": text,
                        "bounds": (x1, y1, x2, y2),
                        "center": (cx, cy),
                        "clickable": clickable
                    })
    except Exception as e:
        print(f"[Parse UI Error] {e}")
    return elements


def get_seashell_count():
    """从页面中读取当前贝壳数量"""
    elems = get_ui_elements()
    for el in elems:
        full_text = el["desc"] + " " + el["text"]
        if "贝壳：" in full_text or "贝壳:" in full_text:
            try:
                # 提取数字
                import re
                nums = re.findall(r"\d+", full_text)
                if nums:
                    return int(nums[0])
            except Exception:
                pass
    return None


def open_task_center():
    """确保进入任务中心页面"""
    elems = get_ui_elements()
    for el in elems:
        if "贝壳任务" in el["desc"] or "每日0点重置" in el["desc"] or "7日签到奖励" in el["desc"]:
            print("[Task Center] Already in Task Center.")
            return True
            
    # 如果在主房间，点击右上角日历
    print("[Task Center] Navigating from Home to Task Center...")
    clear_mask()
    tap(COORD_TASK_ICON_HOME[0], COORD_TASK_ICON_HOME[1], desc="Task Calendar Icon")
    time.sleep(2)
    return True


def dismiss_popups():
    """清除可能存在的【收下】/【领取】/【我知道了】等弹窗"""
    time.sleep(1)
    tap(COORD_POPUP_CONFIRM[0], COORD_POPUP_CONFIRM[1], desc="Dismiss Popup (收下)")
    time.sleep(0.8)


def watch_single_ad(ad_index=1, max_duration=35):
    """
    观看单条广告的标准流程 (SOP)：
    1. 等待视频倒计时
    2. 检测跳过/结算
    3. 关闭广告返回
    """
    print(f"\n--- [Ad Playback] Starting ad #{ad_index} (Wait {max_duration}s) ---")
    
    # 周期性检测广告状态，最长 max_duration 秒
    start_time = time.time()
    while time.time() - start_time < max_duration:
        time.sleep(5)
        # 尝试点击跳过（如果有）
        tap(COORD_AD_SKIP[0], COORD_AD_SKIP[1], desc="Try Skip")
        tap(COORD_AD_SKIP_BANNER[0], COORD_AD_SKIP_BANNER[1], desc="Try Banner Skip")

    print("[Ad Playback] Duration reached. Closing ad end card...")
    clear_mask()
    tap(COORD_AD_CLOSE_RIGHT[0], COORD_AD_CLOSE_RIGHT[1], desc="Close End Card (Top-Right)")
    time.sleep(1)
    tap(COORD_AD_CLOSE_ALT[0], COORD_AD_CLOSE_ALT[1], desc="Close End Card (Alt)")
    time.sleep(1)
    tap(COORD_WEBVIEW_CLOSE[0], COORD_WEBVIEW_CLOSE[1], desc="Close Webview Landing Page")
    time.sleep(2)


def execute_all_ad_tasks():
    """
    执行全部广告任务：
    1. 每日看3次激励视频
    2. 八月限时看激励视频 (3次)
    3. 自动领取全部奖励
    """
    print("=" * 60)
    print("      Suki App 看广告自动化任务启动")
    print("=" * 60)

    if not ensure_connected():
        print("[Fatal] Unable to connect to device. Aborting.")
        return False

    # 1. 打开任务中心并记录基线
    open_task_center()
    time.sleep(2)
    initial_shells = get_seashell_count()
    print(f"[*] 任务开始前贝壳总数: {initial_shells}")
    capture_screen("01_task_center_initial.png")

    # 2. 检查并完成可直接领取的任务（例如 两人同时上线）
    elems = get_ui_elements()
    for el in elems:
        if "去领取" in el["desc"] and "两人同时上线" in el["desc"]:
            print("[*] 发现【两人同时上线】可领取，正在领取...")
            clear_mask()
            tap(el["center"][0], el["center"][1], desc="去领取")
            time.sleep(1.5)
            dismiss_popups()

    # 3. 循环检测并执行广告任务
    max_loops = 10
    loop_count = 0
    while loop_count < max_loops:
        loop_count += 1
        elems = get_ui_elements()
        
        # 查找是否有【去领取】按钮（已看完待领）
        claim_btn = None
        for el in elems:
            if "去领取" in el["desc"]:
                claim_btn = el
                break
        
        if claim_btn:
            print(f"[*] 发现待领取奖励: {claim_btn['desc']}，正在领取...")
            clear_mask()
            tap(claim_btn["center"][0], claim_btn["center"][1], desc="去领取")
            time.sleep(1.5)
            dismiss_popups()
            continue

        # 查找是否有【去完成】按钮（广告任务）
        ad_task_btn = None
        for el in elems:
            if "去完成" in el["desc"]:
                ad_task_btn = el
                break

        if not ad_task_btn:
            print("[*] 未发现更多待观看广告任务（所有广告均已完成或锁定【明日再来】）。")
            break

        print(f"\n[*] 发现待完成任务，准备起播广告...")
        clear_mask()
        tap(ad_task_btn["center"][0], ad_task_btn["center"][1], desc="去完成 (Start Ad)")
        time.sleep(2)
        
        # 观看广告
        watch_single_ad(ad_index=loop_count)
        
        # 验证是否产生弹窗提示
        capture_screen(f"ad_after_loop_{loop_count}.png")
        
        # 检查是否出现【继续观看】或【领取奖励】
        elems_after = get_ui_elements()
        for el in elems_after:
            if "继续观看" in el["desc"] or "继续观看" in el["text"]:
                print("[*] 发现【继续观看】弹窗，点击继续...")
                tap(el["center"][0], el["center"][1], desc="继续观看")
                time.sleep(2)
                watch_single_ad(ad_index=loop_count)
                break
            elif "领取奖励" in el["desc"] or "领取奖励" in el["text"]:
                print("[*] 发现【领取奖励】弹窗，点击领取...")
                tap(el["center"][0], el["center"][1], desc="领取奖励")
                time.sleep(1.5)
                dismiss_popups()
                break

    # 4. 终局双重闭环验证
    time.sleep(2)
    final_shells = get_seashell_count()
    final_cap = capture_screen("final_evidence.png")
    
    print("\n" + "=" * 60)
    print("      自动化执行结果统计")
    print("=" * 60)
    print(f"[*] 初始贝壳数量: {initial_shells}")
    print(f"[*] 最终贝壳数量: {final_shells}")
    if initial_shells is not None and final_shells is not None:
        diff = final_shells - initial_shells
        print(f"[*] 贝壳增长净值: +{diff} 贝壳")
    print(f"[*] 终局证据截图: {final_cap}")
    print("=" * 60)
    return True


if __name__ == "__main__":
    execute_all_ad_tasks()
