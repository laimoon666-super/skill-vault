import argparse
import sys
import time
from client import BrowserDelegation

def main():
    parser = argparse.ArgumentParser(description="AI Agent 浏览器代操作 CLI")
    subparsers = parser.add_subparsers(dest="command")

    # status
    subparsers.add_parser("status", help="检查服务与插件连接状态")

    # open
    open_p = subparsers.add_parser("open", help="在专属标签组中打开网址")
    open_p.add_argument("url", help="目标网址")
    open_p.add_argument("--group", default="🤖 AI 代操作进行中...", help="标签组名称")

    args = parser.parse_args()
    browser = BrowserDelegation()

    if args.command == "status":
        st = browser.status()
        print("服务状态:", "已连接 🟢" if st.get("connected") else "未连接 🔴")
        print("详情:", st)
    elif args.command == "open":
        print(f"正在打开: {args.url}")
        with browser.open_tab(args.url, group_name=args.group) as tab:
            print("标题:", tab.get_title())
            print("URL:", tab.get_url())
            print("保持 5 秒后自动收尾...")
            time.sleep(5)
        print("标签页已优雅关闭！")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
